create or replace function public.open_stars_branch_administrator(p_branch text)
returns text language sql immutable set search_path='' as $$
select case trim(coalesce(p_branch,''))
when 'НЛО' then 'Белова Марина'
when 'Свердловский' then 'Додарчук Светлана'
when 'Октябрьский' then 'Маргарита Семидельская'
else null end;
$$;
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
  v_admin_name:=public.open_stars_branch_administrator(p_branch);
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
$function$
;
