-- Server-side CRM alert functions restricted to owner, manager, sales.
CREATE OR REPLACE FUNCTION private.crm_inbound_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status <> 'new' then return new; end if;
  insert into public.notifications(recipient_user_id,title,body,target,target_id,dedupe_key,push_context)
  select u.auth_user_id,
    case new.source when 'site' then 'Новая заявка с сайта'
      when 'vk' then 'Новое обращение ВКонтакте'
      else 'Новое обращение OPEN STARS' end,
    'Откройте CRM → Входящие обращения',
    'crm_inbound',new.id,
    'crm-inbound:' || new.id::text || ':' || u.auth_user_id::text,
    jsonb_build_object('source',new.source)
  from public.users_profile u
  join public.roles r on r.id=u.role_id
  where u.auth_user_id is not null
    and r.name in ('owner','manager','sales')
  on conflict do nothing;
  return new;
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

CREATE OR REPLACE FUNCTION public.crm_process_inbound(p_inbound_id uuid, p_action text, p_branch text DEFAULT NULL::text, p_child_name text DEFAULT NULL::text, p_parent_name text DEFAULT NULL::text, p_parent_phone text DEFAULT NULL::text, p_next_contact_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.current_role();
  v_actor uuid := private.crm_actor_profile_id();
  v_item public.crm_inbound_items%rowtype;
  v_branch text;
  v_result jsonb;
  v_source text;
begin
  if auth.uid() is null or v_role not in ('owner', 'manager', 'sales') or v_actor is null then
    raise exception 'not authorized';
  end if;
  if p_action not in ('ignore', 'convert') then raise exception 'invalid action'; end if;

  select * into v_item from public.crm_inbound_items where id = p_inbound_id for update;
  if not found then raise exception 'inbound item not found'; end if;
  if v_role = 'admin' and v_item.branch is distinct from private.current_staff_branch() then
    raise exception 'not authorized';
  end if;
  if v_item.status <> 'new' then raise exception 'inbound item already processed'; end if;

  if p_action = 'ignore' then
    update public.crm_inbound_items
    set status = 'ignored', reviewed_by = v_actor, reviewed_at = now()
    where id = v_item.id;
    return jsonb_build_object('id', v_item.id, 'status', 'ignored');
  end if;

  v_branch := case when v_role = 'admin' then private.current_staff_branch()
                   else coalesce(nullif(trim(p_branch), ''), v_item.branch) end;
  if v_branch not in ('Свердловский', 'НЛО', 'Октябрьский') then raise exception 'invalid branch'; end if;
  v_source := case v_item.source when 'site' then 'Сайт'
                                when 'vk' then 'VK'
                                when 'instagram' then 'Instagram' end;

  v_result := public.crm_create_lead(
    v_branch,
    p_child_name,
    null::date,
    p_parent_name,
    p_parent_phone,
    v_source,
    'Входящие · ' || v_item.event_type || coalesce(' · ' || nullif(v_item.form_id, ''), ''),
    nullif(v_item.campaign, ''),
    null::timestamptz,
    coalesce(p_next_contact_at, now() + interval '1 day'),
    left(coalesce(v_item.message, ''), 1000),
    null::uuid
  );

  update public.crm_inbound_items
  set status = 'converted', crm_lead_id = (v_result->>'id')::uuid,
      reviewed_by = v_actor, reviewed_at = now()
  where id = v_item.id;

  return jsonb_build_object('id', v_item.id, 'status', 'converted', 'lead_id', v_result->>'id');
end;
$function$
;

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
  if v_user is null or v_role not in ('owner','manager','sales') then
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