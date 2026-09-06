-- Run after 20260906_payment_charge_consistency.sql.

do $$
declare
  v_validation_definition text;
  v_recompute_definition text;
  v_refund_guard_definition text;
begin
  if private.payment_status_from_totals(true, 6000, current_date + 1, 3000) <> 'pending' then
    raise exception 'partial payment before due date must be pending';
  end if;

  if private.payment_status_from_totals(true, 6000, current_date - 1, 3000) <> 'overdue' then
    raise exception 'partial payment after due date must be overdue';
  end if;

  if private.payment_status_from_totals(true, 6000, current_date - 1, 6000) <> 'paid' then
    raise exception 'full payment must be paid';
  end if;

  if private.payment_status_from_totals(true, 0, current_date, 1000) <> 'paid' then
    raise exception 'a receipt against a zero charge must not leave the parent pending';
  end if;

  select pg_get_functiondef('private.validate_tuition_receipt_change()'::regprocedure)
    into v_validation_definition;
  select pg_get_functiondef('private.recompute_tuition_payment_status(uuid,date)'::regprocedure)
    into v_recompute_definition;
  select pg_get_functiondef('private.guard_refunded_payment_receipt()'::regprocedure)
    into v_refund_guard_definition;

  if position('monthly charge required before payment receipt' in v_validation_definition) = 0
     or position('receipt cannot be both voided and refunded' in v_validation_definition) = 0 then
    raise exception 'active receipt validation invariants are missing';
  end if;

  if position('receipt already refunded' in v_refund_guard_definition) = 0 then
    raise exception 'refunded receipt immutability invariant is missing';
  end if;

  if position('pr.refunded_at is null' in v_recompute_definition) = 0
     or position('payment_status_from_totals' in v_recompute_definition) = 0 then
    raise exception 'payment status recomputation invariants are missing';
  end if;
end;
$$;
