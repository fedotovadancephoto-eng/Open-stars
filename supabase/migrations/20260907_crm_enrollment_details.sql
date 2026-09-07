-- Store enrollment choices before conversion, with the existing CRM authorization rules.
alter table public.crm_leads
  add column planned_group_name text check (planned_group_name in ('Базовый','Продвинутый','PRO')),
  add column planned_lesson_day text check (planned_lesson_day in ('Суббота','Воскресенье')),
  add column planned_lesson_time time check (planned_lesson_time in ('11:00','13:00','16:00'));

create or replace function public.crm_update_lead_with_enrollment(
  p_lead_id uuid,p_stage text,p_trial_at timestamptz,p_next_contact_at timestamptz,
  p_comment text,p_is_lost boolean,p_lost_reason text,p_responsible_profile_id uuid,
  p_birth_date date,p_group_name text,p_lesson_day text,p_lesson_time time
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_lead public.crm_leads%rowtype; v_result jsonb;
begin
  if auth.uid() is null or coalesce(private.current_role(),'') not in ('owner','project_director','manager','sales','admin') then
    raise exception 'not authorized';
  end if;
  select * into v_lead from public.crm_leads where id=p_lead_id for update;
  if not found or not coalesce(private.crm_can_access_branch(v_lead.branch),false) then raise exception 'not authorized'; end if;
  if v_lead.converted_child_id is null then
    if p_birth_date > current_date then raise exception 'birth date in future'; end if;
    if p_group_name is not null and p_group_name not in ('Базовый','Продвинутый','PRO') then raise exception 'invalid group'; end if;
    if p_lesson_day is not null and p_lesson_day not in ('Суббота','Воскресенье') then raise exception 'invalid lesson day'; end if;
    if p_lesson_time is not null and p_lesson_time not in ('11:00','13:00','16:00') then raise exception 'invalid stream'; end if;
    update public.crm_leads set child_birth_date=p_birth_date,planned_group_name=p_group_name,
      planned_lesson_day=p_lesson_day,planned_lesson_time=p_lesson_time
    where id=p_lead_id;
  end if;
  v_result:=public.crm_update_lead(p_lead_id,p_stage,p_trial_at,p_next_contact_at,p_comment,p_is_lost,p_lost_reason,p_responsible_profile_id);
  return v_result;
end $$;
revoke all on function public.crm_update_lead_with_enrollment(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid,date,text,text,time) from public,anon;
grant execute on function public.crm_update_lead_with_enrollment(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid,date,text,text,time) to authenticated;
