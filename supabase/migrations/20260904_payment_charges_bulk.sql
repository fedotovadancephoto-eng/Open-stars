-- OPEN STARS · bulk monthly charge by branch/group
-- Uses staff_set_monthly_charge so every child keeps the same branch checks and audit trail.

create or replace function public.staff_bulk_set_monthly_charge(
  p_month date,
  p_branch text,
  p_group_name text,
  p_expected_amount numeric,
  p_due_date date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_branch text := nullif(trim(coalesce(p_branch, '')), '');
  v_group text := nullif(trim(coalesce(p_group_name, '')), '');
  v_month date;
  v_child record;
  v_count integer := 0;
begin
  if v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;
  if p_month is null then raise exception 'month required'; end if;
  if p_expected_amount is null or p_expected_amount < 0 then raise exception 'invalid expected amount'; end if;
  if v_branch is null then raise exception 'invalid branch'; end if;
  if v_group is null then raise exception 'group required'; end if;

  if v_role = 'admin' then
    if nullif(trim(coalesce(v_staff_branch, '')), '') is null or v_branch <> v_staff_branch then
      raise exception 'not authorized';
    end if;
  end if;

  if not exists (select 1 from public.branches b where b.is_active and b.name = v_branch) then
    raise exception 'invalid branch';
  end if;

  v_month := date_trunc('month', p_month)::date;

  for v_child in
    select c.id
    from public.children c
    where c.archived_at is null
      and c.branch = v_branch
      and coalesce(c.group_name, '') = v_group
    order by c.id
  loop
    perform public.staff_set_monthly_charge(
      v_child.id,
      v_month,
      p_expected_amount,
      p_due_date,
      p_note
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'group has no active students'; end if;

  return jsonb_build_object(
    'month', v_month,
    'branch', v_branch,
    'groupName', v_group,
    'expectedAmount', round(p_expected_amount::numeric, 2),
    'dueDate', coalesce(p_due_date::text, ''),
    'updatedStudents', v_count
  );
end;
$$;

revoke all on function public.staff_bulk_set_monthly_charge(date,text,text,numeric,date,text) from public, anon;
grant execute on function public.staff_bulk_set_monthly_charge(date,text,text,numeric,date,text) to authenticated;
