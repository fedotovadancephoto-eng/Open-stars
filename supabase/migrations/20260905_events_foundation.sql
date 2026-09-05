-- OPEN STARS · Events foundation
-- Parents choose participation, admins confirm event payments for their branch,
-- owner manages event expenses and receives event profit separately from school tuition.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  branch_id uuid references public.branches(id) on delete restrict,
  default_fee numeric(14,2) check (default_fee is null or default_fee >= 0),
  status text not null default 'planned'
    check (status in ('planned', 'open', 'closed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at desc);
create index if not exists events_branch_status_idx on public.events (branch_id, status, starts_at desc);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  status text not null default 'invited'
    check (status in ('invited', 'participating', 'declined', 'cancelled')),
  fee_amount numeric(14,2) check (fee_amount is null or fee_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, child_id)
);

create index if not exists event_participants_event_idx on public.event_participants (event_id, status);
create index if not exists event_participants_child_idx on public.event_participants (child_id, event_id);
create index if not exists event_participants_branch_idx on public.event_participants (branch_id, event_id);

create table if not exists public.event_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.event_participants(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('online', 'cash', 'bank_transfer', 'other')),
  received_at timestamptz not null default now(),
  note text,
  cashflow_transaction_id uuid unique references public.cashflow_transactions(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_payments_event_idx on public.event_payments (event_id, received_at desc);
create index if not exists event_payments_participant_idx on public.event_payments (participant_id, received_at desc);
create index if not exists event_payments_branch_idx on public.event_payments (branch_id, received_at desc);

create table if not exists public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  category text not null check (category in ('venue', 'materials', 'transport', 'catering', 'contractors', 'other')),
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  description text,
  cashflow_transaction_id uuid unique references public.cashflow_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_expenses_event_idx on public.event_expenses (event_id, expense_date desc);

create or replace function private.event_parent_owns_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.children c
    join public.family_members fm on fm.family_id = c.family_id
    where c.id = p_child_id
      and c.archived_at is null
      and fm.user_id = private.business_current_profile_id()
  )
$$;

create or replace function private.event_parent_can_see(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.events e
    join public.children c on c.archived_at is null
    join public.family_members fm on fm.family_id = c.family_id
    left join public.branches b on b.name = c.branch and b.is_active
    where e.id = p_event_id
      and fm.user_id = private.business_current_profile_id()
      and (e.branch_id is null or e.branch_id = b.id)
  )
$$;

alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_payments enable row level security;
alter table public.event_expenses enable row level security;

revoke all on public.events, public.event_participants, public.event_payments, public.event_expenses from anon, public;
revoke insert, update, delete on public.events, public.event_participants, public.event_payments, public.event_expenses from authenticated;
grant select on public.events, public.event_participants, public.event_payments, public.event_expenses to authenticated;

drop policy if exists events_read on public.events;
create policy events_read on public.events
for select to authenticated
using (
  private.current_role() in ('owner', 'manager', 'project_director', 'admin')
  or (
    status in ('open', 'completed')
    and private.event_parent_can_see(id)
  )
);

drop policy if exists event_participants_read on public.event_participants;
create policy event_participants_read on public.event_participants
for select to authenticated
using (
  (
    private.current_role() in ('owner', 'manager', 'project_director', 'admin')
    and private.business_can_access_branch(branch_id)
  )
  or private.event_parent_owns_child(child_id)
);

drop policy if exists event_payments_read on public.event_payments;
create policy event_payments_read on public.event_payments
for select to authenticated
using (
  (
    private.current_role() in ('owner', 'manager', 'project_director', 'admin')
    and private.business_can_access_branch(branch_id)
  )
  or private.event_parent_owns_child(child_id)
);

drop policy if exists event_expenses_owner_read on public.event_expenses;
create policy event_expenses_owner_read on public.event_expenses
for select to authenticated
using (private.current_role() = 'owner');

create or replace function public.parent_set_event_participation(
  p_event_id uuid,
  p_child_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_event public.events%rowtype;
  v_branch_id uuid;
  v_participant_id uuid;
begin
  if p_status not in ('participating', 'declined') then
    raise exception 'invalid participation status';
  end if;
  if not private.event_parent_owns_child(p_child_id) then
    raise exception 'not authorized';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status <> 'open' then
    raise exception 'event is not open';
  end if;

  select b.id into v_branch_id
  from public.children c
  join public.branches b on b.name = c.branch and b.is_active
  where c.id = p_child_id and c.archived_at is null;

  if v_branch_id is null then raise exception 'invalid branch'; end if;
  if v_event.branch_id is not null and v_event.branch_id <> v_branch_id then
    raise exception 'event unavailable for branch';
  end if;

  insert into public.event_participants (event_id, child_id, branch_id, status, fee_amount)
  values (p_event_id, p_child_id, v_branch_id, p_status, v_event.default_fee)
  on conflict (event_id, child_id) do update
  set status = excluded.status,
      updated_at = now()
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

create or replace function public.staff_set_event_participant_fee(
  p_participant_id uuid,
  p_fee_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_branch_id uuid;
begin
  if p_fee_amount is null or p_fee_amount < 0 then raise exception 'invalid fee'; end if;
  if v_role not in ('owner', 'manager', 'project_director', 'admin') then raise exception 'not authorized'; end if;

  select branch_id into v_branch_id from public.event_participants where id = p_participant_id;
  if v_branch_id is null or not private.business_can_access_branch(v_branch_id) then raise exception 'not authorized'; end if;

  update public.event_participants
  set fee_amount = round(p_fee_amount::numeric, 2), updated_at = now()
  where id = p_participant_id;

  return p_participant_id;
end;
$$;

create or replace function public.staff_confirm_event_payment(
  p_participant_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_received_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_profile_id uuid := private.business_current_profile_id();
  v_participant public.event_participants%rowtype;
  v_event_title text;
  v_child_name text;
  v_payment_id uuid;
  v_transaction_id uuid;
  v_account_id uuid;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then raise exception 'not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_payment_method not in ('online', 'cash', 'bank_transfer', 'other') then raise exception 'invalid payment method'; end if;

  select * into v_participant from public.event_participants where id = p_participant_id;
  if not found or not private.business_can_access_branch(v_participant.branch_id) then raise exception 'not authorized'; end if;

  select e.title, concat_ws(' ', c.first_name, c.last_name)
  into v_event_title, v_child_name
  from public.events e
  join public.children c on c.id = v_participant.child_id
  where e.id = v_participant.event_id;

  insert into public.event_payments (event_id, participant_id, child_id, branch_id, amount, payment_method, received_at, note)
  values (v_participant.event_id, v_participant.id, v_participant.child_id, v_participant.branch_id,
          round(p_amount::numeric, 2), p_payment_method, coalesce(p_received_at, now()), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_payment_id;

  v_account_id := private.business_payment_account_id(p_payment_method, v_participant.branch_id);

  insert into public.cashflow_transactions (
    transaction_date, direction, amount, branch_id, account_id, source_type, source_id,
    description, created_by_profile_id, approved_by_profile_id
  ) values (
    (coalesce(p_received_at, now()) at time zone 'Asia/Irkutsk')::date,
    'income', round(p_amount::numeric, 2), v_participant.branch_id, v_account_id,
    'event_payment', v_payment_id,
    'Мероприятие · ' || coalesce(v_event_title, 'Без названия') || ' · ' || coalesce(v_child_name, 'Ученик'),
    v_profile_id, v_profile_id
  ) returning id into v_transaction_id;

  update public.event_payments
  set cashflow_transaction_id = v_transaction_id, updated_at = now()
  where id = v_payment_id;

  update public.event_participants
  set status = case when status = 'invited' then 'participating' else status end,
      updated_at = now()
  where id = v_participant.id;

  return v_payment_id;
end;
$$;

create or replace function public.owner_add_event_expense(
  p_event_id uuid,
  p_category text,
  p_amount numeric,
  p_expense_date date default current_date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_event public.events%rowtype;
  v_expense_id uuid;
  v_transaction_id uuid;
begin
  if private.current_role() <> 'owner' or v_profile_id is null then raise exception 'not authorized'; end if;
  if p_category not in ('venue', 'materials', 'transport', 'catering', 'contractors', 'other') then raise exception 'invalid category'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then raise exception 'event not found'; end if;

  insert into public.event_expenses (event_id, branch_id, category, amount, expense_date, description)
  values (p_event_id, v_event.branch_id, p_category, round(p_amount::numeric, 2), coalesce(p_expense_date, current_date), nullif(trim(coalesce(p_description, '')), ''))
  returning id into v_expense_id;

  insert into public.cashflow_transactions (
    transaction_date, direction, amount, branch_id, source_type, source_id,
    description, created_by_profile_id, approved_by_profile_id
  ) values (
    coalesce(p_expense_date, current_date), 'expense', round(p_amount::numeric, 2), v_event.branch_id,
    'event_expense', v_expense_id,
    'Расход мероприятия · ' || v_event.title || coalesce(' · ' || nullif(trim(coalesce(p_description, '')), ''), ''),
    v_profile_id, v_profile_id
  ) returning id into v_transaction_id;

  update public.event_expenses
  set cashflow_transaction_id = v_transaction_id, updated_at = now()
  where id = v_expense_id;

  return v_expense_id;
end;
$$;

create or replace function public.owner_event_financial_summary(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when private.current_role() <> 'owner' then null
    else jsonb_build_object(
      'eventId', e.id,
      'title', e.title,
      'revenue', coalesce((select sum(ep.amount) from public.event_payments ep where ep.event_id = e.id and ep.voided_at is null), 0),
      'expenses', coalesce((select sum(ex.amount) from public.event_expenses ex where ex.event_id = e.id), 0),
      'profit', coalesce((select sum(ep.amount) from public.event_payments ep where ep.event_id = e.id and ep.voided_at is null), 0)
                - coalesce((select sum(ex.amount) from public.event_expenses ex where ex.event_id = e.id), 0),
      'participants', (select count(*) from public.event_participants p where p.event_id = e.id and p.status = 'participating')
    )
  end
  from public.events e
  where e.id = p_event_id
$$;

grant execute on function public.parent_set_event_participation(uuid, uuid, text) to authenticated;
grant execute on function public.staff_set_event_participant_fee(uuid, numeric) to authenticated;
grant execute on function public.staff_confirm_event_payment(uuid, numeric, text, timestamptz, text) to authenticated;
grant execute on function public.owner_add_event_expense(uuid, text, numeric, date, text) to authenticated;
grant execute on function public.owner_event_financial_summary(uuid) to authenticated;
