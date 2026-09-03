-- OPEN STARS BUSINESS · MVP 1
-- Расход филиала -> подтверждение владельцем -> операция ДДС.
-- Добавочная migration: существующие таблицы детей, семей, оплат и учебной части не изменяются.

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.branches (code, name, sort_order)
values
  ('nlo', 'НЛО', 10),
  ('oktyabrskiy', 'Октябрьский', 20),
  ('sverdlovskiy', 'Свердловский', 30)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_type text not null default 'variable'
    check (category_type in ('fixed', 'variable', 'project')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.expense_categories (code, name, category_type, sort_order)
values
  ('rent', 'Аренда', 'fixed', 10),
  ('payroll', 'Зарплата', 'fixed', 20),
  ('taxes', 'Налоги', 'fixed', 30),
  ('marketing', 'Маркетинг и реклама', 'variable', 40),
  ('utilities', 'Коммунальные услуги', 'fixed', 50),
  ('internet', 'Интернет и связь', 'fixed', 60),
  ('household', 'Хозяйственные расходы', 'variable', 70),
  ('stationery', 'Канцелярия', 'variable', 80),
  ('equipment', 'Оборудование и техника', 'variable', 90),
  ('contractors', 'Подрядчики', 'variable', 100),
  ('transport', 'Транспорт', 'variable', 110),
  ('projects', 'Мероприятия и проекты', 'project', 120),
  ('refunds', 'Возвраты', 'variable', 130),
  ('other', 'Прочее', 'variable', 999)
on conflict (code) do update
set name = excluded.name,
    category_type = excluded.category_type,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null check (account_type in ('bank', 'cash', 'other')),
  branch_id uuid references public.branches(id) on delete restrict,
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashflow_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  direction text not null check (direction in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.expense_categories(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  account_id uuid references public.cash_accounts(id) on delete restrict,
  source_type text,
  source_id uuid,
  description text,
  created_by_profile_id uuid references public.users_profile(id) on delete set null,
  approved_by_profile_id uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create table if not exists public.expense_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  description text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  requested_by_profile_id uuid not null references public.users_profile(id) on delete restrict,
  reviewed_by_profile_id uuid references public.users_profile(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  cashflow_transaction_id uuid unique references public.cashflow_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expense_requests_branch_status_idx
  on public.expense_requests (branch_id, status, expense_date desc);
create index if not exists expense_requests_requested_by_idx
  on public.expense_requests (requested_by_profile_id, created_at desc);
create index if not exists cashflow_transactions_date_idx
  on public.cashflow_transactions (transaction_date desc);
create index if not exists cashflow_transactions_branch_idx
  on public.cashflow_transactions (branch_id, transaction_date desc);

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.expense_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by_profile_id uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expense_attachments_request_idx
  on public.expense_attachments (expense_request_id, created_at);

create table if not exists public.approval_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_profile_id uuid references public.users_profile(id) on delete set null,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists approval_log_entity_idx
  on public.approval_log (entity_type, entity_id, created_at desc);

create or replace function private.business_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

 drop trigger if exists branches_touch_updated_at on public.branches;
create trigger branches_touch_updated_at
before update on public.branches
for each row execute function private.business_touch_updated_at();

 drop trigger if exists expense_categories_touch_updated_at on public.expense_categories;
create trigger expense_categories_touch_updated_at
before update on public.expense_categories
for each row execute function private.business_touch_updated_at();

 drop trigger if exists cash_accounts_touch_updated_at on public.cash_accounts;
create trigger cash_accounts_touch_updated_at
before update on public.cash_accounts
for each row execute function private.business_touch_updated_at();

 drop trigger if exists cashflow_transactions_touch_updated_at on public.cashflow_transactions;
create trigger cashflow_transactions_touch_updated_at
before update on public.cashflow_transactions
for each row execute function private.business_touch_updated_at();

 drop trigger if exists expense_requests_touch_updated_at on public.expense_requests;
create trigger expense_requests_touch_updated_at
before update on public.expense_requests
for each row execute function private.business_touch_updated_at();

create or replace function private.business_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select up.id
  from public.users_profile up
  where up.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function private.business_can_access_branch(p_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
begin
  if v_role in ('owner', 'manager', 'project_director') then
    return true;
  end if;

  if v_role = 'admin' then
    return exists (
      select 1
      from public.branches b
      where b.id = p_branch_id
        and b.is_active
        and b.name = v_staff_branch
    );
  end if;

  return false;
end;
$$;

create or replace function private.business_current_staff_branch_code()
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select b.code
  from public.branches b
  where b.name = private.current_staff_branch()
    and b.is_active
  limit 1
$$;

create or replace function private.business_can_access_expense(p_expense_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.expense_requests er
    where er.id = p_expense_request_id
      and private.business_can_access_branch(er.branch_id)
  )
$$;

alter table public.branches enable row level security;
alter table public.expense_categories enable row level security;
alter table public.cash_accounts enable row level security;
alter table public.cashflow_transactions enable row level security;
alter table public.expense_requests enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.approval_log enable row level security;

 drop policy if exists branches_staff_read on public.branches;
create policy branches_staff_read on public.branches
for select to authenticated
using (private.current_role() in ('owner', 'manager', 'project_director', 'admin'));

 drop policy if exists branches_owner_manage on public.branches;
create policy branches_owner_manage on public.branches
for all to authenticated
using (private.current_role() = 'owner')
with check (private.current_role() = 'owner');

 drop policy if exists expense_categories_staff_read on public.expense_categories;
create policy expense_categories_staff_read on public.expense_categories
for select to authenticated
using (private.current_role() in ('owner', 'manager', 'project_director', 'admin'));

 drop policy if exists expense_categories_owner_manage on public.expense_categories;
create policy expense_categories_owner_manage on public.expense_categories
for all to authenticated
using (private.current_role() = 'owner')
with check (private.current_role() = 'owner');

 drop policy if exists expense_requests_staff_read on public.expense_requests;
create policy expense_requests_staff_read on public.expense_requests
for select to authenticated
using (private.business_can_access_branch(branch_id));

 drop policy if exists expense_attachments_staff_read on public.expense_attachments;
create policy expense_attachments_staff_read on public.expense_attachments
for select to authenticated
using (private.business_can_access_expense(expense_request_id));

 drop policy if exists cash_accounts_owner_only on public.cash_accounts;
create policy cash_accounts_owner_only on public.cash_accounts
for all to authenticated
using (private.current_role() = 'owner')
with check (private.current_role() = 'owner');

 drop policy if exists cashflow_transactions_owner_only on public.cashflow_transactions;
create policy cashflow_transactions_owner_only on public.cashflow_transactions
for all to authenticated
using (private.current_role() = 'owner')
with check (private.current_role() = 'owner');

 drop policy if exists approval_log_owner_only on public.approval_log;
create policy approval_log_owner_only on public.approval_log
for select to authenticated
using (private.current_role() = 'owner');

revoke insert, update, delete on public.expense_requests from authenticated;
revoke insert, update, delete on public.expense_attachments from authenticated;
revoke insert, update, delete on public.cashflow_transactions from authenticated;
revoke insert, update, delete on public.approval_log from authenticated;

grant select on public.branches to authenticated;
grant select on public.expense_categories to authenticated;
grant select on public.expense_requests to authenticated;
grant select on public.expense_attachments to authenticated;
grant select on public.cash_accounts to authenticated;
grant select on public.cashflow_transactions to authenticated;
grant select on public.approval_log to authenticated;

create or replace function public.staff_submit_expense(
  p_branch_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_profile_id uuid := private.business_current_profile_id();
  v_branch_id uuid := p_branch_id;
  v_expense_id uuid;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  if p_expense_date is null then
    raise exception 'invalid expense date';
  end if;

  if not exists (
    select 1 from public.expense_categories ec
    where ec.id = p_category_id and ec.is_active
  ) then
    raise exception 'invalid expense category';
  end if;

  if v_role = 'admin' then
    select b.id into v_branch_id
    from public.branches b
    where b.name = private.current_staff_branch()
      and b.is_active
    limit 1;
  end if;

  if v_branch_id is null or not private.business_can_access_branch(v_branch_id) then
    raise exception 'invalid branch';
  end if;

  insert into public.expense_requests (
    branch_id,
    category_id,
    amount,
    expense_date,
    description,
    status,
    requested_by_profile_id
  ) values (
    v_branch_id,
    p_category_id,
    round(p_amount::numeric, 2),
    p_expense_date,
    nullif(trim(coalesce(p_description, '')), ''),
    'submitted',
    v_profile_id
  )
  returning id into v_expense_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment
  ) values (
    'expense_request', v_expense_id, 'submitted', v_profile_id, null
  );

  return v_expense_id;
end;
$$;

create or replace function public.staff_attach_expense_receipt(
  p_expense_request_id uuid,
  p_storage_path text,
  p_file_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_request public.expense_requests%rowtype;
  v_branch_code text;
  v_attachment_id uuid;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;

  select * into v_request
  from public.expense_requests
  where id = p_expense_request_id;

  if not found or not private.business_can_access_branch(v_request.branch_id) then
    raise exception 'expense request not found';
  end if;

  if v_request.status <> 'submitted' then
    raise exception 'expense request is closed';
  end if;

  select code into v_branch_code
  from public.branches
  where id = v_request.branch_id;

  if p_storage_path is null
     or p_storage_path not like v_branch_code || '/' || p_expense_request_id::text || '/%' then
    raise exception 'invalid receipt path';
  end if;

  insert into public.expense_attachments (
    expense_request_id,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    uploaded_by_profile_id
  ) values (
    p_expense_request_id,
    p_storage_path,
    nullif(trim(coalesce(p_file_name, '')), ''),
    nullif(trim(coalesce(p_mime_type, '')), ''),
    p_size_bytes,
    v_profile_id
  )
  returning id into v_attachment_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, metadata
  ) values (
    'expense_request', p_expense_request_id, 'receipt_attached', v_profile_id,
    jsonb_build_object('attachment_id', v_attachment_id)
  );

  return v_attachment_id;
end;
$$;

create or replace function public.owner_approve_expense_request(
  p_expense_request_id uuid,
  p_account_id uuid default null,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_request public.expense_requests%rowtype;
  v_transaction_id uuid;
begin
  if v_profile_id is null or private.current_role() <> 'owner' then
    raise exception 'owner only';
  end if;

  select * into v_request
  from public.expense_requests
  where id = p_expense_request_id
  for update;

  if not found then
    raise exception 'expense request not found';
  end if;

  if v_request.status = 'approved' and v_request.cashflow_transaction_id is not null then
    return v_request.cashflow_transaction_id;
  end if;

  if v_request.status <> 'submitted' then
    raise exception 'expense request is not awaiting approval';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.cash_accounts ca
    where ca.id = p_account_id and ca.is_active
  ) then
    raise exception 'invalid cash account';
  end if;

  insert into public.cashflow_transactions (
    transaction_date,
    direction,
    amount,
    category_id,
    branch_id,
    account_id,
    source_type,
    source_id,
    description,
    created_by_profile_id,
    approved_by_profile_id
  ) values (
    v_request.expense_date,
    'expense',
    v_request.amount,
    v_request.category_id,
    v_request.branch_id,
    p_account_id,
    'expense_request',
    v_request.id,
    v_request.description,
    v_request.requested_by_profile_id,
    v_profile_id
  )
  on conflict (source_type, source_id) do update
  set approved_by_profile_id = excluded.approved_by_profile_id
  returning id into v_transaction_id;

  update public.expense_requests
  set status = 'approved',
      reviewed_by_profile_id = v_profile_id,
      reviewed_at = now(),
      review_comment = nullif(trim(coalesce(p_comment, '')), ''),
      cashflow_transaction_id = v_transaction_id
  where id = v_request.id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment,
    metadata
  ) values (
    'expense_request', v_request.id, 'approved', v_profile_id,
    nullif(trim(coalesce(p_comment, '')), ''),
    jsonb_build_object('cashflow_transaction_id', v_transaction_id)
  );

  return v_transaction_id;
end;
$$;

create or replace function public.owner_reject_expense_request(
  p_expense_request_id uuid,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_request public.expense_requests%rowtype;
begin
  if v_profile_id is null or private.current_role() <> 'owner' then
    raise exception 'owner only';
  end if;

  select * into v_request
  from public.expense_requests
  where id = p_expense_request_id
  for update;

  if not found then
    raise exception 'expense request not found';
  end if;

  if v_request.status <> 'submitted' then
    raise exception 'expense request is not awaiting approval';
  end if;

  update public.expense_requests
  set status = 'rejected',
      reviewed_by_profile_id = v_profile_id,
      reviewed_at = now(),
      review_comment = nullif(trim(coalesce(p_comment, '')), '')
  where id = v_request.id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment
  ) values (
    'expense_request', v_request.id, 'rejected', v_profile_id,
    nullif(trim(coalesce(p_comment, '')), '')
  );

  return v_request.id;
end;
$$;

create or replace function public.staff_cancel_expense_request(
  p_expense_request_id uuid,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_request public.expense_requests%rowtype;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;

  select * into v_request
  from public.expense_requests
  where id = p_expense_request_id
  for update;

  if not found or not private.business_can_access_branch(v_request.branch_id) then
    raise exception 'expense request not found';
  end if;

  if v_request.status <> 'submitted' then
    raise exception 'expense request is closed';
  end if;

  if v_role = 'admin' and v_request.requested_by_profile_id <> v_profile_id then
    raise exception 'not authorized';
  end if;

  update public.expense_requests
  set status = 'cancelled',
      reviewed_by_profile_id = case when v_role = 'owner' then v_profile_id else reviewed_by_profile_id end,
      reviewed_at = case when v_role = 'owner' then now() else reviewed_at end,
      review_comment = case when v_role = 'owner' then nullif(trim(coalesce(p_comment, '')), '') else review_comment end
  where id = v_request.id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment
  ) values (
    'expense_request', v_request.id, 'cancelled', v_profile_id,
    nullif(trim(coalesce(p_comment, '')), '')
  );

  return v_request.id;
end;
$$;

grant execute on function public.staff_submit_expense(uuid, uuid, numeric, date, text) to authenticated;
grant execute on function public.staff_attach_expense_receipt(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.owner_approve_expense_request(uuid, uuid, text) to authenticated;
grant execute on function public.owner_reject_expense_request(uuid, text) to authenticated;
grant execute on function public.staff_cancel_expense_request(uuid, text) to authenticated;

-- Private receipt bucket. Files are visible only to business staff who can access the branch.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-expense-receipts',
  'business-expense-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

 drop policy if exists business_expense_receipts_read on storage.objects;
create policy business_expense_receipts_read on storage.objects
for select to authenticated
using (
  bucket_id = 'business-expense-receipts'
  and (
    private.current_role() in ('owner', 'manager', 'project_director')
    or (
      private.current_role() = 'admin'
      and (storage.foldername(name))[1] = private.business_current_staff_branch_code()
    )
  )
);

 drop policy if exists business_expense_receipts_insert on storage.objects;
create policy business_expense_receipts_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'business-expense-receipts'
  and (
    private.current_role() in ('owner', 'manager', 'project_director')
    or (
      private.current_role() = 'admin'
      and (storage.foldername(name))[1] = private.business_current_staff_branch_code()
    )
  )
);

-- Намеренно не даём DELETE к чекам через клиент: финансовый первичный документ
-- не должен исчезать после отправки расхода. Позже добавим owner-only архивирование.
