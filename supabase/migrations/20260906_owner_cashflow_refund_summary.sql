-- OPEN STARS: owner financial summary must use the full cashflow ledger, not a truncated UI list.
-- Refunds reduce displayed revenue while remaining explicit expense movements in DDS.

create or replace function public.owner_cashflow_month_summary(p_month date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_month_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
  v_branches jsonb := '[]'::jsonb;
  v_gross_income numeric := 0;
  v_refunds numeric := 0;
  v_expenses numeric := 0;
begin
  if private.current_role() <> 'owner' then
    raise exception 'not authorized';
  end if;

  with tx as (
    select
      ct.branch_id,
      b.name as branch_name,
      ct.direction,
      ct.amount,
      ct.source_type
    from public.cashflow_transactions ct
    left join public.branches b on b.id = ct.branch_id
    where ct.transaction_date >= v_month
      and ct.transaction_date < v_month_end
  ), branch_stats as (
    select
      branch_id,
      coalesce(branch_name, 'Без филиала') as branch_name,
      coalesce(sum(amount) filter (where direction = 'income'), 0)::numeric as gross_income,
      coalesce(sum(amount) filter (where direction = 'expense' and source_type like '%\_refund' escape '\'), 0)::numeric as refunds,
      coalesce(sum(amount) filter (where direction = 'expense'), 0)::numeric as expenses
    from tx
    where branch_id is not null
    group by branch_id, branch_name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'branchId', branch_id,
        'branch', branch_name,
        'grossIncome', round(gross_income, 2),
        'refunds', round(refunds, 2),
        'revenue', round(gross_income - refunds, 2),
        'expenses', round(expenses, 2),
        'netCashflow', round(gross_income - expenses, 2)
      ) order by branch_name
    ),
    '[]'::jsonb
  ) into v_branches
  from branch_stats;

  select
    coalesce(sum(ct.amount) filter (where ct.direction = 'income'), 0)::numeric,
    coalesce(sum(ct.amount) filter (where ct.direction = 'expense' and ct.source_type like '%\_refund' escape '\'), 0)::numeric,
    coalesce(sum(ct.amount) filter (where ct.direction = 'expense'), 0)::numeric
  into v_gross_income, v_refunds, v_expenses
  from public.cashflow_transactions ct
  where ct.transaction_date >= v_month
    and ct.transaction_date < v_month_end;

  return jsonb_build_object(
    'month', v_month,
    'grossIncome', round(v_gross_income, 2),
    'refunds', round(v_refunds, 2),
    'revenue', round(v_gross_income - v_refunds, 2),
    'expenses', round(v_expenses, 2),
    'netCashflow', round(v_gross_income - v_expenses, 2),
    'branches', v_branches
  );
end;
$$;

revoke all on function public.owner_cashflow_month_summary(date) from public, anon;
grant execute on function public.owner_cashflow_month_summary(date) to authenticated;
