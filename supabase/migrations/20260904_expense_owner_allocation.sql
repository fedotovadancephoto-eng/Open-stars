-- OPEN STARS BUSINESS · owner direct expenses, common/distributed allocation and unified summary
-- Additive extension of the existing expense request -> owner DDC flow.

alter table public.expense_categories
  add column if not exists owner_only boolean not null default false;

update public.expense_categories
set owner_only = true, updated_at = now()
where code = 'payroll';

insert into public.expense_categories (code, name, category_type, is_active, sort_order, owner_only)
values
  ('materials', 'Материалы и закупки', 'variable', true, 75, false),
  ('credit', 'Кредиты и займы', 'fixed', true, 115, true)
on conflict (code) do update
set name = excluded.name,
    category_type = excluded.category_type,
    is_active = true,
    sort_order = excluded.sort_order,
    owner_only = excluded.owner_only,
    updated_at = now();

alter table public.expense_requests
  alter column branch_id drop not null;

alter table public.expense_requests
  add column if not exists allocation_type text not null default 'branch',
  add column if not exists payment_method text;

alter table public.expense_requests
  drop constraint if exists expense_requests_allocation_type_check;
alter table public.expense_requests
  add constraint expense_requests_allocation_type_check
  check (allocation_type in ('branch', 'common', 'distributed'));

alter table public.expense_requests
  drop constraint if exists expense_requests_payment_method_check;
alter table public.expense_requests
  add constraint expense_requests_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'bank', 'card', 'other'));

alter table public.expense_requests
  drop constraint if exists expense_requests_allocation_scope_check;
alter table public.expense_requests
  add constraint expense_requests_allocation_scope_check
  check (
    (allocation_type = 'branch' and branch_id is not null)
    or (allocation_type in ('common', 'distributed') and branch_id is null)
  );

create table if not exists public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.expense_requests(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (expense_request_id, branch_id)
);

create index if not exists expense_allocations_request_idx
  on public.expense_allocations (expense_request_id);
create index if not exists expense_allocations_branch_idx
  on public.expense_allocations (branch_id, expense_request_id);
create index if not exists expense_requests_allocation_date_idx
  on public.expense_requests (allocation_type, expense_date desc);

alter table public.expense_allocations enable row level security;
revoke all on public.expense_allocations from anon, public;
revoke insert, update, delete on public.expense_allocations from authenticated;
grant select on public.expense_allocations to authenticated;

drop policy if exists expense_allocations_owner_read on public.expense_allocations;
create policy expense_allocations_owner_read on public.expense_allocations
for select to authenticated
using (private.current_role() = 'owner');

-- Sensitive categories (salary/credit) are owner-only even for direct REST reads.
drop policy if exists expense_categories_staff_read on public.expense_categories;
create policy expense_categories_staff_read on public.expense_categories
for select to authenticated
using (
  private.current_role() = 'owner'
  or (
    private.current_role() in ('manager', 'project_director', 'admin')
    and not owner_only
  )
);

-- Harden the old RPC too: a branch admin must not be able to submit an owner-only category by UUID.
create or replace function public.staff_submit_expense(
  p_branch_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_profile_id uuid := private.business_current_profile_id();
  v_branch_id uuid := p_branch_id;
  v_expense_id uuid;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_expense_date is null then raise exception 'invalid expense date'; end if;

  if not exists (
    select 1 from public.expense_categories ec
    where ec.id = p_category_id
      and ec.is_active
      and (v_role = 'owner' or not ec.owner_only)
  ) then
    raise exception 'invalid expense category';
  end if;

  if v_role = 'admin' then
    select b.id into v_branch_id
    from public.branches b
    where b.name = private.current_staff_branch() and b.is_active
    limit 1;
  end if;

  if v_branch_id is null or not private.business_can_access_branch(v_branch_id) then
    raise exception 'invalid branch';
  end if;

  insert into public.expense_requests (
    branch_id, category_id, amount, expense_date, description, status,
    requested_by_profile_id, allocation_type
  ) values (
    v_branch_id, p_category_id, round(p_amount::numeric, 2), p_expense_date,
    nullif(trim(coalesce(p_description, '')), ''), 'submitted',
    v_profile_id, 'branch'
  ) returning id into v_expense_id;

  insert into public.approval_log (entity_type, entity_id, action, actor_profile_id, comment)
  values ('expense_request', v_expense_id, 'submitted', v_profile_id, null);

  return v_expense_id;
end;
$$;

create or replace function public.staff_submit_expense_v2(
  p_branch_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_payment_method text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_expense_id uuid;
begin
  if p_payment_method is not null and p_payment_method not in ('cash', 'bank', 'card', 'other') then
    raise exception 'invalid payment method';
  end if;

  v_expense_id := public.staff_submit_expense(
    p_branch_id, p_category_id, p_amount, p_expense_date, p_description
  );

  update public.expense_requests
  set payment_method = p_payment_method
  where id = v_expense_id;

  return v_expense_id;
end;
$$;

revoke all on function public.staff_submit_expense_v2(uuid,uuid,numeric,date,text,text) from public, anon;
grant execute on function public.staff_submit_expense_v2(uuid,uuid,numeric,date,text,text) to authenticated;

-- Owner can record a real expense immediately. No meaningless self-approval step.
create or replace function public.owner_create_direct_expense(
  p_allocation_type text,
  p_branch_id uuid,
  p_allocations jsonb,
  p_category_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_payment_method text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_expense_id uuid;
  v_transaction_id uuid;
  v_allocation_count integer := 0;
  v_allocation_unique integer := 0;
  v_allocation_sum numeric := 0;
  v_bad_allocation boolean := false;
  v_branch_id uuid;
begin
  if v_profile_id is null or private.current_role() <> 'owner' then
    raise exception 'owner only';
  end if;
  if p_allocation_type not in ('branch', 'common', 'distributed') then raise exception 'invalid allocation type'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_expense_date is null then raise exception 'invalid expense date'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'bank', 'card', 'other') then raise exception 'invalid payment method'; end if;
  if not exists (select 1 from public.expense_categories ec where ec.id = p_category_id and ec.is_active) then
    raise exception 'invalid expense category';
  end if;
  if p_account_id is not null and not exists (select 1 from public.cash_accounts ca where ca.id = p_account_id and ca.is_active) then
    raise exception 'invalid cash account';
  end if;

  if p_allocation_type = 'branch' then
    if p_branch_id is null or not exists (select 1 from public.branches b where b.id = p_branch_id and b.is_active) then
      raise exception 'invalid branch';
    end if;
    v_branch_id := p_branch_id;
  elsif p_allocation_type = 'common' then
    v_branch_id := null;
  else
    v_branch_id := null;
    if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) < 2 then
      raise exception 'invalid allocations';
    end if;

    select
      count(*),
      count(distinct (item->>'branchId')),
      coalesce(sum((item->>'amount')::numeric), 0),
      bool_or(
        nullif(item->>'branchId', '') is null
        or nullif(item->>'amount', '') is null
        or (item->>'amount')::numeric <= 0
        or not exists (
          select 1 from public.branches b
          where b.id = (item->>'branchId')::uuid and b.is_active
        )
      )
    into v_allocation_count, v_allocation_unique, v_allocation_sum, v_bad_allocation
    from jsonb_array_elements(p_allocations) item;

    if coalesce(v_bad_allocation, true)
       or v_allocation_count <> v_allocation_unique
       or abs(v_allocation_sum - round(p_amount::numeric, 2)) > 0.009 then
      raise exception 'invalid allocations';
    end if;
  end if;

  insert into public.expense_requests (
    branch_id, category_id, amount, expense_date, description, status,
    requested_by_profile_id, reviewed_by_profile_id, reviewed_at,
    allocation_type, payment_method
  ) values (
    v_branch_id, p_category_id, round(p_amount::numeric, 2), p_expense_date,
    nullif(trim(coalesce(p_description, '')), ''), 'approved',
    v_profile_id, v_profile_id, now(), p_allocation_type, p_payment_method
  ) returning id into v_expense_id;

  if p_allocation_type = 'branch' then
    insert into public.expense_allocations (expense_request_id, branch_id, amount)
    values (v_expense_id, p_branch_id, round(p_amount::numeric, 2));
  elsif p_allocation_type = 'distributed' then
    insert into public.expense_allocations (expense_request_id, branch_id, amount)
    select v_expense_id, (item->>'branchId')::uuid, round((item->>'amount')::numeric, 2)
    from jsonb_array_elements(p_allocations) item;
  end if;

  insert into public.cashflow_transactions (
    transaction_date, direction, amount, category_id, branch_id, account_id,
    source_type, source_id, description, created_by_profile_id, approved_by_profile_id
  ) values (
    p_expense_date, 'expense', round(p_amount::numeric, 2), p_category_id,
    v_branch_id, p_account_id, 'owner_direct_expense', v_expense_id,
    nullif(trim(coalesce(p_description, '')), ''), v_profile_id, v_profile_id
  ) returning id into v_transaction_id;

  update public.expense_requests
  set cashflow_transaction_id = v_transaction_id
  where id = v_expense_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'expense_request', v_expense_id, 'owner_direct_created', v_profile_id,
    nullif(trim(coalesce(p_description, '')), ''),
    jsonb_build_object(
      'allocation_type', p_allocation_type,
      'payment_method', coalesce(p_payment_method, ''),
      'cashflow_transaction_id', v_transaction_id,
      'allocations', coalesce(p_allocations, '[]'::jsonb)
    )
  );

  return jsonb_build_object(
    'expenseId', v_expense_id,
    'cashflowTransactionId', v_transaction_id,
    'allocationType', p_allocation_type,
    'amount', round(p_amount::numeric, 2)
  );
end;
$$;

revoke all on function public.owner_create_direct_expense(text,uuid,jsonb,uuid,uuid,numeric,date,text,text) from public, anon;
grant execute on function public.owner_create_direct_expense(text,uuid,jsonb,uuid,uuid,numeric,date,text,text) to authenticated;

-- Allow owner to attach a receipt to an already-posted direct expense.
create or replace function public.staff_attach_expense_receipt(
  p_expense_request_id uuid,
  p_storage_path text,
  p_file_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_request public.expense_requests%rowtype;
  v_branch_code text;
  v_attachment_id uuid;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;

  select * into v_request from public.expense_requests where id = p_expense_request_id;
  if not found or not private.business_can_access_branch(v_request.branch_id) then
    raise exception 'expense request not found';
  end if;
  if v_request.status <> 'submitted' and not (v_role = 'owner' and v_request.status = 'approved') then
    raise exception 'expense request is closed';
  end if;

  if v_request.branch_id is null then
    if v_role <> 'owner' then raise exception 'not authorized'; end if;
    v_branch_code := 'common';
  else
    select code into v_branch_code from public.branches where id = v_request.branch_id;
  end if;

  if p_storage_path is null or p_storage_path not like v_branch_code || '/' || p_expense_request_id::text || '/%' then
    raise exception 'invalid receipt path';
  end if;

  insert into public.expense_attachments (
    expense_request_id, storage_path, file_name, mime_type, size_bytes, uploaded_by_profile_id
  ) values (
    p_expense_request_id, p_storage_path,
    nullif(trim(coalesce(p_file_name, '')), ''),
    nullif(trim(coalesce(p_mime_type, '')), ''), p_size_bytes, v_profile_id
  ) returning id into v_attachment_id;

  insert into public.approval_log (entity_type, entity_id, action, actor_profile_id, metadata)
  values ('expense_request', p_expense_request_id, 'receipt_attached', v_profile_id, jsonb_build_object('attachment_id', v_attachment_id));

  return v_attachment_id;
end;
$$;

-- Unified owner summary: one cash payment, separate management allocation by branch/common.
create or replace function public.owner_expense_summary(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_from date := coalesce(p_from, date_trunc('month', current_date)::date);
  v_to date := coalesce(p_to, current_date);
  v_total numeric := 0;
  v_common numeric := 0;
  v_distributed numeric := 0;
  v_branch_direct numeric := 0;
  v_pending numeric := 0;
  v_pending_count integer := 0;
  v_branches jsonb := '[]'::jsonb;
  v_categories jsonb := '[]'::jsonb;
  v_types jsonb := '[]'::jsonb;
begin
  if private.current_role() <> 'owner' then raise exception 'owner only'; end if;
  if v_to < v_from then raise exception 'invalid period'; end if;

  select coalesce(sum(er.amount),0),
         coalesce(sum(er.amount) filter (where er.allocation_type='common'),0),
         coalesce(sum(er.amount) filter (where er.allocation_type='distributed'),0),
         coalesce(sum(er.amount) filter (where er.allocation_type='branch'),0)
  into v_total, v_common, v_distributed, v_branch_direct
  from public.expense_requests er
  where er.status='approved' and er.expense_date between v_from and v_to;

  select coalesce(sum(er.amount),0), count(*)::integer
  into v_pending, v_pending_count
  from public.expense_requests er
  where er.status='submitted' and er.expense_date between v_from and v_to;

  with allocated as (
    select er.branch_id, er.amount
    from public.expense_requests er
    where er.status='approved' and er.allocation_type='branch'
      and er.expense_date between v_from and v_to
    union all
    select ea.branch_id, ea.amount
    from public.expense_allocations ea
    join public.expense_requests er on er.id=ea.expense_request_id
    where er.status='approved' and er.allocation_type='distributed'
      and er.expense_date between v_from and v_to
  ), totals as (
    select b.id, b.name, coalesce(sum(a.amount),0)::numeric as amount
    from public.branches b
    left join allocated a on a.branch_id=b.id
    where b.is_active
    group by b.id,b.name,b.sort_order
    order by b.sort_order,b.name
  )
  select coalesce(jsonb_agg(jsonb_build_object('branchId',id,'branch',name,'amount',round(amount,2))), '[]'::jsonb)
  into v_branches from totals;

  with totals as (
    select ec.id, ec.name, coalesce(sum(er.amount),0)::numeric as amount
    from public.expense_requests er
    join public.expense_categories ec on ec.id=er.category_id
    where er.status='approved' and er.expense_date between v_from and v_to
    group by ec.id,ec.name
    order by amount desc,ec.name
  )
  select coalesce(jsonb_agg(jsonb_build_object('categoryId',id,'category',name,'amount',round(amount,2))), '[]'::jsonb)
  into v_categories from totals;

  with totals as (
    select er.allocation_type, sum(er.amount)::numeric amount
    from public.expense_requests er
    where er.status='approved' and er.expense_date between v_from and v_to
    group by er.allocation_type
  )
  select coalesce(jsonb_agg(jsonb_build_object('type',allocation_type,'amount',round(amount,2))), '[]'::jsonb)
  into v_types from totals;

  return jsonb_build_object(
    'from', v_from, 'to', v_to,
    'totalApproved', round(v_total,2),
    'commonAmount', round(v_common,2),
    'distributedAmount', round(v_distributed,2),
    'branchDirectAmount', round(v_branch_direct,2),
    'pendingAmount', round(v_pending,2),
    'pendingCount', v_pending_count,
    'branches', v_branches,
    'categories', v_categories,
    'allocationTypes', v_types
  );
end;
$$;

revoke all on function public.owner_expense_summary(date,date) from public, anon;
grant execute on function public.owner_expense_summary(date,date) to authenticated;
