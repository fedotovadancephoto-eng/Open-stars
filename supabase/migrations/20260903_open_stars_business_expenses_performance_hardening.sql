-- OPEN STARS BUSINESS · MVP 1 performance/security hardening
-- Индексы для FK и read-only справочники на первом релизе.

create index if not exists cash_accounts_branch_idx
  on public.cash_accounts (branch_id)
  where branch_id is not null;

create index if not exists cashflow_transactions_category_date_idx
  on public.cashflow_transactions (category_id, transaction_date desc)
  where category_id is not null;

create index if not exists cashflow_transactions_account_date_idx
  on public.cashflow_transactions (account_id, transaction_date desc)
  where account_id is not null;

create index if not exists cashflow_transactions_created_by_idx
  on public.cashflow_transactions (created_by_profile_id, created_at desc)
  where created_by_profile_id is not null;

create index if not exists cashflow_transactions_approved_by_idx
  on public.cashflow_transactions (approved_by_profile_id, created_at desc)
  where approved_by_profile_id is not null;

create index if not exists expense_requests_category_date_idx
  on public.expense_requests (category_id, expense_date desc);

create index if not exists expense_requests_reviewed_by_idx
  on public.expense_requests (reviewed_by_profile_id, reviewed_at desc)
  where reviewed_by_profile_id is not null;

create index if not exists expense_attachments_uploaded_by_idx
  on public.expense_attachments (uploaded_by_profile_id, created_at desc)
  where uploaded_by_profile_id is not null;

create index if not exists approval_log_actor_idx
  on public.approval_log (actor_profile_id, created_at desc)
  where actor_profile_id is not null;

-- В MVP филиалы и категории задаются migrations. Клиент их только читает.
-- Убираем FOR ALL policies, которые дублировали SELECT policy и давали
-- лишнюю поверхность прямой записи.
drop policy if exists branches_owner_manage on public.branches;
drop policy if exists expense_categories_owner_manage on public.expense_categories;

revoke insert, update, delete on public.branches from authenticated;
revoke insert, update, delete on public.expense_categories from authenticated;
