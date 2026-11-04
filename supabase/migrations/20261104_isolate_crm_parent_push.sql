-- Isolate CRM push subscriptions from parent push subscriptions even on shared accounts.
alter table parent_push.subscriptions
  add column if not exists audience text not null default 'parent';
alter table parent_push.subscriptions
  drop constraint if exists subscriptions_audience_check;
alter table parent_push.subscriptions
  add constraint subscriptions_audience_check check (audience in ('parent','crm'));

-- Cancel CRM deliveries queued on previously shared root/parent subscriptions.
update parent_push.deliveries d set state='cancelled',finished_at=now()
from public.notifications n,parent_push.subscriptions s
where d.notification_id=n.id and d.subscription_id=s.id
  and n.target in ('crm_inbound','crm_push_test')
  and s.audience='parent' and d.state in ('pending','sending');

CREATE OR REPLACE FUNCTION public.crm_push(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_role text := private.current_role();
  v_endpoint text := p_data->>'endpoint';
  v_subscription parent_push.subscriptions%rowtype;
  v_key text;
  v_subid uuid;
begin
  if v_user is null or v_role not in ('owner','project_director','manager','sales','admin') then
    raise exception 'not authorized';
  end if;
  if p_action = 'config' then
    select public_key into v_key from parent_push.config where enabled = true;
    return jsonb_build_object('publicKey',v_key);
  end if;
  if p_action = 'unsubscribe' then
    if v_endpoint is null or length(v_endpoint)>4096 then raise exception 'invalid endpoint'; end if;
    delete from parent_push.subscriptions where user_id=v_user and endpoint=v_endpoint;
    return '{"ok":true}'::jsonb;
  end if;
  if p_action = 'subscribe' then
    if v_endpoint is null or length(v_endpoint)>4096
       or v_endpoint !~ '^https://(fcm[.]googleapis[.]com|[a-z0-9.-]+[.]push[.]apple[.]com|[a-z0-9.-]+[.]push[.]services[.]mozilla[.]com|[a-z0-9.-]+[.]notify[.]windows[.]com)/[^[:space:]]+$' then
      raise exception 'unsupported push endpoint';
    end if;
    if coalesce(p_data->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}=?$'
       or coalesce(p_data->>'auth','') !~ '^[A-Za-z0-9_-]{22}(==)?$' then
      raise exception 'invalid push keys';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_endpoint,0));
    select * into v_subscription from parent_push.subscriptions where endpoint=v_endpoint for update;
    if found and v_subscription.user_id<>v_user then
      if v_subscription.p256dh<>p_data->>'p256dh' or v_subscription.auth_key<>p_data->>'auth' then
        raise exception 'device key mismatch';
      end if;
      delete from parent_push.subscriptions where id=v_subscription.id;
    end if;
    insert into parent_push.subscriptions(user_id,endpoint,p256dh,auth_key,audience)
    values(v_user,v_endpoint,p_data->>'p256dh',p_data->>'auth','crm')
    on conflict(endpoint) do update set user_id=v_user,p256dh=excluded.p256dh,auth_key=excluded.auth_key,audience='crm',enabled=true,updated_at=now()
    returning * into v_subscription;
    return jsonb_build_object('id',v_subscription.id);
  end if;
  if p_action = 'test' then
    select id into v_subid from parent_push.subscriptions
      where user_id=v_user and enabled=true and audience='crm' order by updated_at desc limit 1;
    if v_subid is null then raise exception 'enable notifications first'; end if;
    insert into public.notifications(recipient_user_id,title,body,target,push_context)
    values (v_user,'Проверка уведомлений CRM','Тестовое уведомление','crm_push_test',
      jsonb_build_object('subscription_id',v_subid::text));
    return '{"ok":true}'::jsonb;
  end if;
  raise exception 'unknown push operation';
end
$function$
;

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
    if n.target not in ('news','coins','progress','homework','comments','payments','feedback','push_test') then return null; end if;
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
    insert into parent_push.subscriptions(user_id,endpoint,p256dh,auth_key,audience)
    values(u,ep,p_data->>'p256dh',p_data->>'auth','parent')
    on conflict(endpoint) do update set user_id=u,p256dh=excluded.p256dh,auth_key=excluded.auth_key,audience='parent',enabled=true,updated_at=now()
    returning * into s;
    return jsonb_build_object('id',s.id);
  end if;
  raise exception 'Unknown push operation';
end $function$
;

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
    and ((n.target in ('crm_inbound','crm_push_test') and s.audience='crm')
      or (n.target not in ('crm_inbound','crm_push_test') and s.audience='parent'))
  where n.target in ('news','coins','progress','homework','comments','payments','feedback','push_test','crm_inbound','crm_push_test')
    and (n.target not in ('push_test','crm_push_test') or n.push_context->>'subscription_id'=s.id::text)
  on conflict do nothing;
  perform private.pp_wake();
  return null;
end $function$
;
