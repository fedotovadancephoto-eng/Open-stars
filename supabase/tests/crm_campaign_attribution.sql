-- Run after 20260906_crm_campaign_attribution.sql.

do $$
declare
  v_summary text;
  v_expense text;
begin
  select pg_get_functiondef('public.crm_marketing_campaign_summary(date,date,text)'::regprocedure) into v_summary;
  select pg_get_functiondef('public.crm_record_campaign_expense(uuid,numeric,date,text)'::regprocedure) into v_expense;

  if position('cashflow_transactions' in v_summary) = 0
     or position('crm_campaign_id' in v_summary) = 0 then
    raise exception 'campaign budget must be derived from linked DDS transactions';
  end if;

  if position('payment_receipts' in v_summary) = 0
     or position('refunded_at is null' in v_summary) = 0
     or position('voided_at is null' in v_summary) = 0 then
    raise exception 'campaign revenue must use active payment receipts';
  end if;

  if position('marketing' in v_expense) = 0
     or position('cashflow_transactions' in v_expense) = 0
     or position('crm_campaign_expense' in v_expense) = 0 then
    raise exception 'marketer expense must create an audited marketing DDS row';
  end if;
end;
$$;

