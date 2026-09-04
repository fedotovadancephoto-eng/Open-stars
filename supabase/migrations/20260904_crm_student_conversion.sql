-- OPEN STARS · CRM conversion: paid lead -> student without repeated parent data

alter table public.child_internal_profiles drop constraint if exists child_internal_profiles_source_check;
alter table public.child_internal_profiles add constraint child_internal_profiles_source_check
check (acquisition_source is null or acquisition_source = any (array[
  'Instagram'::text,'Звонок'::text,'VK'::text,'2ГИС'::text,'Яндекс'::text,'Сайт'::text,
  'Рекомендация'::text,'Старая база'::text,'Наружная реклама'::text,'Партнёры'::text,
  'Мероприятие'::text,'Другое'::text
]));

create or replace function public.crm_convert_lead_to_student(
  p_lead_id uuid,
  p_first_name text,
  p_last_name text,
  p_group_name text,
  p_birth_date date default null,
  p_lesson_day text default null,
  p_lesson_time text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_actor uuid := private.crm_actor_profile_id();
  v_lead public.crm_leads%rowtype;
  v_parent_id uuid;
  v_family_id uuid;
  v_child_id uuid;
  v_admin_name text;
  v_parent_role_id uuid;
  v_source text;
  v_source_note text;
begin
  if v_role not in ('owner','project_director','manager','sales','admin') then
    raise exception 'not authorized';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if not found or not private.crm_can_access_branch(v_lead.branch) then raise exception 'not authorized'; end if;
  if v_lead.converted_child_id is not null then
    return jsonb_build_object('childId',v_lead.converted_child_id,'leadId',v_lead.id,'alreadyConverted',true);
  end if;
  if v_lead.stage <> 'paid' then raise exception 'lead must be paid'; end if;
  if nullif(trim(coalesce(p_first_name,'')),'') is null or nullif(trim(coalesce(p_last_name,'')),'') is null then raise exception 'child full name required'; end if;
  if p_group_name not in ('Базовый','Продвинутый','PRO') then raise exception 'invalid group'; end if;

  select up.id into v_parent_id
  from public.users_profile up
  where up.phone_normalized = v_lead.phone_normalized or up.phone = v_lead.phone_normalized
  order by up.created_at asc limit 1;

  if v_parent_id is null then
    select id into v_parent_role_id from public.roles where name='parent' limit 1;
    if v_parent_role_id is null then raise exception 'parent role missing'; end if;
    insert into public.users_profile(phone,phone_normalized,full_name,role_id)
    values(v_lead.phone_normalized,v_lead.phone_normalized,trim(v_lead.parent_name),v_parent_role_id)
    returning id into v_parent_id;
  else
    update public.users_profile
    set full_name = coalesce(nullif(full_name,''),trim(v_lead.parent_name)),
        phone_normalized = coalesce(phone_normalized,v_lead.phone_normalized)
    where id=v_parent_id;
  end if;

  select fm.family_id into v_family_id
  from public.family_members fm
  where fm.user_id=v_parent_id
  order by fm.id limit 1;

  if v_family_id is null then
    insert into public.families(name)
    values(trim(p_last_name)||' — '||trim(v_lead.parent_name))
    returning id into v_family_id;
    insert into public.family_members(family_id,user_id,relationship)
    values(v_family_id,v_parent_id,'parent');
  end if;

  select c.id into v_child_id
  from public.children c
  where c.family_id=v_family_id
    and lower(trim(c.first_name))=lower(trim(p_first_name))
    and lower(trim(c.last_name))=lower(trim(p_last_name))
    and c.archived_at is null
  limit 1;
  if v_child_id is not null then raise exception 'student already exists:%',v_child_id; end if;

  v_admin_name := case v_lead.branch
    when 'НЛО' then 'Белова Марина'
    when 'Свердловский' then 'Додарчук Светлана'
    when 'Октябрьский' then 'Кошкина Юлия'
  end;

  insert into public.children(
    family_id,first_name,last_name,birth_date,group_name,branch,lesson_day,lesson_time,mentor_name,level
  ) values(
    v_family_id,trim(p_first_name),trim(p_last_name),coalesce(p_birth_date,v_lead.child_birth_date),
    p_group_name,v_lead.branch,nullif(trim(coalesce(p_lesson_day,'')),''),
    nullif(trim(coalesce(p_lesson_time,'')),''),v_admin_name,null
  ) returning id into v_child_id;

  v_source := case when v_lead.source in ('Instagram','Звонок','VK','2ГИС','Яндекс','Сайт','Рекомендация','Старая база','Наружная реклама','Партнёры','Мероприятие','Другое') then v_lead.source else 'Другое' end;
  v_source_note := case when v_source='Другое' then coalesce(nullif(v_lead.source_note,''),v_lead.source) else null end;

  insert into public.child_internal_profiles(child_id,acquisition_source,acquisition_source_note,updated_by_profile_id)
  values(v_child_id,v_source,v_source_note,v_actor)
  on conflict(child_id) do update set
    acquisition_source=excluded.acquisition_source,
    acquisition_source_note=excluded.acquisition_source_note,
    updated_by_profile_id=excluded.updated_by_profile_id,
    updated_at=now();

  update public.crm_leads set
    converted_child_id=v_child_id,
    stage='student',
    is_lost=false,
    lost_reason=null,
    updated_at=now()
  where id=v_lead.id;

  update public.crm_tasks set status='done',completed_at=coalesce(completed_at,now()),updated_at=now()
  where lead_id=v_lead.id and status='open';

  insert into public.crm_lead_history(lead_id,from_stage,to_stage,is_lost,lost_reason,changed_by)
  values(v_lead.id,'paid','student',false,null,v_actor);

  return jsonb_build_object('childId',v_child_id,'familyId',v_family_id,'parentProfileId',v_parent_id,'leadId',v_lead.id,'alreadyConverted',false);
end;
$$;

revoke all on function public.crm_convert_lead_to_student(uuid,text,text,text,date,text,text) from public, anon;
grant execute on function public.crm_convert_lead_to_student(uuid,text,text,text,date,text,text) to authenticated;
