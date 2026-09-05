-- OPEN STARS · CRM security hardening
-- All CRM writes go through validated SECURITY DEFINER RPC; authenticated gets read-only table access.

-- If an earlier sandbox revision stored CRM-only «Звонок» directly in child_internal_profiles,
-- normalize it back to the existing child source catalog.
update public.child_internal_profiles
set acquisition_source = 'Другое',
    acquisition_source_note = coalesce(nullif(acquisition_source_note,''),'Звонок'),
    updated_at = now()
where acquisition_source = 'Звонок';

alter table public.child_internal_profiles drop constraint if exists child_internal_profiles_source_check;
alter table public.child_internal_profiles add constraint child_internal_profiles_source_check
check (acquisition_source is null or acquisition_source = any (array[
  'Instagram'::text,'VK'::text,'2ГИС'::text,'Яндекс'::text,'Сайт'::text,
  'Рекомендация'::text,'Старая база'::text,'Наружная реклама'::text,
  'Партнёры'::text,'Мероприятие'::text,'Другое'::text
]));

-- Race-safe duplicate protection: one active, not-yet-converted lead per normalized phone.
create unique index if not exists crm_leads_active_phone_unique
on public.crm_leads(phone_normalized)
where not is_lost and converted_child_id is null;

-- Reading is allowed according to RLS; direct writes are not.
revoke insert, update, delete on public.crm_leads from authenticated;
revoke insert, update, delete on public.crm_tasks from authenticated;
revoke insert, update, delete on public.crm_lead_history from authenticated;
grant select on public.crm_leads, public.crm_tasks, public.crm_lead_history to authenticated;

-- Explicitly close anonymous/PUBLIC execution and keep only authenticated execution.
revoke all on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) from public, anon;
revoke all on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) from public, anon;
revoke all on function public.crm_create_task(uuid,text,timestamptz) from public, anon;
revoke all on function public.crm_complete_task(uuid) from public, anon;
revoke all on function public.crm_marketing_summary(date,date,text) from public, anon;
revoke all on function public.crm_convert_lead_to_student(uuid,text,text,text,date,text,text) from public, anon;

grant execute on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) to authenticated;
grant execute on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) to authenticated;
grant execute on function public.crm_create_task(uuid,text,timestamptz) to authenticated;
grant execute on function public.crm_complete_task(uuid) to authenticated;
grant execute on function public.crm_marketing_summary(date,date,text) to authenticated;
grant execute on function public.crm_convert_lead_to_student(uuid,text,text,text,date,text,text) to authenticated;
