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
  where n.target in ('documents','news','coins','progress','homework','comments','payments','feedback','push_test','crm_inbound','crm_push_test')
    and (n.target not in ('push_test','crm_push_test') or n.push_context->>'subscription_id'=s.id::text)
  on conflict do nothing;
  perform private.pp_wake();
  return null;
end $function$
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
    if n.target not in ('documents','news','coins','progress','homework','comments','payments','feedback','push_test') then return null; end if;
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
CREATE OR REPLACE FUNCTION private.pp_deliverable(p_id uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n public.notifications%rowtype; j jsonb; begin
  select * into n from public.notifications where id=p_id and recipient_user_id=p_user;
  if not found then return false; end if;
  if n.target='crm_push_test' then
    return exists (select 1 from public.users_profile u join public.roles r on r.id=u.role_id where u.auth_user_id=p_user and r.name in ('owner','manager','sales'));
  end if;
  if n.target='crm_inbound' then
    return exists (
      select 1 from public.crm_inbound_items i
      join public.users_profile u on u.auth_user_id=p_user
      join public.roles r on r.id=u.role_id
      where i.id=n.target_id and i.status='new'
        and r.name in ('owner','manager','sales')
    );
  end if;

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
  if n.target='documents' then
    return exists(select 1 from public.children c where private.pp_has_child(p_user,c.id));
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
end $function$
;

