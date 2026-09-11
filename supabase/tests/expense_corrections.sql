-- All fixtures, corrections and audit events are rolled back.
begin;
do $test$
declare owner_auth uuid; other_auth uuid; category_id uuid; branch_a uuid; branch_b uuid; transaction_id uuid;
 detail jsonb; values_json jsonb; result jsonb; revised jsonb; cat jsonb; expected numeric; count_before bigint; denied boolean; real_total numeric;
begin
 select u.auth_user_id into owner_auth from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
 select id into category_id from public.expense_categories where is_active and code='household' limit 1;
 select id into branch_a from public.branches where is_active order by name limit 1;
 select id into branch_b from public.branches where is_active and id<>branch_a order by name limit 1;
 assert owner_auth is not null and category_id is not null and branch_b is not null,'fixtures available';
 perform set_config('request.jwt.claim.sub',owner_auth::text,true);
 execute 'set local role authenticated';
 result:=public.owner_create_direct_expense('branch',branch_a,'[]',category_id,null,100,current_date,'cash','Rollback fixture');
 transaction_id:=(result->>'cashflowTransactionId')::uuid;
 detail:=public.owner_expense_detail(transaction_id);
 values_json:=detail||jsonb_build_object('amount',150,'description','Corrected fixture');
 result:=public.owner_correct_expense(transaction_id,detail->>'version',values_json,'Amount correction test');
 revised:=public.owner_expense_detail(transaction_id);
 assert (revised->>'amount')::numeric=150,'expense updated';
 assert jsonb_array_length(revised->'history')=1,'audit visible';
 assert revised->>'transactionId'=transaction_id::text,'same transaction retained';
 denied:=false;begin perform public.owner_correct_expense(transaction_id,detail->>'version',values_json,'stale');exception when others then denied:=sqlerrm='expense changed';end;assert denied,'stale edit blocked';
 denied:=false;begin perform public.owner_correct_expense(transaction_id,revised->>'version',values_json,'');exception when others then denied:=sqlerrm='correction reason required';end;assert denied,'reason required';
 values_json:=revised||jsonb_build_object('allocationType','distributed','branchId',null,'amount',200,'allocations',jsonb_build_array(jsonb_build_object('branchId',branch_a,'amount',120),jsonb_build_object('branchId',branch_b,'amount',80)));
 perform public.owner_correct_expense(transaction_id,revised->>'version',values_json,'Distribution test');
 revised:=public.owner_expense_detail(transaction_id);
 assert (revised->>'amount')::numeric=200 and jsonb_array_length(revised->'allocations')=2,'distribution saved';
 values_json:=revised||jsonb_build_object('amount',201);
 denied:=false;begin perform public.owner_correct_expense(transaction_id,revised->>'version',values_json,'invalid distribution');exception when others then denied:=sqlerrm='invalid allocations';end;assert denied,'allocation mismatch blocked';
 result:=public.owner_expense_register('1900-01-01',current_date,'','',0);
 select sum((x->>'amount')::numeric) into expected from jsonb_array_elements(result->'categories') x;
 assert expected=(result->>'total')::numeric,'categories sum to full register';
 for cat in select value from jsonb_array_elements(result->'categories') loop
  revised:=public.owner_expense_register('1900-01-01',current_date,'',cat->>'id',0);
  assert (revised->>'total')::numeric=(cat->>'amount')::numeric and (revised->>'count')::bigint=(cat->>'count')::bigint,'category detail matches';
 end loop;
 execute 'reset role';
 assert (select amount from public.cashflow_transactions where id=transaction_id)=200,'cashflow updated';
 assert (select sum(amount) from public.expense_allocations where expense_request_id=(detail->>'expenseId')::uuid)=200,'allocations consistent';
 select id into transaction_id from public.cashflow_transactions where source_type='teacher_payroll' limit 1;
 if transaction_id is not null then
  denied:=false;begin perform public.owner_expense_detail(transaction_id);exception when others then denied:=sqlerrm='use source workflow';end;assert denied,'payroll protected';
 end if;
 select u.auth_user_id into other_auth from public.users_profile u join public.roles r on r.id=u.role_id where r.name='manager' and u.auth_user_id is not null limit 1;
 assert other_auth is not null,'manager fixture';
 perform set_config('request.jwt.claim.sub',other_auth::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.owner_expense_detail((detail->>'transactionId')::uuid);exception when others then denied:=sqlerrm='owner only';end;assert denied,'manager detail denied';
 denied:=false;begin perform public.owner_correct_expense((detail->>'transactionId')::uuid,detail->>'version',values_json,'test');exception when others then denied:=sqlerrm='owner only';end;assert denied,'manager correction denied';
 denied:=false;begin perform public.owner_expense_register('1900-01-01',current_date,'','',0);exception when others then denied:=sqlerrm='owner only';end;assert denied,'manager categories denied';
 execute 'reset role';
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;begin perform public.owner_expense_detail((detail->>'transactionId')::uuid);exception when others then denied:=sqlerrm='owner only';end;assert denied,'no identity denied';
end $test$;
rollback;
