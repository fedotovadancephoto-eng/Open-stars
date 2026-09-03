-- OPEN STARS BUSINESS · keep payment status consistent with actual receipts

create or replace function public.staff_set_payment_status(
  p_child_id uuid,
  p_month date,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_month date;
  v_has_receipt boolean;
begin
  if not private.payment_staff_can_manage_child(p_child_id) then
    raise exception 'not authorized';
  end if;
  if p_status not in ('paid','pending','overdue') then
    raise exception 'invalid status';
  end if;
  if p_month is null then
    raise exception 'month required';
  end if;

  v_month := date_trunc('month', p_month)::date;

  select exists (
    select 1
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    where p.child_id = p_child_id
      and p.month = v_month
      and pr.voided_at is null
  ) into v_has_receipt;

  if p_status = 'paid' and not v_has_receipt then
    raise exception 'payment receipt required';
  end if;

  if p_status in ('pending','overdue') and v_has_receipt then
    raise exception 'void receipt first';
  end if;

  insert into public.payments (child_id, month, due_date, status, updated_at)
  values (p_child_id, v_month, null, p_status, now())
  on conflict (child_id, month) do update
  set status = excluded.status,
      updated_at = now()
  returning id into v_id;

  update public.children
  set payment_status = p_status
  where id = p_child_id;

  return v_id;
end;
$$;

revoke all on function public.staff_set_payment_status(uuid, date, text) from public, anon;
grant execute on function public.staff_set_payment_status(uuid, date, text) to authenticated;
