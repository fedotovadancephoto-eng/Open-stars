-- Event lifecycle integrity: keep a parent's event history visible, support full refunds,
-- and prevent cancellation while money is still active on an event.

alter table public.event_payments
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by_profile_id uuid references public.users_profile(id) on delete set null,
  add column if not exists refund_reason text,
  add column if not exists refund_cashflow_transaction_id uuid references public.cashflow_transactions(id) on delete set null;

create index if not exists event_payments_event_active_idx
  on public.event_payments(event_id)
  where voided_at is null and refunded_at is null;

create or replace function private.event_parent_has_participation(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
      and private.event_parent_owns_child(ep.child_id)
  )
$$;

revoke execute on function private.event_parent_has_participation(uuid) from public, anon;
grant execute on function private.event_parent_has_participation(uuid) to authenticated;

drop policy if exists events_read on public.events;
create policy events_read
on public.events
for select
to authenticated
using (
  private.current_role() = any (array['owner'::text, 'manager'::text, 'project_director'::text])
  or (
    private.current_role() = 'admin'::text
    and (branch_id is null or private.business_can_access_branch(branch_id))
  )
  or (
    private.current_role() = 'parent'::text
    and (
      (status = 'open'::text and private.event_parent_can_see(id))
      or private.event_parent_has_participation(id)
    )
  )
);

create or replace function public.owner_update_event(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_location text default null,
  p_branch_id uuid default null,
  p_default_fee numeric default null,
  p_status text default 'planned'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_role() <> 'owner' then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then raise exception 'title required'; end if;
  if p_starts_at is null then raise exception 'starts_at required'; end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then raise exception 'invalid end time'; end if;
  if p_default_fee is not null and p_default_fee < 0 then raise exception 'invalid fee'; end if;
  if p_status not in ('planned', 'open', 'closed', 'completed', 'cancelled') then raise exception 'invalid status'; end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b where b.id = p_branch_id and b.is_active
  ) then raise exception 'invalid branch'; end if;

  if p_status = 'cancelled' and exists (
    select 1 from public.event_payments ep
    where ep.event_id = p_event_id
      and ep.voided_at is null
      and ep.refunded_at is null
  ) then
    raise exception 'event has active payments';
  end if;

  update public.events
  set title = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      location = nullif(trim(coalesce(p_location, '')), ''),
      branch_id = p_branch_id,
      default_fee = case when p_default_fee is null then null else round(p_default_fee::numeric, 2) end,
      status = p_status,
      updated_at = now()
  where id = p_event_id;

  if not found then raise exception 'event not found'; end if;
  return p_event_id;
end;
$$;

create or replace function public.owner_refund_event_payment(
  p_payment_id uuid,
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
  v_payment public.event_payments%rowtype;
  v_event_title text;
  v_child_name text;
  v_account_id uuid;
  v_refund_cashflow_id uuid;
begin
  if v_profile_id is null or private.current_role() <> 'owner' then
    raise exception 'not authorized';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'refund reason required';
  end if;

  select * into v_payment
  from public.event_payments
  where id = p_payment_id
  for update;

  if not found or v_payment.voided_at is not null then
    raise exception 'payment not found';
  end if;
  if v_payment.refunded_at is not null then
    return v_payment.id;
  end if;

  select e.title, concat_ws(' ', c.first_name, c.last_name)
    into v_event_title, v_child_name
  from public.events e
  join public.children c on c.id = v_payment.child_id
  where e.id = v_payment.event_id;

  if v_payment.cashflow_transaction_id is not null then
    select ct.account_id into v_account_id
    from public.cashflow_transactions ct
    where ct.id = v_payment.cashflow_transaction_id;
  end if;

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
    (coalesce(p_refunded_at, now()) at time zone 'Asia/Irkutsk')::date,
    'expense',
    v_payment.amount,
    v_payment.branch_id,
    v_account_id,
    'event_refund',
    v_payment.id,
    'Возврат мероприятия · ' || coalesce(v_event_title, 'Без названия') || ' · ' || coalesce(v_child_name, 'Ученик') || ' · ' || trim(p_reason),
    v_profile_id,
    v_profile_id
  )
  returning id into v_refund_cashflow_id;

  update public.event_payments
  set refunded_at = coalesce(p_refunded_at, now()),
      refunded_by_profile_id = v_profile_id,
      refund_reason = trim(p_reason),
      refund_cashflow_transaction_id = v_refund_cashflow_id,
      updated_at = now()
  where id = v_payment.id;

  return v_payment.id;
end;
$$;

revoke execute on function public.owner_refund_event_payment(uuid, timestamptz, text) from public, anon;
grant execute on function public.owner_refund_event_payment(uuid, timestamptz, text) to authenticated;

create or replace function public.owner_event_financial_summary(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.current_role() <> 'owner' then null
    else jsonb_build_object(
      'eventId', e.id,
      'title', e.title,
      'revenue', coalesce((
        select sum(ep.amount)
        from public.event_payments ep
        where ep.event_id = e.id
          and ep.voided_at is null
          and ep.refunded_at is null
      ), 0),
      'expenses', coalesce((
        select sum(ex.amount)
        from public.event_expenses ex
        where ex.event_id = e.id
      ), 0),
      'profit',
        coalesce((
          select sum(ep.amount)
          from public.event_payments ep
          where ep.event_id = e.id
            and ep.voided_at is null
            and ep.refunded_at is null
        ), 0)
        - coalesce((
          select sum(ex.amount)
          from public.event_expenses ex
          where ex.event_id = e.id
        ), 0),
      'participants', (
        select count(*)
        from public.event_participants p
        where p.event_id = e.id and p.status = 'participating'
      )
    )
  end
  from public.events e
  where e.id = p_event_id
$$;

revoke execute on function public.owner_event_financial_summary(uuid) from public, anon;
grant execute on function public.owner_event_financial_summary(uuid) to authenticated;
