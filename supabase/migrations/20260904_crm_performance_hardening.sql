-- OPEN STARS · CRM performance hardening
-- Add covering indexes for CRM foreign keys reported by Supabase Performance Advisor.
-- Additive only; no CRM data is changed.

create index if not exists crm_leads_converted_child_idx
  on public.crm_leads(converted_child_id)
  where converted_child_id is not null;

create index if not exists crm_leads_created_by_idx
  on public.crm_leads(created_by)
  where created_by is not null;

create index if not exists crm_tasks_created_by_idx
  on public.crm_tasks(created_by)
  where created_by is not null;

create index if not exists crm_lead_history_changed_by_idx
  on public.crm_lead_history(changed_by)
  where changed_by is not null;
