-- OPEN STARS BUSINESS · branch-admin expense categories
-- Branch admins only need the operational expense items used in the real branch sheet.
-- Owner keeps the full management category list. Teacher payroll stays in the dedicated payroll module.

insert into public.expense_categories (
  code, name, category_type, is_active, sort_order, owner_only
)
values
  ('cleaning', 'Оплата уборщице', 'variable', true, 10, false),
  ('inventory_purchase', 'Закуп инвентаря', 'variable', true, 20, false),
  ('client_change', 'Сдача клиенту', 'variable', true, 40, false)
on conflict (code) do update
set name = excluded.name,
    category_type = excluded.category_type,
    is_active = true,
    sort_order = excluded.sort_order,
    owner_only = false,
    updated_at = now();

update public.expense_categories
set name = 'Хоз. нужды',
    is_active = true,
    sort_order = 30,
    owner_only = false,
    updated_at = now()
where code = 'household';

-- Owner sees all categories. Managers/project directors keep their existing non-sensitive list.
-- A branch admin sees only the four generic operational items below.
-- Salary is intentionally NOT duplicated here: admins record it in the dedicated
-- "Зарплата педагогам" module, which stores teacher/week and protects against duplicate payouts.
drop policy if exists expense_categories_staff_read on public.expense_categories;
create policy expense_categories_staff_read on public.expense_categories
for select to authenticated
using (
  private.current_role() = 'owner'
  or (
    private.current_role() in ('manager', 'project_director')
    and not owner_only
  )
  or (
    private.current_role() = 'admin'
    and code in ('cleaning', 'inventory_purchase', 'household', 'client_change')
  )
);

-- Backend enforcement: hiding options in the UI is not enough. A branch admin cannot
-- submit another category by sending its UUID directly.
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
    select 1
    from public.expense_categories ec
    where ec.id = p_category_id
      and ec.is_active
      and (
        v_role = 'owner'
        or (v_role in ('manager', 'project_director') and not ec.owner_only)
        or (
          v_role = 'admin'
          and ec.code in ('cleaning', 'inventory_purchase', 'household', 'client_change')
        )
      )
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
    requested_by_profile_id,
    allocation_type
  ) values (
    v_branch_id,
    p_category_id,
    round(p_amount::numeric, 2),
    p_expense_date,
    nullif(trim(coalesce(p_description, '')), ''),
    'submitted',
    v_profile_id,
    'branch'
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

revoke all on function public.staff_submit_expense(uuid,uuid,numeric,date,text) from public, anon;
grant execute on function public.staff_submit_expense(uuid,uuid,numeric,date,text) to authenticated;
