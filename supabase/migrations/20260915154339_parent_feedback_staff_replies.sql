create table public.parent_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.parent_feedback(id) on delete cascade,
  staff_profile_id uuid references public.users_profile(id) on delete set null,
  staff_name_snapshot text not null,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now(),
  request_id uuid not null unique
);
create index parent_feedback_replies_feedback_date_idx on public.parent_feedback_replies(feedback_id, created_at, id);
create index parent_feedback_replies_staff_idx on public.parent_feedback_replies(staff_profile_id);
alter table public.parent_feedback_replies enable row level security;
revoke all on public.parent_feedback_replies from public, anon, authenticated;
grant select on public.parent_feedback_replies to authenticated;

create or replace function private.parent_owns_feedback(p_feedback_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.parent_feedback f
    join public.users_profile u on u.id = f.parent_profile_id
    where f.id = p_feedback_id and u.auth_user_id = (select auth.uid())
      and private.parent_can_access_child(f.child_id)
  );
$$;
revoke all on function private.parent_owns_feedback(uuid) from public, anon;
grant execute on function private.parent_owns_feedback(uuid) to authenticated;

create policy parent_feedback_parent_select on public.parent_feedback
for select to authenticated using (private.parent_owns_feedback(id));

create policy parent_feedback_replies_select on public.parent_feedback_replies
for select to authenticated using (
  exists (select 1 from public.parent_feedback f where f.id = feedback_id)
);

create or replace function public.parent_list_feedback(p_child_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'category', f.category, 'message', f.message, 'status', f.status,
    'created_at', f.created_at,
    'replies', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'staff_name_snapshot', r.staff_name_snapshot,
      'message', r.message, 'created_at', r.created_at
    ) order by r.created_at, r.id), '[]'::jsonb)
    from public.parent_feedback_replies r where r.feedback_id = f.id)
  ) order by f.created_at desc, f.id), '[]'::jsonb)
  from public.parent_feedback f
  where f.child_id = p_child_id and private.parent_owns_feedback(f.id);
$$;
revoke all on function public.parent_list_feedback(uuid) from public, anon;
grant execute on function public.parent_list_feedback(uuid) to authenticated;

create or replace function private.reply_parent_feedback(p_feedback_id uuid, p_message text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text := private.current_role();
  v_staff public.users_profile%rowtype;
  v_feedback public.parent_feedback%rowtype;
  v_reply public.parent_feedback_replies%rowtype;
  v_recipient uuid;
  v_message text := btrim(p_message);
begin
  if auth.uid() is null or coalesce(v_role, '') not in ('owner','manager','project_director','admin') then
    raise exception 'Нет доступа к ответам родителям.';
  end if;
  if p_request_id is null or coalesce(char_length(v_message), 0) not between 1 and 2000 then
    raise exception 'Введите ответ от 1 до 2000 символов.';
  end if;
  select * into v_staff from public.users_profile where auth_user_id = auth.uid();
  select * into v_feedback from public.parent_feedback where id = p_feedback_id for update;
  if not found or (v_role = 'admin' and v_feedback.branch_snapshot is distinct from private.current_staff_branch()) then
    raise exception 'Обращение недоступно.';
  end if;
  select * into v_reply from public.parent_feedback_replies where request_id = p_request_id;
  if found then
    if v_reply.feedback_id <> p_feedback_id or v_reply.staff_profile_id is distinct from v_staff.id or v_reply.message <> v_message then
      raise exception 'Этот запрос уже использован для другого ответа.';
    end if;
  else
    select u.auth_user_id into v_recipient from public.users_profile u
    join public.family_members fm on fm.user_id = u.id
    join public.children c on c.family_id = fm.family_id
    where u.id = v_feedback.parent_profile_id and c.id = v_feedback.child_id
      and c.archived_at is null and u.auth_user_id is not null limit 1;
    if v_recipient is null then
      raise exception 'У родителя больше нет доступа к кабинету этого ребёнка.';
    end if;
    insert into public.parent_feedback_replies(feedback_id, staff_profile_id, staff_name_snapshot, message, request_id)
    values (p_feedback_id, v_staff.id, coalesce(nullif(btrim(v_staff.full_name), ''), 'Команда OPEN STARS'), v_message, p_request_id)
    returning * into v_reply;
    update public.parent_feedback set
      status = case when status = 'new' then 'read' else status end,
      read_at = coalesce(read_at, now()), handled_by = v_staff.id
    where id = p_feedback_id;
    insert into public.notifications(recipient_user_id, title, body, target, target_id, child_id, dedupe_key, push_context)
    values (v_recipient, 'Ответ школы на ваше обращение',
      'В разделе «Обратная связь» появился ответ на ваше сообщение.',
      'feedback', p_feedback_id, v_feedback.child_id, 'feedback_reply:' || v_reply.id::text,
      jsonb_build_object('reply_id', v_reply.id));
  end if;
  return jsonb_build_object('id', v_reply.id, 'staff_name_snapshot', v_reply.staff_name_snapshot,
    'message', v_reply.message, 'created_at', v_reply.created_at);
end;
$$;
revoke all on function private.reply_parent_feedback(uuid, text, uuid) from public, anon;
grant execute on function private.reply_parent_feedback(uuid, text, uuid) to authenticated;

create or replace function public.staff_reply_parent_feedback(p_feedback_id uuid, p_message text, p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.reply_parent_feedback(p_feedback_id, p_message, p_request_id);
$$;
revoke all on function public.staff_reply_parent_feedback(uuid, text, uuid) from public, anon;
grant execute on function public.staff_reply_parent_feedback(uuid, text, uuid) to authenticated;

-- Keep the existing deletion action, with an explicit anonymous/unknown-role guard.
create or replace function public.staff_delete_feedback(p_feedback_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_role text := private.current_role(); v_branch text;
begin
  if auth.uid() is null or coalesce(v_role, '') not in ('owner','project_director','manager','admin') then
    raise exception 'not authorized';
  end if;
  select branch_snapshot into v_branch from public.parent_feedback where id = p_feedback_id for update;
  if not found then raise exception 'feedback not found'; end if;
  if v_role = 'admin' and v_branch is distinct from private.current_staff_branch() then raise exception 'not authorized'; end if;
  -- Remove notifications along with a deliberately deleted test conversation.
  delete from public.notifications where target = 'feedback' and target_id = p_feedback_id;
  delete from public.parent_feedback where id = p_feedback_id;
  return p_feedback_id;
end;
$$;
revoke all on function public.staff_delete_feedback(uuid) from public, anon;
grant execute on function public.staff_delete_feedback(uuid) to authenticated;
CREATE OR REPLACE FUNCTION private.pp_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into parent_push.deliveries(notification_id,subscription_id)
  select n.id,s.id from inserted_notifications n
  join parent_push.subscriptions s on s.user_id=n.recipient_user_id and s.enabled
  where n.target in ('news','coins','progress','homework','comments','payments','feedback','push_test')
    and (n.target<>'push_test' or n.push_context->>'subscription_id'=s.id::text)
  on conflict do nothing;
  perform private.pp_wake();
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.pp_deliverable(p_id uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n public.notifications%rowtype; j jsonb; begin
  select * into n from public.notifications where id=p_id and recipient_user_id=p_user;
  if not found then return false; end if;
  if n.target='push_test' then return true; end if;
  if n.target='feedback' then
    return exists (
      select 1 from public.parent_feedback f
      join public.parent_feedback_replies r on r.feedback_id=f.id
      join public.users_profile u on u.id=f.parent_profile_id
      where f.id=n.target_id and r.id::text=n.push_context->>'reply_id'
        and u.auth_user_id=p_user and n.child_id=f.child_id
        and private.pp_has_child(p_user,f.child_id)
    );
  end if;
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
end $function$;

CREATE OR REPLACE FUNCTION private.pp_parent(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if n.target='feedback' and not private.pp_deliverable(n.id,u) then return null; end if;
    update public.notifications set is_read=true where id=n.id;
    return jsonb_build_object('tab',case when n.target='push_test' then 'news' else n.target end,'childId',cid,'feedbackId',case when n.target='feedback' then n.target_id end);
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
end $function$;

notify pgrst, 'reload schema';
