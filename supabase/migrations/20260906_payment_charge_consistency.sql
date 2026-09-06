-- OPEN STARS · keep individual charges, receipts and parent-facing statuses consistent.

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
         and coalesce(p_active_amount, 0) > 0 then 'paid'
    when p_due_date is not null and p_due_date < current_date then 'overdue'
    else 'pending'
  end
$$;

revoke all on function private.payment_status_from_totals(boolean,numeric,date,numeric)
  from public, anon, authenticated;

create or replace function private.recompute_tuition_payment_status(
  p_child_id uuid,
  p_month date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_payment_id uuid;
  v_charge_id uuid;
  v_expected_amount numeric;
  v_due_date date;
  v_active_amount numeric;
  v_status text;
  v_latest_status text;
begin
  select p.id
    into v_payment_id
  from public.payments p
  where p.child_id = p_child_id
    and p.month = v_month
  for update;

  if v_payment_id is null then
    return null;
  end if;

  select coalesce(sum(pr.amount), 0)
    into v_active_amount
  from public.payment_receipts pr
  where pr.payment_id = v_payment_id
    and pr.voided_at is null
    and pr.refunded_at is null;

  select mpc.id, mpc.expected_amount, mpc.due_date
    into v_charge_id, v_expected_amount, v_due_date
  from public.monthly_payment_charges mpc
  where mpc.child_id = p_child_id
    and mpc.month = v_month;

  v_status := private.payment_status_from_totals(
    v_charge_id is not null,
    v_expected_amount,
    v_due_date,
    v_active_amount
  );

  update public.payments
  set status = v_status,
      updated_at = now()
  where id = v_payment_id
    and status is distinct from v_status;

  select p.status
    into v_latest_status
  from public.payments p
  where p.child_id = p_child_id
  order by p.month desc, p.updated_at desc
  limit 1;

  update public.children
  set payment_status = coalesce(v_latest_status, 'pending')
  where id = p_child_id
    and payment_status is distinct from coalesce(v_latest_status, 'pending');

  return v_status;
end;
$$;

revoke all on function private.recompute_tuition_payment_status(uuid,date)
  from public, anon, authenticated;

create or replace function private.validate_tuition_receipt_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_child_id uuid;
  v_month date;
begin
  if new.refunded_at is not null and new.voided_at is not null then
    raise exception 'receipt cannot be both voided and refunded';
  end if;

  if new.voided_at is null and new.refunded_at is null then
    select p.child_id, p.month
      into v_child_id, v_month
    from public.payments p
    where p.id = new.payment_id;

    if v_child_id is null or new.child_id <> v_child_id then
      raise exception 'invalid payment receipt';
    end if;

    if not exists (
      select 1
      from public.monthly_payment_charges mpc
      where mpc.child_id = v_child_id
        and mpc.month = v_month
    ) then
      raise exception 'monthly charge required before payment receipt';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists payment_receipts_validate_tuition_change
  on public.payment_receipts;
create trigger payment_receipts_validate_tuition_change
before insert or update on public.payment_receipts
for each row execute function private.validate_tuition_receipt_change();

create or replace function private.recompute_tuition_after_receipt_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child_id uuid;
  v_month date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select p.child_id, p.month
      into v_child_id, v_month
    from public.payments p
    where p.id = old.payment_id;
    if v_child_id is not null then
      perform private.recompute_tuition_payment_status(v_child_id, v_month);
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select p.child_id, p.month
      into v_child_id, v_month
    from public.payments p
    where p.id = new.payment_id;
    if v_child_id is not null then
      perform private.recompute_tuition_payment_status(v_child_id, v_month);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_receipts_recompute_tuition_status
  on public.payment_receipts;
create constraint trigger payment_receipts_recompute_tuition_status
after insert or update or delete on public.payment_receipts
deferrable initially deferred
for each row execute function private.recompute_tuition_after_receipt_change();

create or replace function private.recompute_tuition_after_charge_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recompute_tuition_payment_status(old.child_id, old.month);
    return old;
  end if;

  perform private.recompute_tuition_payment_status(new.child_id, new.month);
  return new;
end;
$$;

drop trigger if exists monthly_charges_recompute_tuition_status
  on public.monthly_payment_charges;
create constraint trigger monthly_charges_recompute_tuition_status
after insert or update or delete on public.monthly_payment_charges
deferrable initially deferred
for each row execute function private.recompute_tuition_after_charge_change();
