-- Revenue channels derive from the full ledger, including refunds in their DDS month.
create or replace function public.owner_cashflow_month_summary(p_month date default current_date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_month date := date_trunc('month',coalesce(p_month,current_date))::date;
  v_result jsonb;
begin
  if auth.uid() is null or private.current_role() is distinct from 'owner' then
    raise exception 'not authorized';
  end if;
  with tx as (
    select ct.branch_id,coalesce(b.name,'Без филиала') branch,
      ct.direction,ct.amount,
      right(coalesce(ct.source_type,''),7) = '_refund' is_refund,
      case when ct.source_type in ('payment_receipt','tuition_refund') then 'tuition'
           when ct.source_type in ('event_payment','event_refund') then 'events'
           else 'other' end category,
      case
        when pr.id is not null or ep.id is not null then
          case coalesce(pr.payment_method,ep.payment_method)
            when 'cash' then 'cash'
            when 'bank_transfer' then 'noncash'
            when 'online' then 'noncash'
            else 'unknown' end
        when ca.account_type = 'cash' then 'cash'
        when ca.account_type = 'bank' then 'noncash'
        else 'unknown'
      end channel
    from public.cashflow_transactions ct
    left join public.branches b on b.id=ct.branch_id
    left join public.cash_accounts ca on ca.id=ct.account_id
    left join public.payment_receipts pr
      on ct.source_type in ('payment_receipt','tuition_refund') and pr.id=ct.source_id
    left join public.event_payments ep
      on ct.source_type in ('event_payment','event_refund') and ep.id=ct.source_id
    where ct.transaction_date >= v_month
      and ct.transaction_date < (v_month + interval '1 month')::date
  ), stats as (
    select branch_id,branch,grouping(branch_id) as is_total,
      coalesce(sum(amount) filter(where direction='income'),0) gross,
      coalesce(sum(amount) filter(where direction='expense' and is_refund),0) refunds,
      coalesce(sum(amount) filter(where direction='expense'),0) expenses
    from tx group by grouping sets ((branch_id,branch),())
  ), channels as (
    select branch_id,grouping(branch_id) as is_total,category,channel,
      sum(case when direction='income' then amount else -amount end) amount
    from tx where direction='income' or (direction='expense' and is_refund)
    group by grouping sets ((branch_id,category,channel),(category,channel))
  ), summaries as (
    select s.is_total,s.branch,jsonb_build_object(
      'branchId',s.branch_id,'branch',s.branch,
      'grossIncome',s.gross,'refunds',s.refunds,'revenue',s.gross-s.refunds,
      'expenses',s.expenses,'netCashflow',s.gross-s.expenses,
      'revenueBreakdown',coalesce((
        select jsonb_agg(jsonb_build_object('category',c.category,'channel',c.channel,'amount',c.amount)
          order by c.category,c.channel)
        from channels c where c.is_total=s.is_total
          and (s.is_total=1 or c.branch_id is not distinct from s.branch_id)
      ),'[]'::jsonb)
    ) body from stats s
  )
  select (select body from summaries where is_total=1) ||
    jsonb_build_object('month',v_month,'branches',
      coalesce((select jsonb_agg(body order by branch) from summaries where is_total=0),'[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;
revoke all on function public.owner_cashflow_month_summary(date) from public,anon;
grant execute on function public.owner_cashflow_month_summary(date) to authenticated;
