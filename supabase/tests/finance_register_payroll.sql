-- Verification runs without retaining payouts or cashflow changes.
begin;
do $test$ declare actor uuid; tid uuid; ctx jsonb; res jsonb; pid uuid; total_before bigint; denied boolean; role_name text; begin
select count(*) into total_before from public.cashflow_transactions;
foreach role_name in array array['owner','manager'] loop
select u.auth_user_id into actor from public.users_profile u join public.roles r on r.id=u.role_id where r.name=role_name and u.auth_user_id is not null limit 1;
assert actor is not null,'staff exists';
perform set_config('request.jwt.claim.sub',actor::text,true);
execute 'set local role authenticated';
ctx:=public.staff_payroll_context(current_date,current_date); assert jsonb_array_length(ctx->'teachers')>0,'teachers visible';
tid:=(ctx->'teachers'->0->>'profileId')::uuid;
res:=public.staff_record_teacher_payroll(tid,'2099-01-05',1,current_date,'cash','Rollback verification');pid:=(res->>'id')::uuid;
denied:=false;begin perform public.staff_record_teacher_payroll(tid,'2099-01-05',1,current_date,'cash','Rollback verification');exception when others then denied:=sqlerrm='payroll already exists';end;assert denied,'duplicate blocked';
perform public.staff_correct_teacher_payroll(pid,'2099-01-05',2,current_date,'cash','Rollback verification');
perform public.staff_void_teacher_payroll(pid,'Rollback verification');
res:=public.staff_finance_register('payments','1900-01-01',current_date,'','cash',0);assert jsonb_array_length(res->'rows')<=50,'page size';
if role_name='owner' then
res:=public.staff_finance_register('expenses','1900-01-01',current_date,'','all',0);
assert (res->>'count')::integer>=0,'expense count';
else
denied:=false;begin perform public.staff_finance_register('expenses','1900-01-01',current_date,'','all',0);exception when others then denied:=sqlerrm='not authorized';end;assert denied,'owner-only expenses';
end if;
execute 'reset role';
end loop;
assert (select count(*) from public.cashflow_transactions)=total_before,'no cashflow left by cancelled tests';
perform set_config('request.jwt.claim.sub','',true);
denied:=false;begin perform public.staff_payroll_context(null,null);exception when others then denied:=sqlerrm='not authorized';end;assert denied,'anonymous denied';
end $test$;
do $verify$ declare actor uuid; r jsonb; expected bigint; denied boolean; begin
select u.auth_user_id into actor from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
perform set_config('request.jwt.claim.sub',actor::text,true);
r:=public.staff_finance_register('expenses','1900-01-01',current_date,'','all',0);
select count(*) into expected from public.cashflow_transactions where direction='expense' and transaction_date between '1900-01-01' and current_date;
assert (r->>'count')::bigint=expected,'full expenses without truncation';
r:=public.staff_finance_register('payments','1900-01-01',current_date,'','cash',0);
select count(*) into expected from public.payment_receipts where voided_at is null and payment_method='cash' and (received_at at time zone 'Asia/Irkutsk')::date between '1900-01-01' and current_date;
assert (r->>'count')::bigint=expected,'cash receipts exact';
select u.auth_user_id into actor from public.users_profile u join public.roles r on r.id=u.role_id where r.name='admin' and u.auth_user_id is not null and u.staff_branch<>'НЛО' limit 1;
assert actor is not null,'admin fixture';
perform set_config('request.jwt.claim.sub',actor::text,true);
denied:=false;begin perform public.staff_finance_register('payments','1900-01-01',current_date,'НЛО','all',0);exception when others then denied:=sqlerrm='not authorized';end;assert denied,'admin branch isolation';
end $verify$;
rollback;
