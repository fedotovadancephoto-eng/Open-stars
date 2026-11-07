-- CRM call metadata, read-only to staff; recording files are NOT stored here.
-- No external telephony credentials are configured by this migration.
create table if not exists public.crm_call_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mango', 'zadarma', 't2')),
  external_call_id text not null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  client_phone text,
  staff_phone text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  outcome text not null default 'unknown' check (outcome in ('answered', 'missed', 'busy', 'failed', 'unknown')),
  recording_external_id text,
  recording_state text not null default 'unavailable' check (recording_state in ('unavailable', 'pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  constraint crm_call_logs_provider_call_unique unique (provider, external_call_id)
);
create index if not exists crm_call_logs_lead_started_idx on public.crm_call_logs (lead_id, started_at desc);
alter table public.crm_call_logs enable row level security;
revoke all on public.crm_call_logs from public, anon, authenticated;
grant select on public.crm_call_logs to authenticated;
drop policy if exists crm_call_logs_staff_read on public.crm_call_logs;
create policy crm_call_logs_staff_read on public.crm_call_logs
for select to authenticated
using (
  lead_id is not null
  and private.current_role() in ('owner', 'manager', 'sales', 'admin')
  and exists (
    select 1 from public.crm_leads lead
    where lead.id = crm_call_logs.lead_id
      and private.crm_can_access_branch(lead.branch)
  )
);
comment on table public.crm_call_logs is 'Call metadata for CRM. Populated only by a future verified telephony integration; authenticated clients are read-only.';
