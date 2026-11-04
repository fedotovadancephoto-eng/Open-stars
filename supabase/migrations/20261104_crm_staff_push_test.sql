-- Add isolated CRM push self-test, without broadcasting to parent subscriptions.
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
    insert into parent_push.subscriptions(user_id,endpoint,p256dh,auth_key)
    values(v_user,v_endpoint,p_data->>'p256dh',p_data->>'auth')
    on conflict(endpoint) do update set user_id=v_user,p256dh=excluded.p256dh,auth_key=excluded.auth_key,enabled=true,updated_at=now()
    returning * into v_subscription;
    return jsonb_build_object('id',v_subscription.id);
  end if;
  if p_action = 'test' then
    select id into v_subid from parent_push.subscriptions
      where user_id=v_user and enabled=true order by updated_at desc limit 1;
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
    return exists (select 1 from public.users_profile u join public.roles r on r.id=u.role_id where u.auth_user_id=p_user and r.name in ('owner','project_director','manager','sales','admin'));
  end if;
  if n.target='crm_inbound' then
    return exists (
      select 1 from public.crm_inbound_items i
      join public.users_profile u on u.auth_user_id=p_user
      join public.roles r on r.id=u.role_id
      where i.id=n.target_id and i.status='new'
        and (r.name in ('owner','project_director','manager','sales')
          or (r.name='admin' and i.branch is not null and i.branch=u.staff_branch))
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
  where n.target in ('news','coins','progress','homework','comments','payments','feedback','push_test','crm_inbound','crm_push_test')
    and (n.target not in ('push_test','crm_push_test') or n.push_context->>'subscription_id'=s.id::text)
  on conflict do nothing;
  perform private.pp_wake();
  return null;
end $function$
;
