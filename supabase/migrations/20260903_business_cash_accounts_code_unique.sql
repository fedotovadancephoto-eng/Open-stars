-- OPEN STARS BUSINESS · stable account codes for automatic postings

alter table public.cash_accounts
  add column if not exists code text;

drop index if exists public.cash_accounts_code_unique_idx;
create unique index cash_accounts_code_unique_idx
  on public.cash_accounts (code);
