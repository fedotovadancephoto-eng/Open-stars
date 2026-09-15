-- Real role/branch fixtures, no personal data. All financial writes roll back.
begin;
do $$
declare v_role text; v_actor uuid; v_context jsonb; v_teacher jsonb; v_branch text;
 v_teacher_id uuid; v_request uuid; v_payout uuid; v_expense uuid; v_cashflow uuid;
 v_result jsonb; v_row public.teacher_payroll_payouts%rowtype; v_denied boolean;
 v_date date:='2099-01-05'; v_count bigint; v_before numeric; v_other_branch text;
begin
 foreach v_role in array array['owner','manager','admin'] loop
  execute 'reset role';
  select up.auth_user_id into v_actor from public.users_profile up join public.roles r on r.id=up.role_id
    where r.name=v_role and up.auth_user_id is not null order by up.id limit 1;
  if v_actor is null then raise exception 'Missing role fixture: %',v_role; end if;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_context:=public.staff_payroll_context(current_date,current_date);
  select value into v_teacher from jsonb_array_elements(v_context->'teachers') limit 1;
  if v_teacher is null then raise exception 'Missing teacher fixture for %',v_role; end if;
  v_teacher_id:=(v_teacher->>'profileId')::uuid; v_branch:=v_teacher->>'branch';
  v_before:=(v_context->>'totalAmount')::numeric;
  v_request:=gen_random_uuid();
  v_result:=public.staff_record_masterclass_payroll(v_branch,'Rollback guest','Rollback class',v_date,10,current_date,'cash','Rollback verification',v_request,null);
  v_payout:=(v_result->>'id')::uuid;
  execute 'reset role';
  select * into v_row from public.teacher_payroll_payouts where id=v_payout;
  v_expense:=v_row.expense_request_id; v_cashflow:=v_row.cashflow_transaction_id;
  if v_row.teacher_profile_id is not null or v_row.payout_kind<>'masterclass' or v_row.teacher_name<>'Rollback guest'
    then raise exception 'Guest fixture incorrectly linked to staff'; end if;
  if not exists(select 1 from public.expense_requests where id=v_expense and amount=10 and status='approved' and cashflow_transaction_id=v_cashflow)
    or not exists(select 1 from public.expense_allocations where expense_request_id=v_expense and amount=10 and branch_id=v_row.branch_id)
    or not exists(select 1 from public.cashflow_transactions where id=v_cashflow and amount=10 and source_id=v_payout and source_type='teacher_payroll' and direction='expense')
    then raise exception 'Payment did not enter expenses and DDS atomically'; end if;
  select count(*) into v_count from public.cashflow_transactions;
  execute 'set local role authenticated';
  v_context:=public.staff_payroll_context(current_date,current_date);
  if (v_context->>'totalAmount')::numeric<>v_before+10 then raise exception 'Masterclass omitted from payroll total'; end if;
  if not exists(select 1 from jsonb_array_elements(v_context->'payouts') x where x->>'id'=v_payout::text and x->>'teacherName'='Rollback guest' and x->>'kind'='masterclass')
    then raise exception 'Guest missing from history'; end if;
  v_result:=public.staff_record_masterclass_payroll(v_branch,'Rollback guest','Rollback class',v_date,10,current_date,'cash','Rollback verification',v_request,null);
  if (v_result->>'id')::uuid<>v_payout then raise exception 'Retry returned different payout'; end if;
  v_denied:=false;
  begin perform public.staff_record_masterclass_payroll(v_branch,'Rollback guest','Changed retry',v_date,10,current_date,'cash','Rollback verification',v_request,null);
  exception when others then v_denied:=sqlerrm='request conflict'; end;
  if not v_denied then raise exception 'Changed retry not rejected'; end if;
  execute 'reset role';
  if (select count(*) from public.cashflow_transactions)<>v_count then raise exception 'Duplicate retry created DDS entry'; end if;
  execute 'set local role authenticated';
  perform public.staff_correct_masterclass_payroll(v_payout,'Rollback corrected guest','Corrected class',v_date+1,20,current_date,'bank','Corrected');
  execute 'reset role';
  if not exists(select 1 from public.teacher_payroll_payouts where id=v_payout and amount=20 and teacher_name='Rollback corrected guest' and class_date=v_date+1 and payment_method='bank')
    or not exists(select 1 from public.expense_requests where id=v_expense and amount=20 and payment_method='bank' and description like '%Corrected class%')
    or not exists(select 1 from public.expense_allocations where expense_request_id=v_expense and amount=20)
    or not exists(select 1 from public.cashflow_transactions where id=v_cashflow and amount=20 and description like '%Rollback corrected guest%'
       and account_id=private.payroll_cash_account(v_row.branch_id,'bank'))
    then raise exception 'Correction did not synchronize payroll, expenses and DDS'; end if;
  execute 'set local role authenticated';
  perform public.staff_void_teacher_payroll(v_payout,'Rollback cancellation');
  execute 'reset role';
  if exists(select 1 from public.cashflow_transactions where id=v_cashflow)
    or not exists(select 1 from public.teacher_payroll_payouts where id=v_payout and voided_at is not null and teacher_name='Rollback corrected guest')
    or not exists(select 1 from public.expense_requests where id=v_expense and status='cancelled')
    then raise exception 'Cancellation lost history or retained DDS expense'; end if;

  execute 'set local role authenticated';
  perform public.staff_record_masterclass_payroll(v_branch,v_teacher->>'name','Staff class',v_date,1,current_date,'cash','Rollback verification',gen_random_uuid(),v_teacher_id);
  perform public.staff_record_teacher_payroll(v_teacher_id,v_date,1,current_date,'cash','Rollback verification');
  perform public.staff_record_masterclass_payroll(v_branch,v_teacher->>'name','Second staff class',v_date+1,1,current_date,'cash','Rollback verification',gen_random_uuid(),v_teacher_id);
  v_denied:=false; begin perform public.staff_record_teacher_payroll(v_teacher_id,v_date,1,current_date,'cash','Rollback verification');
  exception when others then v_denied:=sqlerrm='payroll already exists'; end;
  if not v_denied then raise exception 'Weekly duplicate protection lost'; end if;
  if v_role='admin' then
   execute 'reset role';
   select name into v_other_branch from public.branches where is_active and name<>v_branch limit 1;
   execute 'set local role authenticated';
   v_denied:=false; begin perform public.staff_record_masterclass_payroll(v_other_branch,'Rollback guest','Wrong branch',v_date,1,current_date,'cash',null,gen_random_uuid(),null);
   exception when others then v_denied:=sqlerrm='not authorized'; end;
   if not v_denied then raise exception 'Administrator wrote another branch'; end if;
   if exists(select 1 from jsonb_array_elements(public.staff_payroll_context(current_date,current_date)->'payouts') x where x->>'branch'<>v_branch)
     then raise exception 'Administrator can read another branch'; end if;
  end if;
  v_denied:=false; begin perform public.staff_record_masterclass_payroll(v_branch,'','Class',v_date,1,current_date,'cash',null,gen_random_uuid(),null);
  exception when others then v_denied:=sqlerrm='masterclass teacher required'; end;
  if not v_denied then raise exception 'Missing guest name accepted'; end if;
  v_denied:=false; begin perform public.staff_record_masterclass_payroll(v_branch,'Guest','Class',v_date,'NaN'::numeric,current_date,'cash',null,gen_random_uuid(),null);
  exception when others then v_denied:=sqlerrm='invalid amount'; end;
  if not v_denied then raise exception 'Invalid amount accepted'; end if;
  v_date:=v_date+7;
 end loop;
 execute 'reset role';
 select up.auth_user_id into v_actor from public.users_profile up join public.roles r on r.id=up.role_id
   where r.name='parent' and up.auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 v_denied:=false; begin perform public.staff_record_masterclass_payroll(v_branch,'Guest','Class',v_date,1,current_date,'cash',null,gen_random_uuid(),null);
 exception when others then v_denied:=sqlerrm='not authorized'; end;
 if not v_denied then raise exception 'Parent can create payroll'; end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: guest and staff masterclass payments; owner/manager/admin; single DDS entry; retries; correction; cancellation; weekly coexistence/duplicates; branch isolation and parent denial. All financial fixtures rolled back.' as result;
