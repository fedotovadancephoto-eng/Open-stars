-- Cancel a posted ordinary expense, retaining its request, attachments and audit.
-- Payroll payouts, parent refunds and event expenses retain their own workflows.
create function finance_reports.cancel_expense(p_transaction_id uuid, p_version text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.business_current_profile_id();
  v_transaction public.cashflow_transactions%rowtype;
  v_expense public.expense_requests%rowtype;
  v_detail jsonb;
  v_cancelled_expense uuid;
begin
  if auth.uid() is null or v_actor is null or coalesce(private.current_role(), '') <> 'owner' then
    raise exception 'owner only';
  end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'cancellation reason required'; end if;
  select * into v_transaction from public.cashflow_transactions
  where id = p_transaction_id and direction = 'expense' for update;
  if not found then
    -- A retry after a lost response must not cancel anything else or add another audit event.
    select entity_id into v_cancelled_expense from public.approval_log
    where entity_type = 'expense_request' and action = 'owner_cancelled'
      and metadata->'previous_cashflow'->>'id' = p_transaction_id::text
    limit 1;
    if v_cancelled_expense is not null then
      return jsonb_build_object('expenseId', v_cancelled_expense, 'cancelled', true, 'alreadyCancelled', true);
    end if;
    raise exception 'expense not found';
  end if;
  if coalesce(v_transaction.source_type, '') not in ('owner_direct_expense', 'expense_request', 'crm_campaign_expense') then
    raise exception 'use source workflow';
  end if;
  select * into v_expense from public.expense_requests
  where id = v_transaction.source_id and cashflow_transaction_id = v_transaction.id and status = 'approved'
  for update;
  if not found then raise exception 'expense not found'; end if;
  perform 1 from public.expense_allocations where expense_request_id = v_expense.id for update;
  v_detail := finance_reports.expense_detail(v_transaction.id);
  if p_version is distinct from v_detail->>'version' then raise exception 'expense changed'; end if;

  -- Protect other source records even if an old transaction was linked incorrectly.
  if exists (select 1 from public.teacher_payroll_payouts where cashflow_transaction_id = v_transaction.id)
    or exists (select 1 from public.payment_receipts where cashflow_transaction_id = v_transaction.id or refund_cashflow_transaction_id = v_transaction.id)
    or exists (select 1 from public.event_expenses where cashflow_transaction_id = v_transaction.id)
    or exists (select 1 from public.event_payments where cashflow_transaction_id = v_transaction.id or refund_cashflow_transaction_id = v_transaction.id) then
    raise exception 'use source workflow';
  end if;

  insert into public.approval_log(entity_type, entity_id, action, actor_profile_id, comment, metadata)
  values ('expense_request', v_expense.id, 'owner_cancelled', v_actor, btrim(p_reason),
    jsonb_build_object('previous_expense', to_jsonb(v_expense), 'previous_cashflow', to_jsonb(v_transaction),
      'previous_allocations', v_detail->'allocations'));
  update public.expense_requests
  set status = 'cancelled', cashflow_transaction_id = null, review_comment = btrim(p_reason), updated_at = now()
  where id = v_expense.id;
  delete from public.cashflow_transactions where id = v_transaction.id;
  return jsonb_build_object('expenseId', v_expense.id, 'cancelled', true, 'alreadyCancelled', false);
end $$;
revoke all on function finance_reports.cancel_expense(uuid, text, text) from public, anon;
grant execute on function finance_reports.cancel_expense(uuid, text, text) to authenticated;

create function public.owner_cancel_expense(p_transaction_id uuid, p_version text, p_reason text)
returns jsonb language sql security invoker set search_path = '' as $$
  select finance_reports.cancel_expense(p_transaction_id, p_version, p_reason)
$$;
revoke all on function public.owner_cancel_expense(uuid, text, text) from public, anon;
grant execute on function public.owner_cancel_expense(uuid, text, text) to authenticated;
