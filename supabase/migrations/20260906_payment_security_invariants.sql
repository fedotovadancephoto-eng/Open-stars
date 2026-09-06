-- OPEN STARS · payment and staff activation security invariants

-- Every child has an individual monthly charge. Keep the historical RPC for
-- audit compatibility, but make it unreachable from browser roles.
revoke all on function public.staff_bulk_set_monthly_charge(date,text,text,numeric,date,text)
  from public, anon, authenticated;

-- Staff registration is completed only by the register-staff Edge Function,
-- which calls this RPC with the service-role client after validating the code.
revoke all on function public.complete_staff_invite_claim(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.complete_staff_invite_claim(uuid,uuid)
  to service_role;

create or replace function private.payment_status_from_totals(
  p_has_charge boolean,
  p_expected_amount numeric,
  p_due_date date,
  p_active_amount numeric
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not p_has_charge and coalesce(p_active_amount, 0) > 0 then 'paid'
    when not p_has_charge then 'pending'
    when coalesce(p_active_amount, 0) >= coalesce(p_expected_amount, 0)
         and coalesce(p_expected_amount, 0) > 0 then 'paid'
    when p_due_date is not null and p_due_date < current_date then 'overdue'
    else 'pending'
  end
$$;

revoke all on function private.payment_status_from_totals(boolean,numeric,date,numeric)
  from public, anon, authenticated;

-- Recalculate the legacy payment status from the remaining non-refunded
-- receipts after a real refund. This keeps child.payment_status correct when a
-- paid month consists of several partial receipts and only one is refunded.
create or replace function public.owner_refund_payment_receipt(
  p_receipt_id uuid,
  p_refunded_at timestamptz default now(),
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
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
  v_charge_id uuid;
  v_expected_amount numeric;
  v_due_date date;
  v_active_amount numeric;
  v_recomputed_status text;
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

  select * into v_payment
  from public.payments
  where id = v_receipt.payment_id;
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

  select coalesce(sum(pr.amount), 0)
    into v_active_amount
  from public.payment_receipts pr
  where pr.payment_id = v_receipt.payment_id
    and pr.voided_at is null
    and pr.refunded_at is null;

  select mpc.id, mpc.expected_amount, mpc.due_date
    into v_charge_id, v_expected_amount, v_due_date
  from public.monthly_payment_charges mpc
  where mpc.child_id = v_receipt.child_id
    and mpc.month = v_payment.month;

  v_recomputed_status := private.payment_status_from_totals(
    v_charge_id is not null,
    v_expected_amount,
    v_due_date,
    v_active_amount
  );

  update public.payments
  set status = v_recomputed_status,
      updated_at = now()
  where id = v_receipt.payment_id;

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
      'remaining_paid_amount', v_active_amount,
      'recomputed_payment_status', v_recomputed_status,
      'refund_cashflow_transaction_id', v_refund_cashflow_id
    )
  );

  return v_receipt.id;
end;
$$;

revoke all on function public.owner_refund_payment_receipt(uuid,timestamptz,text)
  from public, anon;
grant execute on function public.owner_refund_payment_receipt(uuid,timestamptz,text)
  to authenticated;
