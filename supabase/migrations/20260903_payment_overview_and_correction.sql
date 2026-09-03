-- OPEN STARS · branch payment overview + safe receipt correction
-- Additive migration. Existing payments/receipts are not rewritten.

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
  v_needs_amount integer := 0;
  v_pending integer := 0;
  v_overdue integer := 0;
  v_collected numeric := 0;
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
  rows as (
    select
      b.id,
      concat_ws(' ', b.first_name, b.last_name) as name,
      b.branch,
      coalesce(b.group_name, '') as group_name,
      coalesce(ra.amount_paid, 0)::numeric as amount_paid,
      lr.receipt_id,
      coalesce(lr.payment_method, '') as latest_method,
      lr.received_at as latest_received_at,
      coalesce(pr.status, '') as payment_record_status,
      case
        when coalesce(ra.amount_paid, 0) > 0 then 'paid'
        when pr.status = 'paid' then 'needs_amount'
        when pr.status = 'overdue' then 'overdue'
        else 'pending'
      end as state
    from base b
    left join receipt_agg ra on ra.child_id = b.id
    left join latest_receipt lr on lr.child_id = b.id
    left join payment_rows pr on pr.child_id = b.id
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'childId', r.id,
        'name', r.name,
        'branch', r.branch,
        'groupName', r.group_name,
        'state', r.state,
        'amountPaid', r.amount_paid,
        'latestReceiptId', coalesce(r.receipt_id::text, ''),
        'latestMethod', r.latest_method,
        'latestReceivedAt', coalesce(r.latest_received_at::text, ''),
        'paymentRecordStatus', r.payment_record_status
      )
      order by
        case r.state when 'needs_amount' then 0 when 'overdue' then 1 when 'pending' then 2 else 3 end,
        r.name
    ), '[]'::jsonb),
    count(*)::integer,
    count(*) filter (where r.state = 'paid')::integer,
    count(*) filter (where r.state = 'needs_amount')::integer,
    count(*) filter (where r.state = 'pending')::integer,
    count(*) filter (where r.state = 'overdue')::integer,
    coalesce(sum(r.amount_paid), 0)::numeric
  into v_students, v_total, v_paid, v_needs_amount, v_pending, v_overdue, v_collected
  from rows r;

  return jsonb_build_object(
    'role', v_role,
    'staffBranch', coalesce(v_staff_branch, ''),
    'branch', coalesce(v_scope_branch, 'Все филиалы'),
    'month', v_month,
    'totalStudents', v_total,
    'paidStudents', v_paid,
    'needsAmountStudents', v_needs_amount,
    'pendingStudents', v_pending,
    'overdueStudents', v_overdue,
    'outstandingStudents', v_needs_amount + v_pending + v_overdue,
    'collectedAmount', round(v_collected, 2),
    'students', v_students
  );
end;
$$;

revoke all on function public.staff_payment_overview(date,text) from public, anon;
grant execute on function public.staff_payment_overview(date,text) to authenticated;

create or replace function public.staff_payment_receipts_v2(p_child_id uuid)
returns table (
  id uuid,
  payment_id uuid,
  month date,
  amount numeric,
  payment_method text,
  received_at timestamptz,
  note text,
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
    coalesce(pr.note, ''),
    coalesce(up.staff_display_name, up.full_name, 'Сотрудник OPEN STARS'),
    pr.voided_at,
    coalesce(pr.void_reason, '')
  from public.payment_receipts pr
  join public.payments p on p.id = pr.payment_id
  left join public.users_profile up on up.id = pr.confirmed_by_profile_id
  where pr.child_id = p_child_id
    and private.payment_staff_can_manage_child(p_child_id)
  order by pr.received_at desc, pr.created_at desc
  limit 100
$$;

revoke all on function public.staff_payment_receipts_v2(uuid) from public, anon;
grant execute on function public.staff_payment_receipts_v2(uuid) to authenticated;

create or replace function public.staff_correct_payment_receipt(
  p_receipt_id uuid,
  p_month date,
  p_amount numeric,
  p_payment_method text,
  p_received_at timestamptz,
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
  v_receipt public.payment_receipts%rowtype;
  v_old_payment_id uuid;
  v_old_month date;
  v_target_payment_id uuid;
  v_target_month date;
  v_account_id uuid;
  v_child_name text;
  v_branch_name text;
  v_old_amount numeric;
  v_old_method text;
  v_old_received_at timestamptz;
  v_old_note text;
  v_latest_status text;
begin
  if v_profile_id is null
     or v_role not in ('owner','manager','project_director','admin') then
    raise exception 'not authorized';
  end if;

  if p_month is null then raise exception 'month required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_payment_method not in ('online','cash','bank_transfer','other') then
    raise exception 'invalid payment method';
  end if;
  if p_received_at is null then raise exception 'received at required'; end if;

  select * into v_receipt
  from public.payment_receipts
  where id = p_receipt_id
  for update;

  if not found or v_receipt.voided_at is not null then
    raise exception 'receipt not found';
  end if;

  if not private.payment_staff_can_manage_child(v_receipt.child_id)
     or not private.business_can_access_branch(v_receipt.branch_id) then
    raise exception 'not authorized';
  end if;

  select p.month into v_old_month
  from public.payments p
  where p.id = v_receipt.payment_id;

  select concat_ws(' ', c.first_name, c.last_name), c.branch
    into v_child_name, v_branch_name
  from public.children c
  where c.id = v_receipt.child_id;

  v_old_payment_id := v_receipt.payment_id;
  v_old_amount := v_receipt.amount;
  v_old_method := v_receipt.payment_method;
  v_old_received_at := v_receipt.received_at;
  v_old_note := v_receipt.note;
  v_target_month := date_trunc('month', p_month)::date;

  insert into public.payments (child_id, month, status, updated_at)
  values (v_receipt.child_id, v_target_month, 'paid', now())
  on conflict (child_id, month) do update
  set status = 'paid', updated_at = now()
  returning id into v_target_payment_id;

  v_account_id := private.business_payment_account_id(p_payment_method, v_receipt.branch_id);

  update public.payment_receipts
  set payment_id = v_target_payment_id,
      amount = round(p_amount::numeric, 2),
      payment_method = p_payment_method,
      received_at = p_received_at,
      note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = v_receipt.id;

  if v_receipt.cashflow_transaction_id is not null then
    update public.cashflow_transactions
    set transaction_date = (p_received_at at time zone 'Asia/Irkutsk')::date,
        amount = round(p_amount::numeric, 2),
        account_id = v_account_id,
        description = 'Оплата обучения · ' || coalesce(v_child_name, 'Ученик') || ' · ' || to_char(v_target_month, 'MM.YYYY'),
        updated_at = now()
    where id = v_receipt.cashflow_transaction_id
      and source_type = 'payment_receipt'
      and source_id = v_receipt.id;
  end if;

  if v_target_payment_id <> v_old_payment_id
     and not exists (
       select 1
       from public.payment_receipts pr
       where pr.payment_id = v_old_payment_id
         and pr.voided_at is null
     ) then
    update public.payments
    set status = 'pending', updated_at = now()
    where id = v_old_payment_id;
  end if;

  update public.payments
  set status = 'paid', updated_at = now()
  where id = v_target_payment_id;

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
    'corrected',
    v_profile_id,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'child_id', v_receipt.child_id,
      'old_month', v_old_month,
      'new_month', v_target_month,
      'old_amount', v_old_amount,
      'new_amount', round(p_amount::numeric, 2),
      'old_payment_method', v_old_method,
      'new_payment_method', p_payment_method,
      'old_received_at', v_old_received_at,
      'new_received_at', p_received_at,
      'old_note', v_old_note,
      'new_note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  return jsonb_build_object(
    'receiptId', v_receipt.id,
    'paymentId', v_target_payment_id,
    'month', v_target_month,
    'amount', round(p_amount::numeric, 2),
    'paymentMethod', p_payment_method,
    'branch', v_branch_name
  );
end;
$$;

revoke all on function public.staff_correct_payment_receipt(uuid,date,numeric,text,timestamptz,text) from public, anon;
grant execute on function public.staff_correct_payment_receipt(uuid,date,numeric,text,timestamptz,text) to authenticated;
