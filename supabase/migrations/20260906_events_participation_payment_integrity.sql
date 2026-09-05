-- OPEN STARS · events participation/payment integrity
-- Prevent contradictory states: paid + declined, and payments for cancelled participation.

create or replace function public.parent_set_event_participation(
  p_event_id uuid,
  p_child_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_event public.events%rowtype;
  v_branch_id uuid;
  v_participant_id uuid;
begin
  if p_status not in ('participating', 'declined') then
    raise exception 'invalid participation status';
  end if;

  if not private.event_parent_owns_child(p_child_id) then
    raise exception 'not authorized';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id;

  if not found or v_event.status <> 'open' then
    raise exception 'event is not open';
  end if;

  select b.id into v_branch_id
  from public.children c
  join public.branches b on b.name = c.branch and b.is_active
  where c.id = p_child_id
    and c.archived_at is null;

  if v_branch_id is null then
    raise exception 'invalid branch';
  end if;

  if v_event.branch_id is not null and v_event.branch_id <> v_branch_id then
    raise exception 'event unavailable for branch';
  end if;

  if p_status = 'declined' and exists (
    select 1
    from public.event_participants p
    join public.event_payments pay
      on pay.participant_id = p.id
     and pay.voided_at is null
    where p.event_id = p_event_id
      and p.child_id = p_child_id
  ) then
    raise exception 'После оплаты отмена участия через кабинет недоступна. Обратитесь к администратору.';
  end if;

  insert into public.event_participants (
    event_id,
    child_id,
    branch_id,
    status,
    fee_amount
  ) values (
    p_event_id,
    p_child_id,
    v_branch_id,
    p_status,
    v_event.default_fee
  )
  on conflict (event_id, child_id) do update
  set status = excluded.status,
      updated_at = now()
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

create or replace function public.staff_confirm_event_payment(
  p_participant_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_received_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_profile_id uuid := private.business_current_profile_id();
  v_participant public.event_participants%rowtype;
  v_event_title text;
  v_event_status text;
  v_child_name text;
  v_payment_id uuid;
  v_transaction_id uuid;
  v_account_id uuid;
begin
  if v_profile_id is null
     or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  if p_payment_method not in ('online', 'cash', 'bank_transfer', 'other') then
    raise exception 'invalid payment method';
  end if;

  select * into v_participant
  from public.event_participants
  where id = p_participant_id;

  if not found or not private.business_can_access_branch(v_participant.branch_id) then
    raise exception 'not authorized';
  end if;

  if v_participant.status in ('declined', 'cancelled') then
    raise exception 'Участие отменено. Сначала нужно снова подтвердить участие.';
  end if;

  select e.title, e.status, concat_ws(' ', c.first_name, c.last_name)
    into v_event_title, v_event_status, v_child_name
  from public.events e
  join public.children c on c.id = v_participant.child_id
  where e.id = v_participant.event_id;

  if v_event_status = 'cancelled' then
    raise exception 'Мероприятие отменено. Оплату принять нельзя.';
  end if;

  insert into public.event_payments (
    event_id,
    participant_id,
    child_id,
    branch_id,
    amount,
    payment_method,
    received_at,
    note
  ) values (
    v_participant.event_id,
    v_participant.id,
    v_participant.child_id,
    v_participant.branch_id,
    round(p_amount::numeric, 2),
    p_payment_method,
    coalesce(p_received_at, now()),
    nullif(trim(coalesce(p_note, '')), '')
  ) returning id into v_payment_id;

  v_account_id := private.business_payment_account_id(p_payment_method, v_participant.branch_id);

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
    (coalesce(p_received_at, now()) at time zone 'Asia/Irkutsk')::date,
    'income',
    round(p_amount::numeric, 2),
    v_participant.branch_id,
    v_account_id,
    'event_payment',
    v_payment_id,
    'Мероприятие · ' || coalesce(v_event_title, 'Без названия') || ' · ' || coalesce(v_child_name, 'Ученик'),
    v_profile_id,
    v_profile_id
  ) returning id into v_transaction_id;

  update public.event_payments
  set cashflow_transaction_id = v_transaction_id,
      updated_at = now()
  where id = v_payment_id;

  update public.event_participants
  set status = case when status = 'invited' then 'participating' else status end,
      updated_at = now()
  where id = v_participant.id;

  return v_payment_id;
end;
$$;

revoke execute on function public.parent_set_event_participation(uuid, uuid, text) from public, anon;
grant execute on function public.parent_set_event_participation(uuid, uuid, text) to authenticated;

revoke execute on function public.staff_confirm_event_payment(uuid, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.staff_confirm_event_payment(uuid, numeric, text, timestamptz, text) to authenticated;
