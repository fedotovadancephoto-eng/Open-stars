-- Owner-only expense detail and correction; payroll/refunds keep their dedicated workflows.
create function finance_reports.expense_detail(p_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.cashflow_transactions%rowtype; e public.expense_requests%rowtype; alloc jsonb; history jsonb;
begin
 if auth.uid() is null or coalesce(private.current_role(),'')<>'owner' then raise exception 'owner only'; end if;
 select * into t from public.cashflow_transactions where id=p_transaction_id and direction='expense';
 if not found then raise exception 'expense not found'; end if;
 if t.source_type not in ('owner_direct_expense','expense_request','crm_campaign_expense') then raise exception 'use source workflow'; end if;
 select * into e from public.expense_requests where id=t.source_id and cashflow_transaction_id=t.id and status='approved';
 if not found then raise exception 'expense not found'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('branchId',branch_id,'amount',amount) order by branch_id),'[]'::jsonb) into alloc from public.expense_allocations where expense_request_id=e.id;
 select coalesce(jsonb_agg(jsonb_build_object('at',l.created_at,'reason',l.comment,'by',coalesce(u.staff_display_name,u.full_name,'Директор'),
   'oldAmount',l.metadata->'previous_expense'->'amount','newAmount',l.metadata->'new_values'->'amount') order by l.created_at desc),'[]'::jsonb)
 into history from public.approval_log l left join public.users_profile u on u.id=l.actor_profile_id where l.entity_type='expense_request' and l.entity_id=e.id and l.action='owner_corrected';
 return jsonb_build_object('transactionId',t.id,'expenseId',e.id,'version',md5(to_jsonb(t)::text||to_jsonb(e)::text||alloc::text),
  'allocationType',e.allocation_type,'branchId',e.branch_id,'categoryId',e.category_id,'accountId',t.account_id,
  'amount',e.amount,'expenseDate',e.expense_date,'paymentMethod',e.payment_method,'description',e.description,'allocations',alloc,
  'campaignLinked',e.crm_campaign_id is not null,'history',history);
end $$;
revoke all on function finance_reports.expense_detail(uuid) from public,anon;
grant execute on function finance_reports.expense_detail(uuid) to authenticated;
create function public.owner_expense_detail(p_transaction_id uuid) returns jsonb language sql security invoker set search_path='' as $$select finance_reports.expense_detail(p_transaction_id)$$;
revoke all on function public.owner_expense_detail(uuid) from public,anon;
grant execute on function public.owner_expense_detail(uuid) to authenticated;

create function finance_reports.correct_expense(p_transaction_id uuid,p_version text,p_values jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
<<edit_values>>
declare t public.cashflow_transactions%rowtype; e public.expense_requests%rowtype; previous_alloc jsonb; current_detail jsonb;
 actor uuid:=private.business_current_profile_id(); allocation_type text; branch_id uuid; category_id uuid; account_id uuid;
 amount numeric; expense_date date; payment_method text; description text; allocations jsonb; item jsonb; cnt integer; distinct_cnt integer; total numeric;
begin
 if auth.uid() is null or actor is null or coalesce(private.current_role(),'')<>'owner' then raise exception 'owner only'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'correction reason required'; end if;
 select * into t from public.cashflow_transactions where id=p_transaction_id and direction='expense' for update;
 if not found then raise exception 'expense not found'; end if;
 if t.source_type not in ('owner_direct_expense','expense_request','crm_campaign_expense') then raise exception 'use source workflow'; end if;
 select * into e from public.expense_requests where id=t.source_id and cashflow_transaction_id=t.id and status='approved' for update;
 if not found then raise exception 'expense not found'; end if;
 perform 1 from public.expense_allocations ea where ea.expense_request_id=e.id for update;
 current_detail:=finance_reports.expense_detail(t.id);
 if p_version is distinct from current_detail->>'version' then raise exception 'expense changed'; end if;
 previous_alloc:=current_detail->'allocations';
 allocation_type:=p_values->>'allocationType';
 branch_id:=nullif(p_values->>'branchId','')::uuid; category_id:=nullif(p_values->>'categoryId','')::uuid; account_id:=nullif(p_values->>'accountId','')::uuid;
 amount:=round((p_values->>'amount')::numeric,2); expense_date:=(p_values->>'expenseDate')::date; payment_method:=p_values->>'paymentMethod';
 description:=nullif(btrim(p_values->>'description'),''); allocations:=coalesce(p_values->'allocations','[]'::jsonb);
 if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<=0 then raise exception 'invalid amount'; end if;
 if expense_date is null then raise exception 'invalid expense date'; end if;
 if allocation_type is null or allocation_type not in ('branch','common','distributed') then raise exception 'invalid allocation type'; end if;
 if payment_method is null or payment_method not in ('cash','bank','card','other') then raise exception 'invalid payment method'; end if;
 if not exists(select 1 from public.expense_categories ec where ec.id=category_id and (ec.is_active or ec.id=e.category_id)) then raise exception 'invalid expense category'; end if;
 if account_id is not null and not exists(select 1 from public.cash_accounts a where a.id=account_id and (a.is_active or a.id=t.account_id)) then raise exception 'invalid cash account'; end if;
 if allocation_type='branch' then
   if not exists(select 1 from public.branches b where b.id=branch_id and b.is_active) then raise exception 'invalid branch'; end if;
   allocations:=jsonb_build_array(jsonb_build_object('branchId',branch_id,'amount',amount));
 elsif allocation_type='common' then branch_id:=null; allocations:='[]'::jsonb;
 else
   branch_id:=null;
   if jsonb_typeof(allocations)<>'array' then raise exception 'invalid allocations'; end if;
   select count(*),count(distinct (v->>'branchId')::uuid),sum(round((v->>'amount')::numeric,2)) into cnt,distinct_cnt,total from jsonb_array_elements(allocations) v;
   if cnt<2 or cnt<>distinct_cnt or total is distinct from amount then raise exception 'invalid allocations'; end if;
   for item in select value from jsonb_array_elements(allocations) loop
     if nullif(item->>'amount','') is null or round((item->>'amount')::numeric,2)<=0 or (item->>'amount') in ('NaN','Infinity','-Infinity')
       or not exists(select 1 from public.branches b where b.id=(item->>'branchId')::uuid and b.is_active) then raise exception 'invalid allocations'; end if;
   end loop;
 end if;
 if e.crm_campaign_id is not null and (category_id is distinct from e.category_id or branch_id is distinct from e.branch_id or allocation_type is distinct from e.allocation_type) then raise exception 'campaign scope locked'; end if;
 update public.expense_requests er set amount=edit_values.amount,expense_date=edit_values.expense_date,category_id=edit_values.category_id,
   branch_id=edit_values.branch_id,allocation_type=edit_values.allocation_type,payment_method=edit_values.payment_method,description=edit_values.description,updated_at=now() where er.id=e.id;
 delete from public.expense_allocations where expense_request_id=e.id;
 insert into public.expense_allocations(expense_request_id,branch_id,amount) select e.id,(v->>'branchId')::uuid,round((v->>'amount')::numeric,2) from jsonb_array_elements(allocations) v;
 update public.cashflow_transactions cf set amount=edit_values.amount,transaction_date=edit_values.expense_date,category_id=edit_values.category_id,
   branch_id=edit_values.branch_id,account_id=edit_values.account_id,description=edit_values.description,updated_at=now() where cf.id=t.id;
 insert into public.approval_log(entity_type,entity_id,action,actor_profile_id,comment,metadata)
 values('expense_request',e.id,'owner_corrected',actor,btrim(p_reason),jsonb_build_object('previous_expense',to_jsonb(e),'previous_cashflow',to_jsonb(t),'previous_allocations',previous_alloc,'new_values',p_values));
 return jsonb_build_object('expenseId',e.id,'cashflowTransactionId',t.id,'amount',amount);
end $$;
revoke all on function finance_reports.correct_expense(uuid,text,jsonb,text) from public,anon;
grant execute on function finance_reports.correct_expense(uuid,text,jsonb,text) to authenticated;
create function public.owner_correct_expense(p_transaction_id uuid,p_version text,p_values jsonb,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select finance_reports.correct_expense(p_transaction_id,p_version,p_values,p_reason)$$;
revoke all on function public.owner_correct_expense(uuid,text,jsonb,text) from public,anon;
grant execute on function public.owner_correct_expense(uuid,text,jsonb,text) to authenticated;

create function finance_reports.expense_register(p_from date,p_to date,p_branch text,p_category text,p_page integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(private.current_role(),'')<>'owner' then raise exception 'owner only'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_page is null or p_page<0 then raise exception 'invalid period'; end if;
 with scoped as materialized (
  select t.id,t.transaction_date as date,coalesce(ec.name,case when t.source_type='event_expense' then 'Мероприятия' else 'Без категории' end) as title,
   coalesce(ec.id::text,case when t.source_type='event_expense' then 'events' else 'uncategorized' end) as category,
   coalesce(b.name,'Общий / распределённый') as branch,t.amount,coalesce(a.name,'') as method,coalesce(t.description,'') as description,
   coalesce(u.staff_display_name,u.full_name,'') as actor,false as refunded,'' as month,t.source_type as source,t.source_id as "sourceId",
   t.source_type in ('owner_direct_expense','expense_request','crm_campaign_expense') as editable
  from public.cashflow_transactions t left join public.branches b on b.id=t.branch_id
  left join public.expense_categories ec on ec.id=t.category_id left join public.cash_accounts a on a.id=t.account_id
  left join public.users_profile u on u.id=t.created_by_profile_id
  where t.direction='expense' and t.transaction_date between p_from and p_to
    and (nullif(p_branch,'') is null or coalesce(b.name,'Общий / распределённый')=p_branch)
 ), categories as (select category as id,title as name,sum(amount) as amount,count(*) as count from scoped group by category,title),
 filtered as materialized (select * from scoped where nullif(p_category,'') is null or category=p_category),
 page as (select * from filtered order by date desc,id desc limit 50 offset p_page*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page) order by date desc,id desc) from page),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(to_jsonb(categories) order by amount desc,name) from categories),'[]'::jsonb),
 'count',(select count(*) from filtered),'total',(select coalesce(sum(amount),0) from filtered),'refunded',0) into result;
 return result;
end $$;
revoke all on function finance_reports.expense_register(date,date,text,text,integer) from public,anon;
grant execute on function finance_reports.expense_register(date,date,text,text,integer) to authenticated;
create function public.owner_expense_register(p_from date,p_to date,p_branch text default '',p_category text default '',p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select finance_reports.expense_register(p_from,p_to,p_branch,p_category,p_page)$$;
revoke all on function public.owner_expense_register(date,date,text,text,integer) from public,anon;
grant execute on function public.owner_expense_register(date,date,text,text,integer) to authenticated;
