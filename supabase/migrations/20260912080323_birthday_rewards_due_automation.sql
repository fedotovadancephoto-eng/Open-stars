-- Award birthday gifts without relying on a parent opening the app.
-- The programme starts on 2026-09-01. Scan the current calendar year to
-- recover a missed daily run or a birth date that was filled in later.
create or replace function private.award_due_birthday_rewards()
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_today date := timezone('Asia/Irkutsk', now())::date;
  v_from date := greatest(date '2026-09-01', date_trunc('year', timezone('Asia/Irkutsk', now()))::date);
  v_candidate record;
  v_reward_id uuid;
  v_transaction_id uuid;
  v_awarded integer := 0;
begin
  if v_today < v_from then
    return 0;
  end if;

  for v_candidate in
    select c.id as child_id, d.day::date as reward_date
    from public.children c
    cross join generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') as d(day)
    where c.archived_at is null
      and c.birth_date is not null
      and c.birth_date <= d.day::date
      and extract(month from c.birth_date) = extract(month from d.day)
      and extract(day from c.birth_date) = extract(day from d.day)
    order by c.id, d.day
  loop
    v_reward_id := null;
    insert into public.birthday_rewards (child_id, reward_year, amount)
    values (v_candidate.child_id, extract(year from v_candidate.reward_date)::integer, 10)
    on conflict (child_id, reward_year) do nothing
    returning id into v_reward_id;

    -- This is also the guard used by parent_claim_birthday_reward.
    -- Concurrent portal visits and repeated jobs cannot award a second gift.
    if v_reward_id is not null then
      insert into public.coin_transactions (
        child_id, amount, transaction_type, reason, source, source_id, created_by, created_at
      )
      values (
        v_candidate.child_id, 10, 'credit', 'Подарок ко дню рождения 🎉',
        'birthday', v_reward_id, null,
        least(now(), (v_candidate.reward_date + time '09:00') at time zone 'Asia/Irkutsk')
      )
      returning id into v_transaction_id;

      update public.birthday_rewards
      set transaction_id = v_transaction_id
      where id = v_reward_id;
      v_awarded := v_awarded + 1;
    end if;
  end loop;

  return v_awarded;
end;
$function$;

revoke all on function private.award_due_birthday_rewards() from public, anon, authenticated, service_role;

comment on function private.award_due_birthday_rewards() is
'Internal daily +10 birthday gift; Asia/Irkutsk; starts 2026-09-01; active pupils only; catches up current-year missed gifts. Existing unique child/year reward prevents duplicate portal and cron awards. Ledger date is the birthday; notification is queued on insert.';
