-- Run with an administrative test connection. Every fixture and audit event rolls back.
begin;
do $test$
declare
  v_owner uuid; v_manager uuid; v_branch_a uuid; v_branch_b uuid; v_category uuid;
  v_created jsonb; v_detail jsonb; v_old_detail jsonb; v_result jsonb;
  v_before_register jsonb; v_before_summary jsonb; v_after jsonb;
  v_mode text; v_transaction uuid; v_expense uuid; v_protected uuid; v_denied boolean;
  v_before_payroll bigint;
begin
  select u.auth_user_id into v_owner from public.users_profile u join public.roles r on r.id=u.role_id
    where r.name='owner' and u.auth_user_id is not null limit 1;
  select u.auth_user_id into v_manager from public.users_profile u join public.roles r on r.id=u.role_id
    where r.name='manager' and u.auth_user_id is not null limit 1;
  select id into v_branch_a from public.branches where is_active order by name limit 1;
  select id into v_branch_b from public.branches where is_active and id<>v_branch_a order by name limit 1;
  select id into v_category from public.expense_categories where code='payroll' and is_active limit 1;
  assert v_owner is not null and v_manager is not null and v_branch_b is not null and v_category is not null, 'fixtures available';
  select count(*) into v_before_payroll from public.teacher_payroll_payouts;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  execute 'set local role authenticated';
  v_before_register := public.owner_expense_register(current_date,current_date,'','',0);
  v_before_summary := public.owner_expense_summary(current_date,current_date);
  foreach v_mode in array array['branch','common','distributed'] loop
    v_created := public.owner_create_direct_expense(v_mode, case when v_mode='branch' then v_branch_a else null end,
      case when v_mode='distributed' then jsonb_build_array(jsonb_build_object('branchId',v_branch_a,'amount',120),jsonb_build_object('branchId',v_branch_b,'amount',180)) else '[]'::jsonb end,
      v_category,null,300,current_date,'cash','Rollback fixture: duplicate staff salary');
    v_transaction := (v_created->>'cashflowTransactionId')::uuid;
    v_expense := (v_created->>'expenseId')::uuid;
    v_detail := public.owner_expense_detail(v_transaction);
    v_denied:=false;
    begin perform public.owner_cancel_expense(v_transaction,v_detail->>'version',' ');
    exception when others then v_denied:=sqlerrm='cancellation reason required'; end;
    assert v_denied,'blank reason rejected';
    perform set_config('request.jwt.claim.sub',v_manager::text,true);
    v_denied:=false;
    begin perform public.owner_cancel_expense(v_transaction,v_detail->>'version','Not allowed');
    exception when others then v_denied:=sqlerrm='owner only'; end;
    assert v_denied,'manager cannot cancel owner expenses';
    perform set_config('request.jwt.claim.sub',v_owner::text,true);
    v_old_detail:=v_detail;
    perform public.owner_correct_expense(v_transaction,v_detail->>'version',v_detail||jsonb_build_object('description','Corrected fixture'),'Concurrency fixture');
    v_denied:=false;
    begin perform public.owner_cancel_expense(v_transaction,v_old_detail->>'version','Stale cancellation');
    exception when others then v_denied:=sqlerrm='expense changed'; end;
    assert v_denied,'changed expense needs fresh confirmation';
    v_detail:=public.owner_expense_detail(v_transaction);
    v_result:=public.owner_cancel_expense(v_transaction,v_detail->>'version','Duplicate staff salary');
    assert (v_result->>'cancelled')::boolean and not (v_result->>'alreadyCancelled')::boolean,'expense cancelled';
    v_result:=public.owner_cancel_expense(v_transaction,v_detail->>'version','Retry after lost response');
    assert (v_result->>'alreadyCancelled')::boolean,'retry is idempotent';
    v_after:=public.owner_expense_register(current_date,current_date,'','',0);
    assert v_after=v_before_register,'posted register and category totals restored';
    v_after:=public.owner_expense_summary(current_date,current_date);
    assert v_after=v_before_summary,'branch shares, salary category and summary restored';
    execute 'reset role';
    assert not exists(select 1 from public.cashflow_transactions where id=v_transaction),'cashflow removed';
    assert exists(select 1 from public.expense_requests where id=v_expense and status='cancelled' and cashflow_transaction_id is null and review_comment='Duplicate staff salary'),'request retained as cancelled';
    assert (select count(*) from public.approval_log where entity_type='expense_request' and entity_id=v_expense and action='owner_cancelled')=1,'one cancellation audit';
    assert exists(select 1 from public.approval_log where entity_id=v_expense and action='owner_cancelled' and (metadata->'previous_cashflow'->>'amount')::numeric=300 and metadata->'previous_expense'->>'status'='approved'),'original values retained';
    if v_mode='distributed' then
      assert (select sum(amount) from public.expense_allocations where expense_request_id=v_expense)=300,'allocation history retained';
    end if;
    assert (select count(*) from public.teacher_payroll_payouts)=v_before_payroll,'dedicated payroll unchanged';
    execute 'set local role authenticated';
    v_denied:=false;
    begin perform public.owner_correct_expense(v_transaction,v_detail->>'version',v_detail,'Cannot revive cancelled expense');
    exception when others then v_denied:=sqlerrm='expense not found'; end;
    assert v_denied,'cancelled expense cannot be edited back into totals';
  end loop;
  execute 'reset role';
  for v_protected in select id from public.cashflow_transactions where source_type in ('teacher_payroll','tuition_refund') loop
    execute 'set local role authenticated';
    v_denied:=false;
    begin perform public.owner_cancel_expense(v_protected,'invalid','Protected workflow');
    exception when others then v_denied:=sqlerrm='use source workflow'; end;
    assert v_denied,'payroll and refunds use dedicated workflow';
    execute 'reset role';
    assert exists(select 1 from public.cashflow_transactions where id=v_protected),'protected cashflow retained';
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role authenticated';
  v_denied:=false;
  begin perform public.owner_cancel_expense(v_transaction,v_detail->>'version','No identity');
  exception when others then v_denied:=sqlerrm='owner only'; end;
  assert v_denied,'missing identity denied even for retry';
  execute 'reset role';
  execute 'set local role anon';
  v_denied:=false;
  begin perform public.owner_cancel_expense(v_transaction,v_detail->>'version','Anonymous');
  exception when insufficient_privilege then v_denied:=true; end;
  assert v_denied,'anonymous API access revoked';
  execute 'reset role';
end $test$;
rollback;
