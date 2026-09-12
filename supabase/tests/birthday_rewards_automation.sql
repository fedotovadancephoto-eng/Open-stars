-- Regression checks for birthday rewards. All fixture and real catch-up
-- writes (including queued notifications) are rolled back.
begin;
do $test$
declare
  v_today date := timezone('Asia/Irkutsk', now())::date;
  v_year integer := extract(year from timezone('Asia/Irkutsk', now()))::integer;
  v_today_child uuid := gen_random_uuid();
  v_archived_child uuid := gen_random_uuid();
  v_future_child uuid := gen_random_uuid();
  v_unknown_child uuid := gen_random_uuid();
  v_existing_child uuid := gen_random_uuid();
  v_boundary_child uuid := gen_random_uuid();
  v_before_start_child uuid := gen_random_uuid();
  v_existing_transaction uuid;
  v_first integer;
  v_repeat integer;
begin
  if v_today < date '2026-09-01' then
    raise exception 'This regression requires the birthday programme to have started';
  end if;

  insert into public.children(id, first_name, last_name, birth_date, archived_at)
  values
    (v_today_child, 'Birthday test', 'Due', (v_today - interval '8 years')::date, null),
    (v_archived_child, 'Birthday test', 'Archived', (v_today - interval '8 years')::date, now()),
    (v_future_child, 'Birthday test', 'Future', v_today + 1, null),
    (v_unknown_child, 'Birthday test', 'Unknown', null, null),
    (v_existing_child, 'Birthday test', 'Already awarded', (v_today - interval '8 years')::date, null);

  insert into public.coin_transactions(child_id,amount,transaction_type,reason,source)
    values(v_existing_child,10,'credit','Birthday test','birthday')
    returning id into v_existing_transaction;
  insert into public.birthday_rewards(child_id,reward_year,amount,transaction_id)
    values(v_existing_child,v_year,10,v_existing_transaction);

  if v_year = 2026 then
    insert into public.children(id,first_name,last_name,birth_date)
    values
      (v_boundary_child,'Birthday test','Start boundary',date '2015-09-01'),
      (v_before_start_child,'Birthday test','Before start',date '2015-08-31');
  end if;

  v_first := private.award_due_birthday_rewards();
  v_repeat := private.award_due_birthday_rewards();
  if v_first < 1 or v_repeat <> 0 then
    raise exception 'First run/retry failed: %, %', v_first, v_repeat;
  end if;
  if (select count(*) from public.birthday_rewards where child_id=v_today_child and reward_year=v_year) <> 1
      or (select count(*) from public.coin_transactions where child_id=v_today_child and source='birthday' and amount=10) <> 1
      or (select coins from public.children where id=v_today_child) <> 10 then
    raise exception 'Birthday gift or balance is incorrect';
  end if;
  if (select timezone('Asia/Irkutsk',created_at)::date from public.coin_transactions where child_id=v_today_child) <> v_today then
    raise exception 'Birthday ledger date is incorrect';
  end if;
  if exists(select 1 from public.birthday_rewards where child_id in (v_archived_child,v_future_child,v_unknown_child)) then
    raise exception 'An ineligible pupil received a reward';
  end if;
  if (select count(*) from public.coin_transactions where child_id=v_existing_child) <> 1
      or (select transaction_id from public.birthday_rewards where child_id=v_existing_child and reward_year=v_year) <> v_existing_transaction then
    raise exception 'An existing parent-claimed gift changed or was duplicated';
  end if;
  if v_year = 2026 then
    if (select count(*) from public.birthday_rewards where child_id=v_boundary_child) <> 1
        or exists(select 1 from public.birthday_rewards where child_id=v_before_start_child)
        or (select timezone('Asia/Irkutsk',created_at)::date from public.coin_transactions where child_id=v_boundary_child) <> date '2026-09-01' then
      raise exception 'Programme start boundary or restored gift date is incorrect';
    end if;
  end if;
  if exists (
    select 1 from public.birthday_rewards r
    left join public.coin_transactions t on t.id=r.transaction_id
    where r.child_id in (v_today_child,v_existing_child,v_boundary_child)
      and (t.id is null or t.child_id <> r.child_id or t.amount <> r.amount)
  ) then raise exception 'Reward/ledger linkage is incorrect'; end if;
  if has_function_privilege('anon','private.award_due_birthday_rewards()','EXECUTE')
    or has_function_privilege('authenticated','private.award_due_birthday_rewards()','EXECUTE')
    or has_function_privilege('service_role','private.award_due_birthday_rewards()','EXECUTE')
    or (select prosecdef from pg_proc where oid='private.award_due_birthday_rewards()'::regprocedure) then
    raise exception 'The scheduler function has excessive privileges';
  end if;
end;
$test$;
rollback;
select 'PASS: birthday date, programme start, exclusions, balance, ledger link, repeat, existing award and privileges; all writes rolled back' as verification;
