create table private.temporary_staff_access (
 profile_id uuid not null references public.users_profile(id) on delete cascade,
 context_key text not null,
 branch text not null check (branch in ('Октябрьский','НЛО','Свердловский')),
 starts_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 reason text not null,
 created_at timestamptz not null default now(),
 primary key(profile_id,context_key),
 check (expires_at > starts_at)
);
alter table private.temporary_staff_access enable row level security;
revoke all on private.temporary_staff_access from public, anon, authenticated;

create or replace function private.requested_staff_context() returns text
language sql stable set search_path='' as $$
 select nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-openstars-staff-context',''),'')
$$;
revoke all on function private.requested_staff_context() from public,anon;
grant execute on function private.requested_staff_context() to authenticated,service_role;

create or replace function private.temporary_staff_branch() returns text
language plpgsql stable security definer set search_path='' as $$
declare v_key text := private.requested_staff_context(); v_branch text;
begin
 if v_key is null then return null; end if;
 select g.branch into v_branch from private.temporary_staff_access g
 join public.users_profile up on up.id=g.profile_id
 join public.roles r on r.id=up.role_id
 where up.auth_user_id=auth.uid() and r.name in ('admin','sales')
 and g.context_key=v_key and g.revoked_at is null and g.starts_at<=now() and g.expires_at>now();
 if v_branch is null then
   raise sqlstate '42501' using message='Временный доступ завершён или недоступен. Вернитесь к основной роли.';
 end if;
 return v_branch;
end $$;
revoke all on function private.temporary_staff_branch() from public,anon;
grant execute on function private.temporary_staff_branch() to authenticated,service_role;

create or replace function private.current_role() returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if private.requested_staff_context() is not null then
   perform private.temporary_staff_branch();
   return 'admin';
 end if;
 return (select r.name from public.users_profile up join public.roles r on r.id=up.role_id where up.auth_user_id=auth.uid() limit 1);
end $$;

create or replace function private.current_staff_branch() returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if private.requested_staff_context() is not null then return private.temporary_staff_branch(); end if;
 return (select up.staff_branch from public.users_profile up where up.auth_user_id=auth.uid() limit 1);
end $$;

create or replace function public.staff_access_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid; v_role text; v_branch text; v_grants jsonb; v_selected text; v_active text;
begin
 if auth.uid() is null then raise sqlstate '42501' using message='Authentication required'; end if;
 select up.id,r.name,up.staff_branch into v_id,v_role,v_branch
 from public.users_profile up join public.roles r on r.id=up.role_id where up.auth_user_id=auth.uid() limit 1;
 if v_id is null or v_role not in ('owner','project_director','manager','admin','teacher','sales','marketer') then
   raise sqlstate '42501' using message='Staff access required';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',g.context_key,'branch',g.branch,'expiresAt',g.expires_at) order by g.branch),'[]'::jsonb)
 into v_grants from private.temporary_staff_access g where g.profile_id=v_id
 and v_role in ('admin','sales') and g.revoked_at is null and g.starts_at<=now() and g.expires_at>now();
 v_selected:=private.requested_staff_context();
 select item->>'branch' into v_active from jsonb_array_elements(v_grants) item where item->>'key'=v_selected;
 return jsonb_build_object('baseRole',v_role,'baseBranch',v_branch,'grants',v_grants,
   'selectedValid',v_selected is null or v_active is not null,
   'role',case when v_active is not null then 'admin' else v_role end,
   'branch',coalesce(v_active,v_branch));
end $$;
revoke all on function public.staff_access_context() from public,anon;
grant execute on function public.staff_access_context() to authenticated;

CREATE OR REPLACE FUNCTION public.staff_quick_create_student(p_first_name text, p_last_name text, p_parent_name text, p_parent_phone text, p_branch text, p_group_name text, p_birth_date date DEFAULT NULL::date, p_lesson_day text DEFAULT NULL::text, p_lesson_time text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text)
 RETURNS TABLE(child_id uuid, family_id uuid, parent_profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text; v_staff_branch text; v_phone text; v_parent_id uuid; v_family_id uuid; v_child_id uuid; v_admin_name text;
begin
  select private.current_role(), private.current_staff_branch() into v_role, v_staff_branch
  from public.users_profile up join public.roles r on r.id=up.role_id
  where up.auth_user_id=(select auth.uid()) limit 1;
  if v_role not in ('owner','project_director','admin','manager') then raise exception 'not authorized'; end if;
  if v_role='admin' and p_branch is distinct from v_staff_branch then raise exception 'wrong branch'; end if;
  if nullif(btrim(p_first_name),'') is null or nullif(btrim(p_last_name),'') is null then raise exception 'child name is required'; end if;
  if nullif(btrim(p_parent_name),'') is null then raise exception 'parent name is required'; end if;
  v_phone:=public.normalize_phone(p_parent_phone); if v_phone is null then raise exception 'invalid phone'; end if;
  if p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  if p_group_name not in ('Базовый','Продвинутый','PRO') then raise exception 'invalid group'; end if;
  v_admin_name:=case p_branch when 'НЛО' then 'Белова Марина' when 'Свердловский' then 'Додарчук Светлана' when 'Октябрьский' then 'Кошкина Юлия' end;
  select up.id into v_parent_id from public.users_profile up where up.phone_normalized=v_phone or up.phone=v_phone order by up.created_at asc limit 1;
  if v_parent_id is null then
    insert into public.users_profile(phone,phone_normalized,full_name,role_id)
    values(v_phone,v_phone,btrim(p_parent_name),(select id from public.roles where name='parent' limit 1)) returning id into v_parent_id;
  else
    update public.users_profile set full_name=coalesce(nullif(full_name,''),btrim(p_parent_name)), phone_normalized=coalesce(phone_normalized,v_phone) where id=v_parent_id;
  end if;
  select fm.family_id into v_family_id from public.family_members fm where fm.user_id=v_parent_id order by fm.id limit 1;
  if v_family_id is null then
    insert into public.families(name) values(btrim(p_last_name)||' — '||btrim(p_parent_name)) returning id into v_family_id;
    insert into public.family_members(family_id,user_id,relationship) values(v_family_id,v_parent_id,'parent');
  end if;
  perform 1 from public.families where id=v_family_id for update;
  if exists(select 1 from public.children c where c.family_id=v_family_id and ((private.crm_child_name_key(c.first_name)=private.crm_child_name_key(p_first_name) and private.crm_child_name_key(c.last_name)=private.crm_child_name_key(p_last_name)) or (private.crm_child_name_key(c.first_name)=private.crm_child_name_key(p_last_name) and private.crm_child_name_key(c.last_name)=private.crm_child_name_key(p_first_name))) and c.archived_at is null) then raise exception 'student already exists'; end if;
  insert into public.children(family_id,first_name,last_name,birth_date,group_name,branch,lesson_day,lesson_time,mentor_name,photo_url,level)
  values(v_family_id,btrim(p_first_name),btrim(p_last_name),p_birth_date,p_group_name,p_branch,nullif(btrim(coalesce(p_lesson_day,'')),''),nullif(btrim(coalesce(p_lesson_time,'')),''),v_admin_name,nullif(btrim(coalesce(p_photo_url,'')),''),null)
  returning id into v_child_id;
  return query select v_child_id,v_family_id,v_parent_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.staff_academic_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_branch text; v_name text; v_assign jsonb;
begin
  select private.current_role(),private.current_staff_branch(),coalesce(up.staff_display_name,up.full_name,'Преподаватель')
  into v_role,v_branch,v_name
  from public.users_profile up join public.roles r on r.id=up.role_id
  where up.auth_user_id=(select auth.uid()) limit 1;
  if v_role not in ('owner','project_director','manager','admin','teacher') then raise exception 'not authorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('branch',ta.branch,'groupName',ta.group_name,'subject',ta.subject)),'[]'::jsonb)
  into v_assign from public.teacher_assignments ta where ta.teacher_user_id=(select auth.uid());
  return jsonb_build_object('role',v_role,'staffBranch',coalesce(v_branch,''),'staffName',v_name,'assignments',v_assign);
end $function$;
CREATE OR REPLACE FUNCTION public.staff_list_students_for_archive()
 RETURNS TABLE(child_id uuid, first_name text, last_name text, branch text, group_name text, archived_at timestamp with time zone, archive_reason text, parent_name text, parent_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_branch text;
begin
  select private.current_role(), private.current_staff_branch() into v_role, v_branch
  from public.users_profile up join public.roles r on r.id=up.role_id
  where up.auth_user_id=(select auth.uid()) limit 1;
  if v_role not in ('owner','project_director','admin','manager') then raise exception 'not authorized'; end if;

  return query
  select c.id,c.first_name,c.last_name,c.branch,c.group_name,c.archived_at,c.archive_reason,
         coalesce(parent_up.full_name,invite.full_name),coalesce(parent_up.phone,invite.phone)
  from public.children c
  left join lateral (
    select up.full_name,up.phone
    from public.family_members fm join public.users_profile up on up.id=fm.user_id
    where fm.family_id=c.family_id
    order by case when fm.relationship='parent' then 0 else 1 end, fm.id limit 1
  ) parent_up on true
  left join lateral (
    select pi.full_name,pi.phone
    from public.parent_invites pi
    where pi.family_id=c.family_id and pi.revoked_at is null
    order by pi.created_at desc limit 1
  ) invite on true
  where v_role in ('owner','project_director','manager') or c.branch=v_branch
  order by c.archived_at nulls first,c.last_name,c.first_name;
end;
$function$;
CREATE OR REPLACE FUNCTION public.staff_list_students_for_archive_v2()
 RETURNS TABLE(child_id uuid, first_name text, last_name text, branch text, group_name text, archived_at timestamp with time zone, archive_reason text, parent_name text, parent_phone text, refundable_amount numeric, latest_payment_month date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_branch text;
begin
  select private.current_role(), private.current_staff_branch()
    into v_role, v_branch
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.auth_user_id = (select auth.uid())
  limit 1;

  if v_role not in ('owner', 'project_director', 'admin', 'manager') then
    raise exception 'not authorized';
  end if;

  return query
  select
    c.id,
    c.first_name,
    c.last_name,
    c.branch,
    c.group_name,
    c.archived_at,
    c.archive_reason,
    coalesce(parent_up.full_name, invite.full_name),
    coalesce(parent_up.phone, invite.phone),
    coalesce(tuition.refundable_amount, 0),
    tuition.latest_payment_month
  from public.children c
  left join lateral (
    select up.full_name, up.phone
    from public.family_members fm
    join public.users_profile up on up.id = fm.user_id
    where fm.family_id = c.family_id
    order by case when fm.relationship = 'parent' then 0 else 1 end, fm.id
    limit 1
  ) parent_up on true
  left join lateral (
    select pi.full_name, pi.phone
    from public.parent_invites pi
    where pi.family_id = c.family_id
      and pi.revoked_at is null
    order by pi.created_at desc
    limit 1
  ) invite on true
  left join lateral (
    select
      sum(pr.amount)::numeric as refundable_amount,
      max(p.month)::date as latest_payment_month
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    where pr.child_id = c.id
      and pr.voided_at is null
      and pr.refunded_at is null
  ) tuition on true
  where v_role in ('owner', 'project_director', 'manager')
     or c.branch = v_branch
  order by c.archived_at nulls first, c.last_name, c.first_name;
end;
$function$;
CREATE OR REPLACE FUNCTION public.staff_generate_parent_password_reset(p_child_id uuid, p_valid_minutes integer DEFAULT 60)
 RETURNS TABLE(child_id uuid, family_id uuid, parent_profile_id uuid, parent_name text, phone text, reset_code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_profile_id uuid;
  v_actor_role text;
  v_actor_branch text;
  v_family_id uuid;
  v_child_branch text;
  v_parent_profile_id uuid;
  v_parent_name text;
  v_parent_phone text;
  v_parent_phone_normalized text;
  v_parent_auth_user_id uuid;
  v_code text;
  v_expires timestamptz;
begin
  select up.id, private.current_role(), private.current_staff_branch()
    into v_actor_profile_id, v_actor_role, v_actor_branch
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.auth_user_id = auth.uid()
  limit 1;

  if v_actor_role not in ('owner', 'project_director', 'admin', 'manager') then
    raise exception 'not authorized';
  end if;

  select c.family_id, c.branch
    into v_family_id, v_child_branch
  from public.children c
  where c.id = p_child_id
    and c.archived_at is null
  limit 1;

  if v_family_id is null then
    raise exception 'child not found';
  end if;

  if v_actor_role = 'admin' and coalesce(v_child_branch, '') <> coalesce(v_actor_branch, '') then
    raise exception 'not authorized for family';
  end if;

  select up.id, up.full_name, up.phone, up.phone_normalized, up.auth_user_id
    into v_parent_profile_id, v_parent_name, v_parent_phone, v_parent_phone_normalized, v_parent_auth_user_id
  from public.family_members fm
  join public.users_profile up on up.id = fm.user_id
  join public.roles r on r.id = up.role_id
  where fm.family_id = v_family_id
    and r.name = 'parent'
    and up.auth_user_id is not null
  limit 1;

  if v_parent_profile_id is null or v_parent_auth_user_id is null then
    raise exception 'parent not active';
  end if;

  if v_parent_phone_normalized is null or btrim(v_parent_phone_normalized) = '' then
    raise exception 'parent phone missing';
  end if;

  v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
  v_expires := now() + make_interval(mins => greatest(15, least(coalesce(p_valid_minutes, 60), 1440)));

  insert into public.parent_password_resets as ppr (
    parent_profile_id,
    phone_normalized,
    reset_code_hash,
    expires_at,
    attempt_count,
    max_attempts,
    used_at,
    revoked_at,
    created_by_profile_id,
    created_at,
    updated_at
  ) values (
    v_parent_profile_id,
    v_parent_phone_normalized,
    extensions.crypt(v_code, extensions.gen_salt('bf', 10)),
    v_expires,
    0,
    5,
    null,
    null,
    v_actor_profile_id,
    now(),
    now()
  )
  on conflict on constraint parent_password_resets_parent_profile_id_key do update
  set phone_normalized = excluded.phone_normalized,
      reset_code_hash = excluded.reset_code_hash,
      expires_at = excluded.expires_at,
      attempt_count = 0,
      max_attempts = 5,
      used_at = null,
      revoked_at = null,
      created_by_profile_id = excluded.created_by_profile_id,
      created_at = now(),
      updated_at = now();

  return query
  select p_child_id, v_family_id, v_parent_profile_id, coalesce(v_parent_name, 'Родитель'), v_parent_phone, v_code, v_expires;
end;
$function$;
CREATE OR REPLACE FUNCTION public.staff_upsert_contract_terms(p_child_id uuid, p_start_date date, p_end_date date, p_monthly_price numeric, p_total_price numeric DEFAULT NULL::numeric, p_tariff_name text DEFAULT 'Индивидуальный'::text, p_tariff_description text DEFAULT 'Обучение по программе OPEN STARS согласно расписанию.'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff_id uuid;
  v_staff_branch text;
  v_role text;
  v_branch text;
  v_months int;
  v_total numeric;
begin
  select up.id,private.current_staff_branch(),private.current_role() into v_staff_id,v_staff_branch,v_role
  from public.users_profile up join public.roles r on r.id=up.role_id
  where up.auth_user_id=auth.uid();
  if v_staff_id is null or v_role not in ('owner','manager','admin') then raise exception 'staff access denied'; end if;
  select c.branch into v_branch from public.children c where c.id=p_child_id and c.archived_at is null;
  if v_branch is null then raise exception 'child not found'; end if;
  if v_role='admin' and v_branch is distinct from v_staff_branch then raise exception 'branch access denied'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'invalid study dates'; end if;
  if p_monthly_price is null or p_monthly_price<=0 then raise exception 'invalid monthly price'; end if;
  v_months:=greatest(1,(extract(year from age(p_end_date,p_start_date))::int*12 + extract(month from age(p_end_date,p_start_date))::int + 1));
  v_total:=coalesce(p_total_price,p_monthly_price*v_months);
  insert into public.child_contract_terms(child_id,start_date,end_date,monthly_price,total_price,tariff_name,tariff_description,updated_by_profile_id,updated_at)
  values(p_child_id,p_start_date,p_end_date,p_monthly_price,v_total,coalesce(nullif(trim(p_tariff_name),''),'Индивидуальный'),coalesce(nullif(trim(p_tariff_description),''),'Обучение по программе OPEN STARS согласно расписанию.'),v_staff_id,now())
  on conflict(child_id) do update set start_date=excluded.start_date,end_date=excluded.end_date,monthly_price=excluded.monthly_price,total_price=excluded.total_price,tariff_name=excluded.tariff_name,tariff_description=excluded.tariff_description,updated_by_profile_id=v_staff_id,updated_at=now();
end$function$;
CREATE OR REPLACE FUNCTION public.staff_document_registry(p_branch text DEFAULT NULL::text)
 RETURNS TABLE(child_id uuid, child_name text, branch text, parent_name text, parent_phone text, terms_ready boolean, monthly_price numeric, total_price numeric, start_date date, end_date date, esign_status text, personal_data_status text, contract_status text, photo_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff_id uuid;
  v_staff_branch text;
  v_role text;
begin
  select up.id, private.current_staff_branch(), private.current_role() into v_staff_id, v_staff_branch, v_role
  from public.users_profile up join public.roles r on r.id=up.role_id
  where up.auth_user_id=auth.uid();
  if v_staff_id is null or v_role not in ('owner','manager','admin') then raise exception 'staff access denied'; end if;
  return query
  select c.id,
         trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,''))::text,
         coalesce(c.branch,'')::text,
         coalesce(pp.full_name,'')::text,
         coalesce(pp.phone,'')::text,
         (ct.child_id is not null), ct.monthly_price, ct.total_price, ct.start_date, ct.end_date,
         coalesce((select s.decision from public.parent_document_signatures s where s.child_id=c.id and s.profile_id=pp.id and s.code='esign_agreement' order by s.signed_at desc limit 1),'pending')::text,
         coalesce((select s.decision from public.parent_document_signatures s where s.child_id=c.id and s.profile_id=pp.id and s.code='personal_data' order by s.signed_at desc limit 1),'pending')::text,
         coalesce((select s.decision from public.parent_document_signatures s where s.child_id=c.id and s.profile_id=pp.id and s.code='education_contract' order by s.signed_at desc limit 1),'pending')::text,
         coalesce((select s.decision from public.parent_document_signatures s where s.child_id=c.id and s.profile_id=pp.id and s.code='photo_video' order by s.signed_at desc limit 1),'pending')::text
  from public.children c
  left join public.child_contract_terms ct on ct.child_id=c.id
  left join lateral (
    select up2.*
    from public.family_members fm
    join public.users_profile up2 on up2.id=fm.user_id
    where fm.family_id=c.family_id
    order by case when coalesce(fm.relationship,'') ilike '%parent%' then 0 else 1 end, fm.id
    limit 1
  ) pp on true
  where c.archived_at is null
    and (v_role <> 'admin' or c.branch = v_staff_branch)
    and (v_role = 'admin' or nullif(trim(coalesce(p_branch,'')),'') is null or c.branch=p_branch)
  order by c.branch,c.last_name,c.first_name;
end$function$;
CREATE OR REPLACE FUNCTION public.service_create_parent_invite(p_actor_auth_user_id uuid, p_family_id uuid, p_phone text, p_full_name text, p_valid_hours integer DEFAULT 168)
 RETURNS TABLE(profile_id uuid, invite_id uuid, activation_code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_role text;
  v_actor_branch text;
  v_phone text;
  v_profile_id uuid;
  v_invite_id uuid;
  v_code text;
  v_expires timestamptz;
  v_existing_auth uuid;
begin
  select r.name, up.staff_branch
    into v_actor_role, v_actor_branch
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.auth_user_id = p_actor_auth_user_id
  limit 1;

  if v_actor_role not in ('owner', 'project_director', 'admin', 'manager', 'sales') then
    raise exception 'not authorized';
  end if;

  -- Service-only endpoint: verify a current grant for this exact family.
  if v_actor_role in ('admin','sales') then
    select g.branch into v_actor_branch
    from private.temporary_staff_access g
    join public.users_profile up on up.id=g.profile_id
    where up.auth_user_id=p_actor_auth_user_id
      and g.revoked_at is null and g.starts_at<=now() and g.expires_at>now()
      and exists (select 1 from public.children c where c.family_id=p_family_id and c.branch=g.branch and c.archived_at is null)
    limit 1;
    if found then v_actor_role:='admin';
    else select up.staff_branch into v_actor_branch from public.users_profile up where up.auth_user_id=p_actor_auth_user_id limit 1;
    end if;
  end if;

  if not exists (select 1 from public.families f where f.id = p_family_id) then
    raise exception 'family not found';
  end if;

  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then raise exception 'invalid phone format'; end if;
  if p_full_name is null or btrim(p_full_name) = '' then raise exception 'full name is required'; end if;

  if v_actor_role = 'admin' and not exists (
    select 1
    from public.children c
    where c.family_id = p_family_id
      and c.branch = v_actor_branch
      and c.archived_at is null
  ) then
    raise exception 'not authorized for family';
  end if;

  if v_actor_role = 'sales' then
    if v_actor_branch is not null and not exists (
      select 1
      from public.children c
      where c.family_id = p_family_id
        and c.branch = v_actor_branch
        and c.archived_at is null
    ) then
      raise exception 'not authorized for family';
    end if;

    if not exists (
      select 1
      from public.family_members fm
      join public.users_profile up on up.id = fm.user_id
      where fm.family_id = p_family_id
        and fm.relationship = 'parent'
        and public.normalize_phone(up.phone) = v_phone
    ) and not exists (
      select 1
      from public.parent_invites pi
      where pi.family_id = p_family_id
        and pi.phone_normalized = v_phone
    ) then
      raise exception 'not authorized for parent phone';
    end if;
  end if;

  select up.id, up.auth_user_id
    into v_profile_id, v_existing_auth
  from public.users_profile up
  where up.phone_normalized = v_phone
  limit 1;

  if v_existing_auth is not null then raise exception 'phone already registered'; end if;

  if v_profile_id is null then
    insert into public.users_profile (phone, phone_normalized, full_name, role_id)
    values (
      v_phone,
      v_phone,
      btrim(p_full_name),
      (select r.id from public.roles r where r.name = 'parent' limit 1)
    )
    returning id into v_profile_id;
  else
    update public.users_profile
    set phone = v_phone,
        phone_normalized = v_phone,
        full_name = btrim(p_full_name),
        role_id = (select r.id from public.roles r where r.name = 'parent' limit 1)
    where id = v_profile_id;
  end if;

  insert into public.family_members (family_id, user_id, relationship)
  values (p_family_id, v_profile_id, 'parent')
  on conflict (family_id, user_id) do update
    set relationship = excluded.relationship;

  update public.parent_invites pi
  set revoked_at = now(), updated_at = now()
  where pi.phone_normalized = v_phone
    and pi.family_id <> p_family_id
    and pi.claimed_at is null
    and pi.revoked_at is null;

  v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_valid_hours, 168), 720)));

  select pi.id
    into v_invite_id
  from public.parent_invites pi
  where pi.family_id = p_family_id
    and pi.phone = v_phone
  limit 1;

  if v_invite_id is null then
    insert into public.parent_invites (
      family_id,
      phone,
      phone_normalized,
      full_name,
      invite_code_hash,
      expires_at,
      attempt_count,
      max_attempts,
      claimed_at,
      revoked_at,
      updated_at
    ) values (
      p_family_id,
      v_phone,
      v_phone,
      btrim(p_full_name),
      extensions.crypt(v_code, extensions.gen_salt('bf', 10)),
      v_expires,
      0,
      5,
      null,
      null,
      now()
    )
    returning id into v_invite_id;
  else
    update public.parent_invites pi
    set phone = v_phone,
        phone_normalized = v_phone,
        full_name = btrim(p_full_name),
        invite_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf', 10)),
        expires_at = v_expires,
        attempt_count = 0,
        max_attempts = 5,
        claimed_at = null,
        revoked_at = null,
        updated_at = now()
    where pi.id = v_invite_id;
  end if;

  return query select v_profile_id, v_invite_id, v_code, v_expires;
end;
$function$;
notify pgrst, 'reload schema';