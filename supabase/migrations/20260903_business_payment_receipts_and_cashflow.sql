-- OPEN STARS BUSINESS · payments -> revenue -> unified owner cashflow
-- Additive migration. Existing payment rows and child data are not rewritten.

alter table public.cash_accounts
  add column if not exists code text;

create unique index if not exists cash_accounts_code_unique_idx
  on public.cash_accounts (code)
  where code is not null;

insert into public.cash_accounts (code, name, account_type, branch_id, opening_balance, is_active)
select 'tochka_main', 'Точка · общий счёт', 'bank', null, 0, true
where not exists (select 1 from public.cash_accounts where code = 'tochka_main');

insert into public.cash_accounts (code, name, account_type, branch_id, opening_balance, is_active)
select 'cash_' || b.code, 'Касса · ' || b.name, 'cash', b.id, 0, true
from public.branches b
where b.is_active
on conflict (code) do update
set name = excluded.name,
    account_type = excluded.account_type,
    branch_id = excluded.branch_id,
    is_active = true,
    updated_at = now();

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null
    check (payment_method in ('online', 'cash', 'bank_transfer', 'other')),
  received_at timestamptz not null default now(),
  confirmed_by_profile_id uuid not null references public.users_profile(id) on delete restrict,
  note text,
  cashflow_transaction_id uuid unique references public.cashflow_transactions(id) on delete set null,
  voided_at timestamptz,
  voided_by_profile_id uuid references public.users_profile(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_receipts_payment_idx
  on public.payment_receipts (payment_id, received_at desc);
create index if not exists payment_receipts_child_idx
  on public.payment_receipts (child_id, received_at desc);
create index if not exists payment_receipts_branch_idx
  on public.payment_receipts (branch_id, received_at desc);
create index if not exists payment_receipts_confirmed_by_idx
  on public.payment_receipts (confirmed_by_profile_id, received_at desc);

alter table public.payment_receipts enable row level security;

drop policy if exists payment_receipts_staff_read on public.payment_receipts;
create policy payment_receipts_staff_read on public.payment_receipts
for select to authenticated
using (
  private.current_role() in ('owner', 'manager', 'project_director', 'admin')
  and private.business_can_access_branch(branch_id)
);

revoke all on public.payment_receipts from anon, public;
revoke insert, update, delete on public.payment_receipts from authenticated;
grant select on public.payment_receipts to authenticated;

create or replace function private.business_payment_account_id(
  p_method text,
  p_branch_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select ca.id
  from public.cash_accounts ca
  where ca.is_active
    and (
      (p_method = 'cash' and ca.code = 'cash_' || (select b.code from public.branches b where b.id = p_branch_id))
      or
      (p_method in ('online', 'bank_transfer') and ca.code = 'tochka_main')
    )
  order by case when p_method = 'cash' then 0 else 1 end
  limit 1
$$;

create or replace function public.staff_confirm_payment_receipt(
  p_child_id uuid,
  p_month date,
  p_amount numeric,
  p_payment_method text,
  p_received_at timestamptz default now(),
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_month date;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_transaction_id uuid;
  v_branch_id uuid;
  v_account_id uuid;
  v_child_name text;
  v_branch_name text;
begin
  if v_profile_id is null
     or v_role not in ('owner', 'manager', 'project_director', 'admin')
     or not private.payment_staff_can_manage_child(p_child_id) then
    raise exception 'not authorized';
  end if;

  if p_month is null then raise exception 'month required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_payment_method not in ('online', 'cash', 'bank_transfer', 'other') then
    raise exception 'invalid payment method';
  end if;
  if p_received_at is null then raise exception 'received at required'; end if;

  select b.id, c.branch, concat_ws(' ', c.first_name, c.last_name)
    into v_branch_id, v_branch_name, v_child_name
  from public.children c
  join public.branches b on b.name = c.branch and b.is_active
  where c.id = p_child_id
    and c.archived_at is null;

  if v_branch_id is null then raise exception 'invalid branch'; end if;
  if not private.business_can_access_branch(v_branch_id) then raise exception 'not authorized'; end if;

  v_month := date_trunc('month', p_month)::date;

  insert into public.payments (child_id, month, status, updated_at)
  values (p_child_id, v_month, 'paid', now())
  on conflict (child_id, month) do update
  set status = 'paid',
      updated_at = now()
  returning id into v_payment_id;

  insert into public.payment_receipts (
    payment_id,
    child_id,
    branch_id,
    amount,
    payment_method,
    received_at,
    confirmed_by_profile_id,
    note
  ) values (
    v_payment_id,
    p_child_id,
    v_branch_id,
    round(p_amount::numeric, 2),
    p_payment_method,
    p_received_at,
    v_profile_id,
    nullif(trim(coalesce(p_note, '')), '')
  ) returning id into v_receipt_id;

  v_account_id := private.business_payment_account_id(p_payment_method, v_branch_id);

  insert into public.cashflow_transactions (
    transaction_date,
    direction,
    amount,
    branch_id,
    account_id,
    source_type,
    source_id,
    description,
    created_by_profile_id,
    approved_by_profile_id
  ) values (
    (p_received_at at time zone 'Asia/Irkutsk')::date,
    'income',
    round(p_amount::numeric, 2),
    v_branch_id,
    v_account_id,
    'payment_receipt',
    v_receipt_id,
    'Оплата обучения · ' || coalesce(v_child_name, 'Ученик') || ' · ' || to_char(v_month, 'MM.YYYY'),
    v_profile_id,
    v_profile_id
  ) returning id into v_transaction_id;

  update public.payment_receipts
  set cashflow_transaction_id = v_transaction_id,
      updated_at = now()
  where id = v_receipt_id;

  update public.children
  set payment_status = 'paid'
  where id = p_child_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'payment_receipt',
    v_receipt_id,
    'confirmed',
    v_profile_id,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'child_id', p_child_id,
      'payment_id', v_payment_id,
      'branch', v_branch_name,
      'amount', round(p_amount::numeric, 2),
      'payment_method', p_payment_method
    )
  );

  return jsonb_build_object(
    'receiptId', v_receipt_id,
    'paymentId', v_payment_id,
    'cashflowTransactionId', v_transaction_id,
    'branch', v_branch_name,
    'amount', round(p_amount::numeric, 2),
    'paymentMethod', p_payment_method
  );
end;
$$;

create or replace function public.staff_void_payment_receipt(
  p_receipt_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_receipt public.payment_receipts%rowtype;
  v_latest_status text;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'void reason required'; end if;

  select * into v_receipt
  from public.payment_receipts
  where id = p_receipt_id
  for update;

  if not found or v_receipt.voided_at is not null then raise exception 'receipt not found'; end if;
  if not private.payment_staff_can_manage_child(v_receipt.child_id)
     or not private.business_can_access_branch(v_receipt.branch_id) then
    raise exception 'not authorized';
  end if;

  if v_receipt.cashflow_transaction_id is not null then
    delete from public.cashflow_transactions
    where id = v_receipt.cashflow_transaction_id
      and source_type = 'payment_receipt'
      and source_id = v_receipt.id;
  end if;

  update public.payment_receipts
  set voided_at = now(),
      voided_by_profile_id = v_profile_id,
      void_reason = trim(p_reason),
      updated_at = now()
  where id = v_receipt.id;

  if not exists (
    select 1
    from public.payment_receipts pr
    where pr.payment_id = v_receipt.payment_id
      and pr.id <> v_receipt.id
      and pr.voided_at is null
  ) then
    update public.payments
    set status = 'pending', updated_at = now()
    where id = v_receipt.payment_id;
  end if;

  select p.status into v_latest_status
  from public.payments p
  where p.child_id = v_receipt.child_id
  order by p.month desc, p.updated_at desc
  limit 1;

  update public.children
  set payment_status = coalesce(v_latest_status, 'pending')
  where id = v_receipt.child_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'payment_receipt',
    v_receipt.id,
    'voided',
    v_profile_id,
    trim(p_reason),
    jsonb_build_object('payment_id', v_receipt.payment_id, 'amount', v_receipt.amount)
  );

  return v_receipt.id;
end;
$$;

create or replace function public.staff_payment_receipts(p_child_id uuid)
returns table (
  id uuid,
  payment_id uuid,
  month date,
  amount numeric,
  payment_method text,
  received_at timestamptz,
  confirmed_by_name text,
  voided_at timestamptz,
  void_reason text
)
language sql
security definer
set search_path = public, private, auth
as $$
  select
    pr.id,
    pr.payment_id,
    p.month,
    pr.amount,
    pr.payment_method,
    pr.received_at,
    coalesce(up.staff_display_name, up.full_name, 'Сотрудник OPEN STARS'),
    pr.voided_at,
    pr.void_reason
  from public.payment_receipts pr
  join public.payments p on p.id = pr.payment_id
  left join public.users_profile up on up.id = pr.confirmed_by_profile_id
  where pr.child_id = p_child_id
    and private.payment_staff_can_manage_child(p_child_id)
  order by pr.received_at desc, pr.created_at desc
  limit 100
$$;

revoke all on function public.staff_confirm_payment_receipt(uuid, date, numeric, text, timestamptz, text) from public, anon;
revoke all on function public.staff_void_payment_receipt(uuid, text) from public, anon;
revoke all on function public.staff_payment_receipts(uuid) from public, anon;
grant execute on function public.staff_confirm_payment_receipt(uuid, date, numeric, text, timestamptz, text) to authenticated;
grant execute on function public.staff_void_payment_receipt(uuid, text) to authenticated;
grant execute on function public.staff_payment_receipts(uuid) to authenticated;
