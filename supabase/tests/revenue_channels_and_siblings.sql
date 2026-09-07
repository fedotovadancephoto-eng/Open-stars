-- Rollback-only regression tests: never retain test CRM or cashflow rows.
begin;
do $$
declare
  v_actor uuid; v_owner uuid; v_result jsonb; v_branch uuid;
  v_cash uuid; v_bank uuid; v_row jsonb; v_sum numeric;
begin
  select up.auth_user_id into v_actor from public.users_profile up join public.roles r on r.id=up.role_id
    where r.name='sales' and up.auth_user_id is not null limit 1;
  select up.auth_user_id into v_owner from public.users_profile up join public.roles r on r.id=up.role_id
    where r.name='owner' and up.auth_user_id is not null limit 1;
  if v_actor is null or v_owner is null then raise exception 'test requires owner and sales accounts'; end if;
  if exists(select 1 from public.crm_leads where phone_normalized='+79990000091') then raise exception 'fixture phone already in use'; end if;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform public.crm_create_lead('НЛО','Тест Семёнова Анна',null,'Тест мама','+79990000091','Другое',null,null,null,now(),null,null);
  perform public.crm_create_lead('НЛО','Тест Семёнова Мария',null,'Тест мама','+79990000091','Другое',null,null,null,now(),null,null);
  perform public.crm_create_lead('НЛО','Тест Семёнова Ольга',null,'Тест мама','+79990000091','Другое',null,null,null,now(),null,null);
  if (select count(*) from public.crm_leads where phone_normalized='+79990000091') <> 3 then raise exception 'siblings missing'; end if;
  begin
    perform public.crm_create_lead('НЛО','  ТЕСТ   СЕМЕНОВА АННА ',null,'Тест мама','89990000091','Другое',null,null,null,now(),null,null);
    raise exception 'duplicate was accepted';
  exception when raise_exception then
    if sqlerrm not like 'duplicate phone:%' then raise; end if;
  end;
  begin
    update public.crm_leads set child_name='Тест Семёнова Анна'
      where phone_normalized='+79990000091' and child_name='Тест Семёнова Мария';
    raise exception 'unique index missing';
  exception when unique_violation then null;
  end;
  begin
    perform public.owner_cashflow_month_summary('2026-09-01');
    raise exception 'sales accessed owner finances';
  exception when raise_exception then
    if sqlerrm <> 'not authorized' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  v_result:=public.owner_cashflow_month_summary('2026-09-01');
  for v_row in select value from jsonb_array_elements(
    jsonb_build_array(v_result) || (v_result->'branches'))
  loop
    select coalesce(sum((value->>'amount')::numeric),0) into v_sum
      from jsonb_array_elements(v_row->'revenueBreakdown');
    if v_sum <> (v_row->>'revenue')::numeric then raise exception 'revenue does not reconcile'; end if;
  end loop;
  if exists(select 1 from public.cashflow_transactions where transaction_date >= '2098-01-01' and transaction_date < '2098-04-01') then raise exception 'fixture period in use'; end if;
  select id into v_branch from public.branches order by id limit 1;
  select id into v_cash from public.cash_accounts where account_type='cash' limit 1;
  select id into v_bank from public.cash_accounts where account_type='bank' limit 1;
  insert into public.cashflow_transactions(transaction_date,direction,amount,branch_id,account_id,source_type,source_id)
  values
    ('2098-01-02','income',1000,v_branch,v_cash,'payment_receipt',gen_random_uuid()),
    ('2098-01-02','income',600,v_branch,v_bank,'event_payment',gen_random_uuid()),
    ('2098-01-03','expense',100,v_branch,v_cash,'tuition_refund',gen_random_uuid()),
    ('2098-01-03','expense',80,v_branch,v_bank,'event_refund',gen_random_uuid()),
    ('2098-01-04','income',50,null,null,'test_other',gen_random_uuid()),
    ('2098-01-04','expense',30,v_branch,v_cash,'test_expense',gen_random_uuid()),
    ('2098-02-01','expense',200,v_branch,v_cash,'tuition_refund',gen_random_uuid());
  v_result:=public.owner_cashflow_month_summary('2098-01-01');
  if (v_result->>'revenue')::numeric<>1470 or (v_result->>'netCashflow')::numeric<>1440 then raise exception 'fixture totals wrong'; end if;
  select sum((value->>'amount')::numeric) into v_sum from jsonb_array_elements(v_result->'revenueBreakdown') where value->>'channel'='cash';
  if v_sum is distinct from 900 then raise exception 'cash wrong'; end if;
  select sum((value->>'amount')::numeric) into v_sum from jsonb_array_elements(v_result->'revenueBreakdown') where value->>'channel'='noncash';
  if v_sum is distinct from 520 then raise exception 'noncash wrong'; end if;
  select sum((value->>'amount')::numeric) into v_sum from jsonb_array_elements(v_result->'revenueBreakdown') where value->>'channel'='unknown';
  if v_sum is distinct from 50 then raise exception 'unknown wrong'; end if;
  if (public.owner_cashflow_month_summary('2098-02-01')->>'revenue')::numeric<>-200 then raise exception 'cross month refund wrong'; end if;
  if (public.owner_cashflow_month_summary('2098-03-01')->>'revenue')::numeric<>0 then raise exception 'empty month wrong'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.owner_cashflow_month_summary('2026-09-01');
    raise exception 'anonymous accessed owner finances';
  exception when raise_exception then if sqlerrm <> 'not authorized' then raise; end if; end;
end;
$$;
rollback;
