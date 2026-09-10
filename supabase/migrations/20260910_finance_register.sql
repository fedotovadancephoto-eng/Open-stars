create schema finance_reports;
revoke all on schema finance_reports from public,anon;
grant usage on schema finance_reports to authenticated;
create function finance_reports.finance_register(p_kind text,p_from date,p_to date,p_branch text,p_method text,p_page integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=private.current_role(); result jsonb;
begin
 if auth.uid() is null or coalesce(v_role,'') not in ('owner','manager','admin','project_director') then raise exception 'not authorized'; end if;
 if p_kind not in ('payments','expenses') or p_kind is null then raise exception 'invalid kind'; end if;
 if p_kind='expenses' and v_role<>'owner' then raise exception 'not authorized'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_page is null or p_page<0 then raise exception 'invalid period'; end if;
 if p_method is null or p_method not in ('all','cash','noncash','unknown') then raise exception 'invalid method'; end if;
 if v_role='admin' then
   if nullif(private.current_staff_branch(),'') is null then raise exception 'not authorized'; end if;
   if nullif(p_branch,'') is not null and p_branch<>private.current_staff_branch() then raise exception 'not authorized'; end if;
   p_branch:=private.current_staff_branch();
 end if;
 with rows as (
   select r.id,(r.received_at at time zone 'Asia/Irkutsk')::date as date,
    concat_ws(' ',c.last_name,c.first_name) as title,coalesce(b.name,c.branch,'') as branch,
    r.amount,r.payment_method as method,
    case when r.payment_method='cash' then 'cash' when r.payment_method in ('online','bank_transfer','bank','card') then 'noncash' else 'unknown' end as channel,
    coalesce(r.note,'') as description,coalesce(u.staff_display_name,u.full_name,'') as actor,
    r.refunded_at is not null as refunded,to_char(p.month,'MM.YYYY') as month
   from public.payment_receipts r join public.children c on c.id=r.child_id
   join public.payments p on p.id=r.payment_id
   left join public.branches b on b.id=r.branch_id
   left join public.users_profile u on u.id=r.confirmed_by_profile_id
   where p_kind='payments' and r.voided_at is null
   union all
   select t.id,t.transaction_date,coalesce(ec.name,'Расход'),coalesce(b.name,'Общий / распределённый'),
    t.amount,coalesce(a.name,''),'unknown',coalesce(t.description,''),coalesce(u.staff_display_name,u.full_name,''),false,''
   from public.cashflow_transactions t
   left join public.branches b on b.id=t.branch_id
   left join public.expense_categories ec on ec.id=t.category_id
   left join public.cash_accounts a on a.id=t.account_id
   left join public.users_profile u on u.id=t.created_by_profile_id
   where p_kind='expenses' and t.direction='expense'
 ), filtered as materialized (
   select * from rows where date between p_from and p_to
   and (nullif(p_branch,'') is null or branch=p_branch)
   and (p_kind='expenses' or p_method='all' or channel=p_method)
 ), page as (select * from filtered order by date desc,id desc limit 50 offset p_page*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page) order by date desc,id desc) from page),'[]'::jsonb),
   'count',(select count(*) from filtered),
   'total',(select coalesce(sum(amount),0) from filtered where not refunded),
   'refunded',(select coalesce(sum(amount),0) from filtered where refunded)) into result;
 return result;
end $$;
revoke all on function finance_reports.finance_register(text,date,date,text,text,integer) from public,anon;
grant execute on function finance_reports.finance_register(text,date,date,text,text,integer) to authenticated;
create function public.staff_finance_register(p_kind text,p_from date,p_to date,p_branch text default '',p_method text default 'all',p_page integer default 0)
returns jsonb language sql security invoker set search_path='' as $$select finance_reports.finance_register(p_kind,p_from,p_to,p_branch,p_method,p_page)$$;
revoke all on function public.staff_finance_register(text,date,date,text,text,integer) from public,anon;
grant execute on function public.staff_finance_register(text,date,date,text,text,integer) to authenticated;
