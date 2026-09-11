-- Parent Web Push. Private keys never enter the browser or repository.
create extension if not exists pg_net;
create extension if not exists pg_cron;
create schema if not exists parent_push;
revoke all on schema parent_push from public, anon, authenticated;
create table parent_push.config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  public_key text,
  private_key_id uuid,
  dispatch_key_id uuid not null,
  dispatch_hash text not null,
  last_wake_at timestamptz
);
do $$ declare s text; k uuid; begin
  s := encode(extensions.gen_random_bytes(32),'hex');
  k := vault.create_secret(s,'open_stars_push_dispatch','Internal parent push worker authentication');
  insert into parent_push.config(dispatch_key_id,dispatch_hash)
  values(k,encode(extensions.digest(s,'sha256'),'hex'));
end $$;
create table parent_push.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on parent_push.subscriptions(user_id) where enabled;
alter table public.notifications add column if not exists child_id uuid references public.children(id) on delete set null;
alter table public.notifications add column if not exists push_context jsonb not null default '{}'::jsonb;
create index if not exists notifications_child_id_idx on public.notifications(child_id) where child_id is not null;
create table parent_push.deliveries (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references parent_push.subscriptions(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','cancelled','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  last_status integer,
  unique(notification_id,subscription_id)
);
create index on parent_push.deliveries(available_at) where state in ('pending','sending');
create index on parent_push.deliveries(subscription_id);
alter table parent_push.config enable row level security;
alter table parent_push.subscriptions enable row level security;
alter table parent_push.deliveries enable row level security;
revoke all on all tables in schema parent_push from public, anon, authenticated;

create or replace function private.pp_has_child(p_user uuid,p_child uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.children c
  join public.family_members f on f.family_id=c.family_id
  join public.users_profile u on u.id=f.user_id
  where c.id=p_child and c.archived_at is null and u.auth_user_id=p_user)
$$;

create or replace function private.pp_wake()
returns void language plpgsql security definer set search_path='' as $$
declare s text; begin
  if not exists(select 1 from parent_push.config where enabled
    and (last_wake_at is null or last_wake_at < now()-interval '3 seconds')) then return; end if;
  if not exists(select 1 from parent_push.config where public_key is null)
    and not exists(select 1 from parent_push.deliveries where state in ('pending','sending') and available_at<=now()) then return; end if;
  update parent_push.config set last_wake_at=now();
  select v.decrypted_secret into s from vault.decrypted_secrets v join parent_push.config c on c.dispatch_key_id=v.id;
  perform net.http_post(
    url:='https://yiwiykbuaggyslfyhlfo.supabase.co/functions/v1/parent-push-worker',
    headers:=jsonb_build_object('Content-Type','application/json','X-Openstars-Push-Key',s),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
exception when others then
  -- Delivery retries via cron; teaching and payment writes must remain available.
  raise log 'Parent push wake deferred, SQLSTATE %',sqlstate;
end $$;

create or replace function private.pp_enqueue()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into parent_push.deliveries(notification_id,subscription_id)
  select n.id,s.id from inserted_notifications n
  join parent_push.subscriptions s on s.user_id=n.recipient_user_id and s.enabled
  where n.target in ('news','coins','progress','homework','comments','payments','push_test')
    and (n.target<>'push_test' or n.push_context->>'subscription_id'=s.id::text)
  on conflict do nothing;
  perform private.pp_wake();
  return null;
end $$;
create trigger parent_push_enqueue after insert on public.notifications
referencing new table as inserted_notifications for each statement execute function private.pp_enqueue();

create or replace function private.pp_fingerprint(p_table text,p_row jsonb)
returns text language sql immutable set search_path='' as $$
  select md5(case p_table
    when 'grades' then coalesce(p_row->>'child_id','')||(p_row->'grade')::text||coalesce(p_row->>'subject','')||coalesce(p_row->>'lesson_date','')
    when 'homework' then (p_row - array['status','created_at','updated_at'])::text
    when 'teacher_comments' then (p_row - array['created_at','updated_at'])::text
    when 'homework_teacher_comments' then (p_row - array['created_at','updated_at'])::text
    else p_row::text end)
$$;
create or replace function private.pp_academic_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=to_jsonb(new); fp text; tab text; ttl text; begin
  fp:=private.pp_fingerprint(tg_table_name,j);
  if tg_op='UPDATE' and fp=private.pp_fingerprint(tg_table_name,to_jsonb(old)) then return new; end if;
  tab:=case tg_table_name when 'grades' then 'progress' when 'homework' then 'homework'
    when 'homework_teacher_comments' then 'homework' else 'comments' end;
  ttl:=case tg_table_name when 'grades' then 'Новая оценка' when 'homework' then 'Новое домашнее задание' else 'Комментарий педагога' end;
  insert into public.notifications(recipient_user_id,title,body,target,target_id,child_id,dedupe_key,push_context)
  select distinct u.auth_user_id,ttl,'Откройте кабинет, чтобы посмотреть подробности.',tab,new.id,new.child_id,
    'academic:'||tg_table_name||':'||new.id::text||':'||fp||':'||txid_current()::text||':'||u.auth_user_id::text,
    jsonb_build_object('source',tg_table_name,'source_id',new.id,'fingerprint',fp)
  from public.children c join public.family_members f on f.family_id=c.family_id
  join public.users_profile u on u.id=f.user_id
  where c.id=new.child_id and c.archived_at is null and u.auth_user_id is not null
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  return new;
end $$;
create trigger parent_push_grades after insert or update on public.grades for each row execute function private.pp_academic_event();
create trigger parent_push_homework after insert or update on public.homework for each row execute function private.pp_academic_event();
create trigger parent_push_teacher_comments after insert or update on public.teacher_comments for each row execute function private.pp_academic_event();
create trigger parent_push_homework_comments after insert or update on public.homework_teacher_comments for each row execute function private.pp_academic_event();

create or replace function private.pp_charge_due(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.monthly_payment_charges q join public.children c on c.id=q.child_id
  where q.id=p_id and c.archived_at is null and q.due_date < (now() at time zone 'Asia/Irkutsk')::date
    and q.expected_amount>coalesce((select sum(r.amount) from public.payment_receipts r
      join public.payments p on p.id=r.payment_id
      where r.child_id=q.child_id and p.month=q.month and r.voided_at is null and r.refunded_at is null),0)
    -- Legacy paid markers without receipt amounts are not evidence of an unpaid debt.
    and not exists(select 1 from public.payments p where p.child_id=q.child_id and p.month=q.month and p.status='paid'))
$$;
create or replace function private.pp_debt_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare cnt integer; begin
  if not pg_try_advisory_xact_lock(82119,330) then return 0; end if;
  insert into public.notifications(recipient_user_id,title,body,target,target_id,child_id,dedupe_key,push_context)
  select distinct u.auth_user_id,'Напоминание об оплате','Есть задолженность за занятия. Подробности — в разделе «Оплата».',
    'payments',q.id,q.child_id,'debt:'||q.id::text||':'||(now() at time zone 'Asia/Irkutsk')::date::text||':'||u.auth_user_id::text,
    jsonb_build_object('charge_id',q.id)
  from public.monthly_payment_charges q join public.children c on c.id=q.child_id
  join public.family_members f on f.family_id=c.family_id join public.users_profile u on u.id=f.user_id
  where u.auth_user_id is not null and private.pp_charge_due(q.id)
    and not exists(select 1 from public.notifications n where n.recipient_user_id=u.auth_user_id
      and n.target='payments' and n.target_id=q.id and n.created_at>now()-interval '7 days')
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics cnt=row_count;
  return cnt;
end $$;

create or replace function private.pp_deliverable(p_id uuid,p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare n public.notifications%rowtype; j jsonb; begin
  select * into n from public.notifications where id=p_id and recipient_user_id=p_user;
  if not found then return false; end if;
  if n.target='push_test' then return true; end if;
  if n.target='news' then
    return exists(select 1 from public.school_news s join public.children c
      on s.audience_scope='all_school' or (s.branch=c.branch and
        (s.audience_scope='branch' or (s.audience_scope='group' and s.group_name=c.group_name)))
      where s.id=n.target_id and s.active and private.pp_has_child(p_user,c.id));
  end if;
  if not private.pp_has_child(p_user,coalesce(n.child_id,case when n.target='coins' then n.target_id end)) then return false; end if;
  if n.target='payments' then return private.pp_charge_due(n.target_id); end if;
  if n.push_context ? 'source' then
    case n.push_context->>'source'
      when 'grades' then select to_jsonb(g) into j from public.grades g where id=n.target_id;
      when 'homework' then select to_jsonb(g) into j from public.homework g where id=n.target_id;
      when 'teacher_comments' then select to_jsonb(g) into j from public.teacher_comments g where id=n.target_id;
      when 'homework_teacher_comments' then select to_jsonb(g) into j from public.homework_teacher_comments g where id=n.target_id;
      else return false;
    end case;
    return j is not null and private.pp_fingerprint(n.push_context->>'source',j)=n.push_context->>'fingerprint';
  end if;
  return n.target='coins';
end $$;

create or replace function private.pp_parent(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); ep text:=p_data->>'endpoint'; s parent_push.subscriptions%rowtype;
  k text; n public.notifications%rowtype; cid uuid; nid uuid;
begin
  if u is null then raise exception 'Authentication required'; end if;
  if p_action='unsubscribe' then
    delete from parent_push.subscriptions where user_id=u and endpoint=ep;
    return '{"ok":true}';
  end if;
  if p_action='destination' then
    select * into n from public.notifications where id=(p_data->>'id')::uuid and recipient_user_id=u;
    if not found then return null; end if;
    cid:=coalesce(n.child_id,case when n.target='coins' then n.target_id end);
    if cid is not null and not private.pp_has_child(u,cid) then return null; end if;
    update public.notifications set is_read=true where id=n.id;
    return jsonb_build_object('tab',case when n.target='push_test' then 'news' else n.target end,'childId',cid);
  end if;
  if not exists(select 1 from public.children c where private.pp_has_child(u,c.id)) then raise exception 'Active family access required'; end if;
  if p_action='config' then
    select public_key into k from parent_push.config where enabled;
    return jsonb_build_object('publicKey',k);
  end if;
  if p_action='subscribe' then
    if ep is null or length(ep)>4096 or ep !~ '^https://(fcm[.]googleapis[.]com|[a-z0-9.-]+[.]push[.]apple[.]com|[a-z0-9.-]+[.]push[.]services[.]mozilla[.]com|[a-z0-9.-]+[.]notify[.]windows[.]com)/[^[:space:]]+$' then raise exception 'Unsupported push endpoint'; end if;
    if coalesce(p_data->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}=?$' or coalesce(p_data->>'auth','') !~ '^[A-Za-z0-9_-]{22}(==)?$' then raise exception 'Invalid push keys'; end if;
    perform pg_advisory_xact_lock(hashtextextended(ep,0));
    select * into s from parent_push.subscriptions where endpoint=ep for update;
    if found and s.user_id<>u then
      if s.p256dh<>p_data->>'p256dh' or s.auth_key<>p_data->>'auth' then raise exception 'Device key mismatch'; end if;
      delete from parent_push.subscriptions where id=s.id;
    end if;
    insert into parent_push.subscriptions(user_id,endpoint,p256dh,auth_key)
    values(u,ep,p_data->>'p256dh',p_data->>'auth')
    on conflict(endpoint) do update set user_id=u,p256dh=excluded.p256dh,auth_key=excluded.auth_key,enabled=true,updated_at=now()
    returning * into s;
    return jsonb_build_object('id',s.id);
  end if;
  raise exception 'Unknown push operation';
end $$;
create or replace function public.parent_push(p_action text,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select private.pp_parent(p_action,p_data) $$;

create or replace function private.pp_worker(p_action text,p_secret text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c parent_push.config%rowtype; k text; kid uuid; result jsonb; ack_result record; affected integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Worker access required'; end if;
  select * into c from parent_push.config;
  if p_secret is null or encode(extensions.digest(p_secret,'sha256'),'hex')<>c.dispatch_hash then raise exception 'Invalid dispatch authentication'; end if;
  if p_action='keys' then
    if c.private_key_id is not null then select decrypted_secret into k from vault.decrypted_secrets where id=c.private_key_id; end if;
    return jsonb_build_object('publicKey',c.public_key,'privateKey',k);
  end if;
  if p_action='init' then
    select * into c from parent_push.config for update;
    if c.public_key is null then
      if coalesce(p_data->>'publicKey','') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_data->>'privateKey','') !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Invalid VAPID keys'; end if;
      kid:=vault.create_secret(p_data->>'privateKey','open_stars_push_vapid','Parent Web Push private signing key');
      update parent_push.config set public_key=p_data->>'publicKey',private_key_id=kid;
    end if;
    return '{"ok":true}';
  end if;
  if p_action='claim' then
    if not c.enabled then return '[]'; end if;
    update parent_push.deliveries set state='failed',finished_at=now() where state in ('pending','sending') and (attempts>=6 or created_at<now()-interval '1 day');
    -- Cancel obsolete audiences, deleted/edited lessons, paid debts and expired subscriptions.
    update parent_push.deliveries d set state='cancelled',finished_at=now()
    from parent_push.subscriptions s where s.id=d.subscription_id and d.state in ('pending','sending')
      and (not s.enabled or not private.pp_deliverable(d.notification_id,s.user_id));
    with candidates as (select id from parent_push.deliveries where state in ('pending','sending') and available_at<=now()
      order by available_at,id for update skip locked limit 25), claimed as (
      update parent_push.deliveries d set state='sending',attempts=d.attempts+1,lease=gen_random_uuid(),available_at=now()+interval '2 minutes'
      from candidates j where d.id=j.id returning d.*)
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'lease',d.lease,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_key,
      'notificationId',n.id,'target',n.target,'title',case n.target when 'news' then 'Новая новость' when 'coins' then 'Начислены Star Coin' else n.title end)), '[]') into result
    from claimed d join parent_push.subscriptions s on s.id=d.subscription_id join public.notifications n on n.id=d.notification_id;
    return result;
  end if;
  if p_action='ack' then
    for ack_result in select * from jsonb_to_recordset(p_data->'results') as x(id bigint,lease uuid,status integer) loop
      update parent_push.deliveries set last_status=ack_result.status,
        state=case when ack_result.status between 200 and 299 then 'sent' when ack_result.status in (404,410) or (ack_result.status between 400 and 499 and ack_result.status not in (408,429)) or attempts>=6 then 'failed' else 'pending' end,
        available_at=now()+make_interval(secs=>least(3600,(power(2,attempts)*30)::integer)),
        finished_at=case when ack_result.status between 200 and 299 or ack_result.status in (404,410) then now() else null end
        where id=ack_result.id and lease=ack_result.lease and state='sending';
      get diagnostics affected = row_count;
      if affected>0 and ack_result.status in (404,410) then
        update parent_push.subscriptions s set enabled=false,updated_at=now() from parent_push.deliveries j where j.id=ack_result.id and j.subscription_id=s.id;
      end if;
    end loop;
    return '{"ok":true}';
  end if;
  raise exception 'Unknown worker operation';
end $$;
create or replace function public.parent_push_worker(p_action text,p_secret text,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select private.pp_worker(p_action,p_secret,p_data) $$;

revoke all on function public.parent_push(text,jsonb) from public,anon;
grant execute on function public.parent_push(text,jsonb) to authenticated;
revoke all on function public.parent_push_worker(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.parent_push_worker(text,text,jsonb) to service_role;
do $$ declare r record; begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'pp_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',r.fn);
  end loop;
end $$;
grant usage on schema private to authenticated,service_role;
grant execute on function private.pp_parent(text,jsonb) to authenticated;
grant execute on function private.pp_worker(text,text,jsonb) to service_role;

select cron.schedule('open-stars-parent-push','* * * * *',$$select private.pp_wake()$$);
select cron.schedule('open-stars-parent-payment-reminders','0 3 * * *',$$select private.pp_debt_reminders()$$);
-- Outbox is not a permanent duplicate of student records. Keep only 30 days of delivery diagnostics.
select cron.schedule('open-stars-parent-push-retention','20 3 * * *',$$delete from parent_push.deliveries where created_at < now()-interval '30 days'$$);
