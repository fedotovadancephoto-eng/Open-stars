-- Run after 20260906_payment_security_invariants.sql.
-- The script is read-only and fails immediately when a release invariant is broken.

do $$
declare
  v_refund_definition text;
begin
  if has_function_privilege(
    'anon',
    'public.complete_staff_invite_claim(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute complete_staff_invite_claim';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.complete_staff_invite_claim(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute complete_staff_invite_claim';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.complete_staff_invite_claim(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute complete_staff_invite_claim';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.staff_bulk_set_monthly_charge(date,text,text,numeric,date,text)',
    'EXECUTE'
  ) then
    raise exception 'bulk monthly charges must stay disabled';
  end if;

  if private.payment_status_from_totals(true, 6000, current_date + 1, 3000) <> 'pending' then
    raise exception 'partial payment before due date must be pending';
  end if;

  if private.payment_status_from_totals(true, 6000, current_date - 1, 3000) <> 'overdue' then
    raise exception 'partial payment after due date must be overdue';
  end if;

  if private.payment_status_from_totals(true, 6000, current_date - 1, 6000) <> 'paid' then
    raise exception 'fully paid charge must stay paid';
  end if;

  if private.payment_status_from_totals(false, null, null, 1000) <> 'paid'
     or private.payment_status_from_totals(false, null, null, 0) <> 'pending' then
    raise exception 'legacy payment fallback is incorrect';
  end if;

  select pg_get_functiondef(
    'public.owner_refund_payment_receipt(uuid,timestamptz,text)'::regprocedure
  ) into v_refund_definition;

  if position('v_active_amount' in v_refund_definition) = 0
     or position('monthly_payment_charges' in v_refund_definition) = 0
     or position('payment_status_from_totals' in v_refund_definition) = 0 then
    raise exception 'tuition refund must recompute payment status from remaining receipts';
  end if;
end;
$$;
