-- CRM omnichannel staging inbox. No change to existing leads or student records.
create table if not exists public.crm_inbound_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('site', 'vk', 'instagram')),
  external_event_id text,
  event_type text not null,
  branch text check (branch is null or branch in ('Свердловский', 'НЛО', 'Октябрьский')),
  sender_id text,
  sender_name text,
  sender_phone text,
  sender_email text,
  message text,
  campaign text,
  form_id text,
  page_url text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'converted', 'ignored')),
  crm_lead_id uuid references public.crm_leads(id) on delete set null,
  reviewed_by uuid references public.users_profile(id) on delete set null,
  reviewed_at timestamptz,
  received_at timestamptz not null default now(),
  check (length(coalesce(message, '')) <= 4000),
  check (length(coalesce(external_event_id, '')) <= 300)
);

create unique index if not exists crm_inbound_source_event_unique
  on public.crm_inbound_items (source, external_event_id);
create index if not exists crm_inbound_status_received_idx
  on public.crm_inbound_items (status, received_at desc);
create index if not exists crm_inbound_branch_idx
  on public.crm_inbound_items (branch, received_at desc);

alter table public.crm_inbound_items enable row level security;
revoke all on public.crm_inbound_items from public, anon, authenticated;
grant select on public.crm_inbound_items to authenticated;
grant select, insert, update on public.crm_inbound_items to service_role;

drop policy if exists crm_inbound_staff_read on public.crm_inbound_items;
create policy crm_inbound_staff_read on public.crm_inbound_items
for select to authenticated
using (
  private.current_role() in ('owner', 'project_director', 'manager', 'sales')
  or (private.current_role() = 'admin' and branch = private.current_staff_branch())
);

-- Only an authenticated staff member can turn a staged item into a lead.
-- The existing crm_create_lead RPC retains its validation and duplicate checks.
create or replace function public.crm_process_inbound(
  p_inbound_id uuid,
  p_action text,
  p_branch text default null,
  p_child_name text default null,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_next_contact_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_actor uuid := private.crm_actor_profile_id();
  v_item public.crm_inbound_items%rowtype;
  v_branch text;
  v_result jsonb;
  v_source text;
begin
  if auth.uid() is null or v_role not in ('owner', 'project_director', 'manager', 'sales', 'admin') or v_actor is null then
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
$$;

revoke all on function public.crm_process_inbound(uuid,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.crm_process_inbound(uuid,text,text,text,text,text,timestamptz) to authenticated;
