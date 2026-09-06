-- OPEN STARS: real tuition refunds must preserve the original receipt and create a separate cash outflow.

alter table public.payment_receipts
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by_profile_id uuid references public.users_profile(id) on delete set null,
  add column if not exists refund_reason text,
  add column if not exists refund_cashflow_transaction_id uuid references public.cashflow_transactions(id) on delete set null;

create or replace function private.guard_refunded_payment_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if old.refunded_at is not null then
    if new.payment_id is distinct from old.payment_id
       or new.child_id is distinct from old.child_id
       or new.branch_id is distinct from old.branch_id
       or new.amount is distinct from old.amount
       or new.payment_method is distinct from old.payment_method
       or new.received_at is distinct from old.received_at
       or new.cashflow_transaction_id is distinct from old.cashflow_transaction_id
       or new.voided_at is distinct from old.voided_at
       or new.voided_by_profile_id is distinct from old.voided_by_profile_id
       or new.void_reason is distinct from old.void_reason
       or new.refunded_at is distinct from old.refunded_at
       or new.refunded_by_profile_id is distinct from old.refunded_by_profile_id
       or new.refund_reason is distinct from old.refund_reason
       or new.refund_cashflow_transaction_id is distinct from old.refund_cashflow_transaction_id then
      raise exception 'receipt already refunded';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_receipts_refund_integrity on public.payment_receipts;
create trigger payment_receipts_refund_integrity
before update on public.payment_receipts
for each row execute function private.guard_refunded_payment_receipt();

create or replace function public.owner_refund_payment_receipt(
  p_receipt_id uuid,
  p_refunded_at timestamptz default now(),
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_receipt public.payment_receipts%rowtype;
  v_payment public.payments%rowtype;
  v_child_name text;
  v_branch_name text;
  v_account_id uuid;
  v_refund_cashflow_id uuid;
  v_latest_status text;
begin
  if v_profile_id is null or private.current_role() <> 'owner' then
    raise exception 'not authorized';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'refund reason required';
  end if;

  select * into v_receipt
  from public.payment_receipts
  where id = p_receipt_id
  for update;

  if not found or v_receipt.voided_at is not null then
    raise exception 'receipt not found';
  end if;
  if v_receipt.refunded_at is not null then
    return v_receipt.id;
  end if;

  select * into v_payment from public.payments where id = v_receipt.payment_id;
  if not found then raise exception 'payment not found'; end if;

  select concat_ws(' ', c.first_name, c.last_name), c.branch
    into v_child_name, v_branch_name
  from public.children c
  where c.id = v_receipt.child_id;

  if v_receipt.cashflow_transaction_id is not null then
    select ct.account_id into v_account_id
    from public.cashflow_transactions ct
    where ct.id = v_receipt.cashflow_transaction_id;
  end if;

  insert into public.cashflow_transactions (
    transaction_date, direction, amount, branch_id, account_id,
    source_type, source_id, description, created_by_profile_id, approved_by_profile_id
  ) values (
    (coalesce(p_refunded_at, now()) at time zone 'Asia/Irkutsk')::date,
    'expense',
    v_receipt.amount,
    v_receipt.branch_id,
    v_account_id,
    'tuition_refund',
    v_receipt.id,
    'Возврат обучения · ' || coalesce(v_child_name, 'Ученик') || ' · ' || to_char(v_payment.month, 'MM.YYYY') || ' · ' || trim(p_reason),
    v_profile_id,
    v_profile_id
  ) returning id into v_refund_cashflow_id;

  update public.payment_receipts
  set refunded_at = coalesce(p_refunded_at, now()),
      refunded_by_profile_id = v_profile_id,
      refund_reason = trim(p_reason),
      refund_cashflow_transaction_id = v_refund_cashflow_id,
      updated_at = now()
  where id = v_receipt.id;

  if not exists (
    select 1 from public.payment_receipts pr
    where pr.payment_id = v_receipt.payment_id
      and pr.id <> v_receipt.id
      and pr.voided_at is null
      and pr.refunded_at is null
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

  insert into public.approval_log(entity_type, entity_id, action, actor_profile_id, comment, metadata)
  values (
    'payment_receipt', v_receipt.id, 'refunded', v_profile_id, trim(p_reason),
    jsonb_build_object(
      'child_id', v_receipt.child_id,
      'branch', coalesce(v_branch_name, ''),
      'month', v_payment.month,
      'amount', v_receipt.amount,
      'refund_cashflow_transaction_id', v_refund_cashflow_id
    )
  );

  return v_receipt.id;
end;
$$;

revoke all on function public.owner_refund_payment_receipt(uuid,timestamptz,text) from public, anon;
grant execute on function public.owner_refund_payment_receipt(uuid,timestamptz,text) to authenticated;

-- Keep refunded receipts in history, but exclude them from collected totals and current payment state.
create or replace function public.staff_payment_overview(p_month date, p_branch text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_scope_branch text;
  v_month date;
  v_students jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_paid integer := 0;
  v_partial integer := 0;
  v_needs_charge integer := 0;
  v_needs_amount integer := 0;
  v_pending integer := 0;
  v_overdue integer := 0;
  v_overpaid integer := 0;
  v_no_charge integer := 0;
  v_received integer := 0;
  v_collected numeric := 0;
  v_charged numeric := 0;
  v_remaining numeric := 0;
  v_overpaid_amount numeric := 0;
begin
  if v_role not in ('owner','project_director','manager','admin') then raise exception 'not authorized'; end if;
  v_month := date_trunc('month', coalesce(p_month, current_date))::date;

  if v_role = 'admin' then
    if nullif(trim(coalesce(v_staff_branch, '')), '') is null then raise exception 'invalid branch'; end if;
    if nullif(trim(coalesce(p_branch, '')), '') is not null and trim(p_branch) <> v_staff_branch then raise exception 'not authorized'; end if;
    v_scope_branch := v_staff_branch;
  else
    v_scope_branch := nullif(trim(coalesce(p_branch, '')), '');
    if v_scope_branch is not null and not exists (select 1 from public.branches b where b.is_active and b.name = v_scope_branch) then raise exception 'invalid branch'; end if;
  end if;

  with base as (
    select c.id, c.first_name, c.last_name, c.branch, c.group_name
    from public.children c
    where c.archived_at is null and (v_scope_branch is null or c.branch = v_scope_branch)
  ),
  receipt_agg as (
    select pr.child_id, sum(pr.amount)::numeric as amount_paid
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    join base b on b.id = pr.child_id
    where p.month = v_month and pr.voided_at is null and pr.refunded_at is null
    group by pr.child_id
  ),
  latest_receipt as (
    select distinct on (pr.child_id) pr.child_id, pr.id as receipt_id, pr.payment_method, pr.received_at
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    join base b on b.id = pr.child_id
    where p.month = v_month and pr.voided_at is null and pr.refunded_at is null
    order by pr.child_id, pr.received_at desc, pr.created_at desc
  ),
  payment_rows as (
    select p.child_id, p.status from public.payments p join base b on b.id = p.child_id where p.month = v_month
  ),
  charge_rows as (
    select mpc.child_id, mpc.id as charge_id, mpc.expected_amount, mpc.due_date, coalesce(mpc.note, '') as charge_note
    from public.monthly_payment_charges mpc join base b on b.id = mpc.child_id where mpc.month = v_month
  ),
  rows as (
    select b.id, concat_ws(' ', b.first_name, b.last_name) as name, b.branch, coalesce(b.group_name, '') as group_name,
      cr.charge_id, cr.expected_amount, cr.due_date, coalesce(cr.charge_note, '') as charge_note,
      coalesce(ra.amount_paid, 0)::numeric as amount_paid,
      case when cr.charge_id is null then null else greatest(cr.expected_amount - coalesce(ra.amount_paid, 0), 0)::numeric end as remaining_amount,
      case when cr.charge_id is null then null else greatest(coalesce(ra.amount_paid, 0) - cr.expected_amount, 0)::numeric end as overpaid_amount,
      lr.receipt_id, coalesce(lr.payment_method, '') as latest_method, lr.received_at as latest_received_at,
      coalesce(pr.status, '') as payment_record_status,
      case
        when cr.charge_id is null and coalesce(ra.amount_paid, 0) > 0 then 'needs_charge'
        when cr.charge_id is null and pr.status = 'paid' then 'needs_amount'
        when cr.charge_id is null and pr.status = 'overdue' then 'overdue'
        when cr.charge_id is null then 'pending'
        when cr.expected_amount = 0 and coalesce(ra.amount_paid, 0) = 0 then 'no_charge'
        when cr.expected_amount = 0 and coalesce(ra.amount_paid, 0) > 0 then 'overpaid'
        when coalesce(ra.amount_paid, 0) = 0 and cr.due_date is not null and cr.due_date < current_date then 'overdue'
        when coalesce(ra.amount_paid, 0) = 0 then 'pending'
        when coalesce(ra.amount_paid, 0) < cr.expected_amount then 'partial'
        when coalesce(ra.amount_paid, 0) = cr.expected_amount then 'paid'
        else 'overpaid'
      end as state
    from base b
    left join receipt_agg ra on ra.child_id = b.id
    left join latest_receipt lr on lr.child_id = b.id
    left join payment_rows pr on pr.child_id = b.id
    left join charge_rows cr on cr.child_id = b.id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'childId', r.id, 'name', r.name, 'branch', r.branch, 'groupName', r.group_name, 'state', r.state,
      'chargeId', coalesce(r.charge_id::text, ''), 'chargeSet', r.charge_id is not null,
      'expectedAmount', coalesce(r.expected_amount, 0), 'amountPaid', r.amount_paid,
      'remainingAmount', coalesce(r.remaining_amount, 0), 'overpaidAmount', coalesce(r.overpaid_amount, 0),
      'dueDate', coalesce(r.due_date::text, ''), 'chargeNote', r.charge_note,
      'latestReceiptId', coalesce(r.receipt_id::text, ''), 'latestMethod', r.latest_method,
      'latestReceivedAt', coalesce(r.latest_received_at::text, ''), 'paymentRecordStatus', r.payment_record_status
    ) order by case r.state when 'overdue' then 0 when 'partial' then 1 when 'needs_charge' then 2 when 'needs_amount' then 3 when 'pending' then 4 when 'overpaid' then 5 when 'paid' then 6 else 7 end, r.name), '[]'::jsonb),
    count(*)::integer,
    count(*) filter (where r.state = 'paid')::integer,
    count(*) filter (where r.state = 'partial')::integer,
    count(*) filter (where r.state = 'needs_charge')::integer,
    count(*) filter (where r.state = 'needs_amount')::integer,
    count(*) filter (where r.state = 'pending')::integer,
    count(*) filter (where r.state = 'overdue')::integer,
    count(*) filter (where r.state = 'overpaid')::integer,
    count(*) filter (where r.state = 'no_charge')::integer,
    count(*) filter (where r.amount_paid > 0)::integer,
    coalesce(sum(r.amount_paid), 0)::numeric,
    coalesce(sum(r.expected_amount) filter (where r.charge_id is not null), 0)::numeric,
    coalesce(sum(r.remaining_amount) filter (where r.charge_id is not null), 0)::numeric,
    coalesce(sum(r.overpaid_amount) filter (where r.charge_id is not null), 0)::numeric
  into v_students, v_total, v_paid, v_partial, v_needs_charge, v_needs_amount, v_pending, v_overdue, v_overpaid, v_no_charge, v_received, v_collected, v_charged, v_remaining, v_overpaid_amount
  from rows r;

  return jsonb_build_object(
    'role', v_role, 'staffBranch', coalesce(v_staff_branch, ''), 'branch', coalesce(v_scope_branch, 'Все филиалы'), 'month', v_month,
    'totalStudents', v_total, 'paidStudents', v_paid, 'partialStudents', v_partial, 'needsChargeStudents', v_needs_charge,
    'needsAmountStudents', v_needs_amount, 'pendingStudents', v_pending, 'overdueStudents', v_overdue,
    'overpaidStudents', v_overpaid, 'noChargeStudents', v_no_charge, 'receivedStudents', v_received,
    'outstandingStudents', v_partial + v_needs_charge + v_needs_amount + v_pending + v_overdue,
    'collectedAmount', round(v_collected, 2), 'chargedAmount', round(v_charged, 2),
    'remainingAmount', round(v_remaining, 2), 'overpaidAmount', round(v_overpaid_amount, 2), 'students', v_students
  );
end;
$$;

drop function if exists public.staff_payment_receipts_v2(uuid);
create function public.staff_payment_receipts_v2(p_child_id uuid)
returns table(
  id uuid,
  payment_id uuid,
  month date,
  amount numeric,
  payment_method text,
  received_at timestamptz,
  note text,
  confirmed_by_name text,
  voided_at timestamptz,
  void_reason text,
  refunded_at timestamptz,
  refund_reason text
)
language sql
security definer
set search_path = public, private, auth
as $$
  select pr.id, pr.payment_id, p.month, pr.amount, pr.payment_method, pr.received_at,
         coalesce(pr.note, ''), coalesce(up.staff_display_name, up.full_name, 'Сотрудник OPEN STARS'),
         pr.voided_at, coalesce(pr.void_reason, ''), pr.refunded_at, coalesce(pr.refund_reason, '')
  from public.payment_receipts pr
  join public.payments p on p.id = pr.payment_id
  left join public.users_profile up on up.id = pr.confirmed_by_profile_id
  where pr.child_id = p_child_id and private.payment_staff_can_manage_child(p_child_id)
  order by pr.received_at desc, pr.created_at desc
  limit 100
$$;

revoke all on function public.staff_payment_receipts_v2(uuid) from public, anon;
grant execute on function public.staff_payment_receipts_v2(uuid) to authenticated;
