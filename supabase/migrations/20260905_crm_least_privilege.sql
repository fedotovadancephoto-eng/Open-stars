-- OPEN STARS · CRM least privilege hardening
-- CRM tables are read-only to authenticated users; all writes go through validated RPC functions.

revoke all on table public.crm_leads from anon, authenticated;
revoke all on table public.crm_tasks from anon, authenticated;
revoke all on table public.crm_lead_history from anon, authenticated;

grant select on table public.crm_leads to authenticated;
grant select on table public.crm_tasks to authenticated;
grant select on table public.crm_lead_history to authenticated;

revoke all on function private.crm_normalize_phone(text) from public, anon, authenticated;
revoke all on function private.crm_actor_profile_id() from public, anon, authenticated;

-- RLS policies use these helpers directly, so authenticated keeps EXECUTE only on the branch-access checks.
revoke all on function private.crm_has_global_access() from public, anon, authenticated;
revoke all on function private.crm_can_access_branch(text) from public, anon, authenticated;
grant execute on function private.crm_has_global_access() to authenticated;
grant execute on function private.crm_can_access_branch(text) to authenticated;

-- Public CRM RPCs are callable only by authenticated sessions; each function performs role/branch validation.
revoke all on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) from public, anon, authenticated;
revoke all on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) from public, anon, authenticated;
revoke all on function public.crm_create_task(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.crm_complete_task(uuid) from public, anon, authenticated;
revoke all on function public.crm_marketing_summary(date,date,text) from public, anon, authenticated;
revoke all on function public.crm_convert_lead_to_student(uuid,text,text,text,date,text,text) from public, anon, authenticated;

grant execute on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) to authenticated;
grant execute on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) to authenticated;
grant execute on function public.crm_create_task(uuid,text,timestamptz) to authenticated;
grant execute on function public.crm_complete_task(uuid) to authenticated;
grant execute on function public.crm_marketing_summary(date,date,text) to authenticated;
grant execute on function public.crm_convert_lead_to_student(uuid,text,text,text,date,text,text) to authenticated;
