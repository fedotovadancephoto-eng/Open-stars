-- OPEN STARS · monthly charges, debt and partial payments
-- Additive migration. Existing payments, receipts and cashflow rows are not rewritten.

create table if not exists public.monthly_payment_charges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  month date not null,
  expected_amount numeric(14,2) not null check (expected_amount >= 0),
  due_date date,
  note text,
  created_by_profile_id uuid not null references public.users_profile(id) on delete restrict,
  updated_by_profile_id uuid not null references public.users_profile(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, month),
  check (month = date_trunc('month', month)::date)
);

create index if not exists monthly_payment_charges_month_branch_idx
  on public.monthly_payment_charges (month, branch_id);
create index if not exists monthly_payment_charges_child_month_idx
  on public.monthly_payment_charges (child_id, month desc);

alter table public.monthly_payment_charges enable row level security;

drop policy if exists monthly_payment_charges_staff_read on public.monthly_payment_charges;
create policy monthly_payment_charges_staff_read on public.monthly_payment_charges
for select to authenticated
using (
  private.current_role() in ('owner', 'manager', 'project_director', 'admin')
  and private.payment_staff_can_manage_child(child_id)
  and private.business_can_access_branch(branch_id)
);

revoke all on public.monthly_payment_charges from anon, public;
revoke insert, update, delete on public.monthly_payment_charges from authenticated;
grant select on public.monthly_payment_charges to authenticated;

create or replace function public.staff_set_monthly_charge(
  p_child_id uuid,
  p_month date,
  p_expected_amount numeric,
  p_due_date date default null,
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
  v_branch_id uuid;
  v_branch_name text;
  v_child_name text;
  v_charge_id uuid;
  v_old_amount numeric;
  v_old_due_date date;
  v_old_note text;
  v_action text := 'created';
begin
  if v_profile_id is null
     or v_role not in ('owner', 'manager', 'project_director', 'admin')
     or not private.payment_staff_can_manage_child(p_child_id) then
    raise exception 'not authorized';
  end if;

  if p_month is null then raise exception 'month required'; end if;
  if p_expected_amount is null or p_expected_amount < 0 then raise exception 'invalid expected amount'; end if;

  select b.id, c.branch, concat_ws(' ', c.first_name, c.last_name)
    into v_branch_id, v_branch_name, v_child_name
  from public.children c
  join public.branches b on b.name = c.branch and b.is_active
  where c.id = p_child_id
    and c.archived_at is null;

  if v_branch_id is null then raise exception 'invalid branch'; end if;
  if not private.business_can_access_branch(v_branch_id) then raise exception 'not authorized'; end if;

  v_month := date_trunc('month', p_month)::date;

  select mpc.id, mpc.expected_amount, mpc.due_date, mpc.note
    into v_charge_id, v_old_amount, v_old_due_date, v_old_note
  from public.monthly_payment_charges mpc
  where mpc.child_id = p_child_id
    and mpc.month = v_month
  for update;

  if found then
    v_action := 'updated';
    update public.monthly_payment_charges
    set branch_id = v_branch_id,
        expected_amount = round(p_expected_amount::numeric, 2),
        due_date = p_due_date,
        note = nullif(trim(coalesce(p_note, '')), ''),
        updated_by_profile_id = v_profile_id,
        updated_at = now()
    where id = v_charge_id;
  else
    insert into public.monthly_payment_charges (
      child_id,
      branch_id,
      month,
      expected_amount,
      due_date,
      note,
      created_by_profile_id,
      updated_by_profile_id
    ) values (
      p_child_id,
      v_branch_id,
      v_month,
      round(p_expected_amount::numeric, 2),
      p_due_date,
      nullif(trim(coalesce(p_note, '')), ''),
      v_profile_id,
      v_profile_id
    ) returning id into v_charge_id;
  end if;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'monthly_payment_charge',
    v_charge_id,
    v_action,
    v_profile_id,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'child_id', p_child_id,
      'child_name', coalesce(v_child_name, ''),
      'branch', coalesce(v_branch_name, ''),
      'month', v_month,
      'old_expected_amount', v_old_amount,
      'new_expected_amount', round(p_expected_amount::numeric, 2),
      'old_due_date', v_old_due_date,
      'new_due_date', p_due_date,
      'old_note', v_old_note,
      'new_note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  return jsonb_build_object(
    'chargeId', v_charge_id,
    'childId', p_child_id,
    'branch', v_branch_name,
    'month', v_month,
    'expectedAmount', round(p_expected_amount::numeric, 2),
    'dueDate', coalesce(p_due_date::text, ''),
    'note', coalesce(nullif(trim(coalesce(p_note, '')), ''), '')
  );
end;
$$;

revoke all on function public.staff_set_monthly_charge(uuid,date,numeric,date,text) from public, anon;
grant execute on function public.staff_set_monthly_charge(uuid,date,numeric,date,text) to authenticated;

create or replace function public.staff_payment_overview(
  p_month date,
  p_branch text default null
)
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
  if v_role not in ('owner','project_director','manager','admin') then
    raise exception 'not authorized';
  end if;

  v_month := date_trunc('month', coalesce(p_month, current_date))::date;

  if v_role = 'admin' then
    if nullif(trim(coalesce(v_staff_branch, '')), '') is null then
      raise exception 'invalid branch';
    end if;
    if nullif(trim(coalesce(p_branch, '')), '') is not null
       and trim(p_branch) <> v_staff_branch then
      raise exception 'not authorized';
    end if;
    v_scope_branch := v_staff_branch;
  else
    v_scope_branch := nullif(trim(coalesce(p_branch, '')), '');
    if v_scope_branch is not null
       and not exists (
         select 1 from public.branches b
         where b.is_active and b.name = v_scope_branch
       ) then
      raise exception 'invalid branch';
    end if;
  end if;

  with base as (
    select c.id, c.first_name, c.last_name, c.branch, c.group_name
    from public.children c
    where c.archived_at is null
      and (v_scope_branch is null or c.branch = v_scope_branch)
  ),
  receipt_agg as (
    select pr.child_id,
           sum(pr.amount)::numeric as amount_paid
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    join base b on b.id = pr.child_id
    where p.month = v_month
      and pr.voided_at is null
    group by pr.child_id
  ),
  latest_receipt as (
    select distinct on (pr.child_id)
           pr.child_id,
           pr.id as receipt_id,
           pr.payment_method,
           pr.received_at
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    join base b on b.id = pr.child_id
    where p.month = v_month
      and pr.voided_at is null
    order by pr.child_id, pr.received_at desc, pr.created_at desc
  ),
  payment_rows as (
    select p.child_id, p.status
    from public.payments p
    join base b on b.id = p.child_id
    where p.month = v_month
  ),
  charge_rows as (
    select mpc.child_id, mpc.id as charge_id, mpc.expected_amount, mpc.due_date, coalesce(mpc.note, '') as charge_note
    from public.monthly_payment_charges mpc
    join base b on b.id = mpc.child_id
    where mpc.month = v_month
  ),
  rows as (
    select
      b.id,
      concat_ws(' ', b.first_name, b.last_name) as name,
      b.branch,
      coalesce(b.group_name, '') as group_name,
      cr.charge_id,
      cr.expected_amount,
      cr.due_date,
      coalesce(cr.charge_note, '') as charge_note,
      coalesce(ra.amount_paid, 0)::numeric as amount_paid,
      case when cr.charge_id is null then null
           else greatest(cr.expected_amount - coalesce(ra.amount_paid, 0), 0)::numeric end as remaining_amount,
      case when cr.charge_id is null then null
           else greatest(coalesce(ra.amount_paid, 0) - cr.expected_amount, 0)::numeric end as overpaid_amount,
      lr.receipt_id,
      coalesce(lr.payment_method, '') as latest_method,
      lr.received_at as latest_received_at,
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
    coalesce(jsonb_agg(
      jsonb_build_object(
        'childId', r.id,
        'name', r.name,
        'branch', r.branch,
        'groupName', r.group_name,
        'state', r.state,
        'chargeId', coalesce(r.charge_id::text, ''),
        'chargeSet', r.charge_id is not null,
        'expectedAmount', coalesce(r.expected_amount, 0),
        'amountPaid', r.amount_paid,
        'remainingAmount', coalesce(r.remaining_amount, 0),
        'overpaidAmount', coalesce(r.overpaid_amount, 0),
        'dueDate', coalesce(r.due_date::text, ''),
        'chargeNote', r.charge_note,
        'latestReceiptId', coalesce(r.receipt_id::text, ''),
        'latestMethod', r.latest_method,
        'latestReceivedAt', coalesce(r.latest_received_at::text, ''),
        'paymentRecordStatus', r.payment_record_status
      )
      order by
        case r.state
          when 'overdue' then 0
          when 'partial' then 1
          when 'needs_charge' then 2
          when 'needs_amount' then 3
          when 'pending' then 4
          when 'overpaid' then 5
          when 'paid' then 6
          else 7
        end,
        r.name
    ), '[]'::jsonb),
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
  into v_students, v_total, v_paid, v_partial, v_needs_charge, v_needs_amount,
       v_pending, v_overdue, v_overpaid, v_no_charge, v_received,
       v_collected, v_charged, v_remaining, v_overpaid_amount
  from rows r;

  return jsonb_build_object(
    'role', v_role,
    'staffBranch', coalesce(v_staff_branch, ''),
    'branch', coalesce(v_scope_branch, 'Все филиалы'),
    'month', v_month,
    'totalStudents', v_total,
    'paidStudents', v_paid,
    'partialStudents', v_partial,
    'needsChargeStudents', v_needs_charge,
    'needsAmountStudents', v_needs_amount,
    'pendingStudents', v_pending,
    'overdueStudents', v_overdue,
    'overpaidStudents', v_overpaid,
    'noChargeStudents', v_no_charge,
    'receivedStudents', v_received,
    'outstandingStudents', v_partial + v_needs_charge + v_needs_amount + v_pending + v_overdue,
    'collectedAmount', round(v_collected, 2),
    'chargedAmount', round(v_charged, 2),
    'remainingAmount', round(v_remaining, 2),
    'overpaidAmount', round(v_overpaid_amount, 2),
    'students', v_students
  );
end;
$$;

revoke all on function public.staff_payment_overview(date,text) from public, anon;
grant execute on function public.staff_payment_overview(date,text) to authenticated;
