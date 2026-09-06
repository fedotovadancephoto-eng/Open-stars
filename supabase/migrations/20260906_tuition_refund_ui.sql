-- OPEN STARS: owner-facing list of real tuition payments that can still be refunded.

create or replace function public.owner_refundable_tuition_receipts()
returns table(
  receipt_id uuid,
  child_id uuid,
  child_name text,
  branch text,
  month date,
  amount numeric,
  payment_method text,
  received_at timestamptz,
  note text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_role() <> 'owner' then
    raise exception 'not authorized';
  end if;

  return query
  select
    pr.id,
    pr.child_id,
    concat_ws(' ', c.first_name, c.last_name),
    coalesce(c.branch, ''),
    p.month,
    pr.amount,
    pr.payment_method,
    pr.received_at,
    coalesce(pr.note, '')
  from public.payment_receipts pr
  join public.payments p on p.id = pr.payment_id
  join public.children c on c.id = pr.child_id
  where pr.voided_at is null
    and pr.refunded_at is null
  order by pr.received_at desc, pr.created_at desc
  limit 500;
end;
$$;

revoke all on function public.owner_refundable_tuition_receipts() from public, anon;
grant execute on function public.owner_refundable_tuition_receipts() to authenticated;
