-- OPEN STARS · CRM foundation
-- Additive migration. amoCRM remains an archive; new leads live here.

insert into public.roles (name)
values ('sales'), ('marketer')
on conflict (name) do nothing;

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch = any (array['Свердловский'::text, 'НЛО'::text, 'Октябрьский'::text])),
  child_name text not null,
  child_birth_date date,
  parent_name text not null,
  parent_phone text not null,
  phone_normalized text not null,
  source text not null,
  source_note text,
  campaign text,
  stage text not null default 'new' check (stage = any (array['new','contacted','trial_booked','trial_attended','thinking','awaiting_payment','paid','student']::text[])),
  is_lost boolean not null default false,
  lost_reason text check (lost_reason is null or lost_reason = any (array['no_answer','not_responding','rescheduled','refusal','other_school','unqualified']::text[])),
  first_contact_at timestamptz not null default now(),
  trial_at timestamptz,
  next_contact_at timestamptz not null,
  responsible_profile_id uuid references public.users_profile(id) on delete set null,
  comment text,
  converted_child_id uuid references public.children(id) on delete set null,
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((not is_lost and lost_reason is null) or (is_lost and lost_reason is not null))
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  assigned_profile_id uuid references public.users_profile(id) on delete set null,
  created_by uuid references public.users_profile(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  from_stage text,
  to_stage text,
  is_lost boolean not null default false,
  lost_reason text,
  changed_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_leads_branch_idx on public.crm_leads(branch);
create index if not exists crm_leads_stage_idx on public.crm_leads(stage) where not is_lost;
create index if not exists crm_leads_phone_idx on public.crm_leads(phone_normalized);
create index if not exists crm_leads_next_contact_idx on public.crm_leads(next_contact_at) where not is_lost and converted_child_id is null;
create index if not exists crm_leads_responsible_idx on public.crm_leads(responsible_profile_id);
create index if not exists crm_tasks_lead_idx on public.crm_tasks(lead_id);
create index if not exists crm_tasks_due_idx on public.crm_tasks(due_at) where status = 'open';
create index if not exists crm_tasks_assigned_idx on public.crm_tasks(assigned_profile_id);
create index if not exists crm_lead_history_lead_idx on public.crm_lead_history(lead_id, created_at desc);

alter table public.crm_leads enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_lead_history enable row level security;

create or replace function private.crm_has_global_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner','project_director','manager','sales'), false)
$$;

create or replace function private.crm_can_access_branch(p_branch text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.crm_has_global_access() then true
    when private.current_role() = 'admin' then private.current_staff_branch() = p_branch
    else false
  end
$$;

revoke all on function private.crm_has_global_access() from public, anon;
revoke all on function private.crm_can_access_branch(text) from public, anon;
grant execute on function private.crm_has_global_access() to authenticated;
grant execute on function private.crm_can_access_branch(text) to authenticated;

drop policy if exists crm_leads_select_staff on public.crm_leads;
create policy crm_leads_select_staff on public.crm_leads
for select to authenticated
using (private.crm_can_access_branch(branch));

drop policy if exists crm_leads_insert_staff on public.crm_leads;
create policy crm_leads_insert_staff on public.crm_leads
for insert to authenticated
with check (private.crm_can_access_branch(branch));

drop policy if exists crm_leads_update_staff on public.crm_leads;
create policy crm_leads_update_staff on public.crm_leads
for update to authenticated
using (private.crm_can_access_branch(branch))
with check (private.crm_can_access_branch(branch));

drop policy if exists crm_tasks_select_staff on public.crm_tasks;
create policy crm_tasks_select_staff on public.crm_tasks
for select to authenticated
using (exists (select 1 from public.crm_leads l where l.id = crm_tasks.lead_id and private.crm_can_access_branch(l.branch)));

drop policy if exists crm_tasks_insert_staff on public.crm_tasks;
create policy crm_tasks_insert_staff on public.crm_tasks
for insert to authenticated
with check (exists (select 1 from public.crm_leads l where l.id = crm_tasks.lead_id and private.crm_can_access_branch(l.branch)));

drop policy if exists crm_tasks_update_staff on public.crm_tasks;
create policy crm_tasks_update_staff on public.crm_tasks
for update to authenticated
using (exists (select 1 from public.crm_leads l where l.id = crm_tasks.lead_id and private.crm_can_access_branch(l.branch)))
with check (exists (select 1 from public.crm_leads l where l.id = crm_tasks.lead_id and private.crm_can_access_branch(l.branch)));

drop policy if exists crm_history_select_staff on public.crm_lead_history;
create policy crm_history_select_staff on public.crm_lead_history
for select to authenticated
using (exists (select 1 from public.crm_leads l where l.id = crm_lead_history.lead_id and private.crm_can_access_branch(l.branch)));

revoke all on public.crm_leads, public.crm_tasks, public.crm_lead_history from anon;
grant select, insert, update on public.crm_leads to authenticated;
grant select, insert, update on public.crm_tasks to authenticated;
grant select on public.crm_lead_history to authenticated;

create or replace function private.crm_normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
begin
  if v_digits ~ '^8[0-9]{10}$' then
    return '+7' || substring(v_digits from 2);
  end if;
  if v_digits ~ '^7[0-9]{10}$' then
    return '+' || v_digits;
  end if;
  if v_digits ~ '^[1-9][0-9]{9,14}$' then
    return '+' || v_digits;
  end if;
  return null;
end;
$$;

create or replace function private.crm_actor_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select up.id from public.users_profile up where up.auth_user_id = (select auth.uid()) limit 1
$$;

create or replace function public.crm_create_lead(
  p_branch text,
  p_child_name text,
  p_child_birth_date date,
  p_parent_name text,
  p_parent_phone text,
  p_source text,
  p_source_note text,
  p_campaign text,
  p_trial_at timestamptz,
  p_next_contact_at timestamptz,
  p_comment text,
  p_responsible_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_branch text := trim(coalesce(p_branch,''));
  v_phone text := private.crm_normalize_phone(p_parent_phone);
  v_actor uuid := private.crm_actor_profile_id();
  v_lead public.crm_leads%rowtype;
  v_duplicate uuid;
begin
  if v_role not in ('owner','project_director','manager','sales','admin') then
    raise exception 'not authorized';
  end if;
  if v_role = 'admin' then v_branch := private.current_staff_branch(); end if;
  if v_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  if nullif(trim(coalesce(p_child_name,'')),'') is null then raise exception 'child name required'; end if;
  if nullif(trim(coalesce(p_parent_name,'')),'') is null then raise exception 'parent name required'; end if;
  if v_phone is null then raise exception 'invalid phone'; end if;
  if nullif(trim(coalesce(p_source,'')),'') is null then raise exception 'source required'; end if;
  if p_next_contact_at is null then raise exception 'next contact required'; end if;

  select l.id into v_duplicate
  from public.crm_leads l
  where l.phone_normalized = v_phone
    and not l.is_lost
    and l.converted_child_id is null
  order by l.created_at desc
  limit 1;
  if v_duplicate is not null then raise exception 'duplicate phone:%', v_duplicate; end if;

  insert into public.crm_leads (
    branch, child_name, child_birth_date, parent_name, parent_phone, phone_normalized,
    source, source_note, campaign, stage, trial_at, next_contact_at,
    responsible_profile_id, comment, created_by
  ) values (
    v_branch, trim(p_child_name), p_child_birth_date, trim(p_parent_name), trim(p_parent_phone), v_phone,
    trim(p_source), nullif(trim(coalesce(p_source_note,'')),''), nullif(trim(coalesce(p_campaign,'')),''),
    case when p_trial_at is not null then 'trial_booked' else 'new' end,
    p_trial_at, p_next_contact_at, coalesce(p_responsible_profile_id, v_actor),
    nullif(trim(coalesce(p_comment,'')),''), v_actor
  ) returning * into v_lead;

  insert into public.crm_tasks (lead_id, title, due_at, assigned_profile_id, created_by)
  values (v_lead.id, 'Связаться с клиентом', p_next_contact_at, coalesce(p_responsible_profile_id, v_actor), v_actor);

  insert into public.crm_lead_history (lead_id, from_stage, to_stage, changed_by)
  values (v_lead.id, null, v_lead.stage, v_actor);

  return jsonb_build_object('id',v_lead.id,'branch',v_lead.branch,'stage',v_lead.stage,'phoneNormalized',v_lead.phone_normalized);
end;
$$;

create or replace function public.crm_update_lead(
  p_lead_id uuid,
  p_stage text,
  p_trial_at timestamptz,
  p_next_contact_at timestamptz,
  p_comment text,
  p_is_lost boolean default false,
  p_lost_reason text default null,
  p_responsible_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_actor uuid := private.crm_actor_profile_id();
  v_old_stage text;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found or not private.crm_can_access_branch(v_lead.branch) then raise exception 'not authorized'; end if;
  if p_stage not in ('new','contacted','trial_booked','trial_attended','thinking','awaiting_payment','paid','student') then raise exception 'invalid stage'; end if;
  if coalesce(p_is_lost,false) and p_lost_reason not in ('no_answer','not_responding','rescheduled','refusal','other_school','unqualified') then raise exception 'lost reason required'; end if;
  if not coalesce(p_is_lost,false) and p_next_contact_at is null and p_stage <> 'student' then raise exception 'next contact required'; end if;

  v_old_stage := v_lead.stage;
  update public.crm_leads set
    stage = p_stage,
    trial_at = p_trial_at,
    next_contact_at = coalesce(p_next_contact_at, next_contact_at),
    comment = nullif(trim(coalesce(p_comment,'')),''),
    is_lost = coalesce(p_is_lost,false),
    lost_reason = case when coalesce(p_is_lost,false) then p_lost_reason else null end,
    responsible_profile_id = coalesce(p_responsible_profile_id, responsible_profile_id),
    updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  if v_old_stage is distinct from v_lead.stage or v_lead.is_lost then
    insert into public.crm_lead_history (lead_id, from_stage, to_stage, is_lost, lost_reason, changed_by)
    values (v_lead.id, v_old_stage, v_lead.stage, v_lead.is_lost, v_lead.lost_reason, v_actor);
  end if;

  if not v_lead.is_lost and v_lead.stage <> 'student' and p_next_contact_at is not null then
    insert into public.crm_tasks (lead_id, title, due_at, assigned_profile_id, created_by)
    select v_lead.id, 'Следующий контакт', p_next_contact_at, v_lead.responsible_profile_id, v_actor
    where not exists (
      select 1 from public.crm_tasks t
      where t.lead_id = v_lead.id and t.status='open' and t.due_at = p_next_contact_at
    );
  end if;

  return jsonb_build_object('id',v_lead.id,'stage',v_lead.stage,'isLost',v_lead.is_lost,'lostReason',v_lead.lost_reason);
end;
$$;

create or replace function public.crm_create_task(
  p_lead_id uuid,
  p_title text,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_actor uuid := private.crm_actor_profile_id();
  v_id uuid;
begin
  select * into v_lead from public.crm_leads where id=p_lead_id;
  if not found or not private.crm_can_access_branch(v_lead.branch) then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null or p_due_at is null then raise exception 'task fields required'; end if;
  insert into public.crm_tasks (lead_id,title,due_at,assigned_profile_id,created_by)
  values (p_lead_id,trim(p_title),p_due_at,v_lead.responsible_profile_id,v_actor)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.crm_complete_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.crm_tasks t set status='done', completed_at=now(), updated_at=now()
  where t.id=p_task_id
    and exists (select 1 from public.crm_leads l where l.id=t.lead_id and private.crm_can_access_branch(l.branch))
  returning t.id into v_id;
  if v_id is null then raise exception 'not authorized'; end if;
  return v_id;
end;
$$;

create or replace function public.crm_marketing_summary(
  p_from date default (current_date - 30),
  p_to date default current_date,
  p_branch text default null
)
returns table(branch text, source text, leads bigint, trials bigint, paid bigint, students bigint, lost bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
begin
  if v_role not in ('owner','project_director','manager','marketer') then raise exception 'not authorized'; end if;
  if p_branch is not null and p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  return query
  select l.branch, l.source,
    count(*)::bigint,
    count(*) filter (where l.trial_at is not null or l.stage in ('trial_booked','trial_attended','thinking','awaiting_payment','paid','student'))::bigint,
    count(*) filter (where l.stage in ('paid','student'))::bigint,
    count(*) filter (where l.stage='student')::bigint,
    count(*) filter (where l.is_lost)::bigint
  from public.crm_leads l
  where l.created_at >= p_from::timestamptz
    and l.created_at < (p_to + 1)::timestamptz
    and (p_branch is null or l.branch=p_branch)
  group by l.branch,l.source
  order by l.branch,l.source;
end;
$$;

revoke all on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) from public, anon;
revoke all on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) from public, anon;
revoke all on function public.crm_create_task(uuid,text,timestamptz) from public, anon;
revoke all on function public.crm_complete_task(uuid) from public, anon;
revoke all on function public.crm_marketing_summary(date,date,text) from public, anon;
grant execute on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) to authenticated;
grant execute on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) to authenticated;
grant execute on function public.crm_create_task(uuid,text,timestamptz) to authenticated;
grant execute on function public.crm_complete_task(uuid) to authenticated;
grant execute on function public.crm_marketing_summary(date,date,text) to authenticated;
