-- OPEN STARS · expose unresolved tuition receipts before a student is archived.

create or replace function public.staff_list_students_for_archive_v2()
returns table(
  child_id uuid,
  first_name text,
  last_name text,
  branch text,
  group_name text,
  archived_at timestamptz,
  archive_reason text,
  parent_name text,
  parent_phone text,
  refundable_amount numeric,
  latest_payment_month date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_branch text;
begin
  select r.name, up.staff_branch
    into v_role, v_branch
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.auth_user_id = (select auth.uid())
  limit 1;

  if v_role not in ('owner', 'project_director', 'admin', 'manager') then
    raise exception 'not authorized';
  end if;

  return query
  select
    c.id,
    c.first_name,
    c.last_name,
    c.branch,
    c.group_name,
    c.archived_at,
    c.archive_reason,
    coalesce(parent_up.full_name, invite.full_name),
    coalesce(parent_up.phone, invite.phone),
    coalesce(tuition.refundable_amount, 0),
    tuition.latest_payment_month
  from public.children c
  left join lateral (
    select up.full_name, up.phone
    from public.family_members fm
    join public.users_profile up on up.id = fm.user_id
    where fm.family_id = c.family_id
    order by case when fm.relationship = 'parent' then 0 else 1 end, fm.id
    limit 1
  ) parent_up on true
  left join lateral (
    select pi.full_name, pi.phone
    from public.parent_invites pi
    where pi.family_id = c.family_id
      and pi.revoked_at is null
    order by pi.created_at desc
    limit 1
  ) invite on true
  left join lateral (
    select
      sum(pr.amount)::numeric as refundable_amount,
      max(p.month)::date as latest_payment_month
    from public.payment_receipts pr
    join public.payments p on p.id = pr.payment_id
    where pr.child_id = c.id
      and pr.voided_at is null
      and pr.refunded_at is null
  ) tuition on true
  where v_role in ('owner', 'project_director', 'manager')
     or c.branch = v_branch
  order by c.archived_at nulls first, c.last_name, c.first_name;
end;
$$;

revoke all on function public.staff_list_students_for_archive_v2()
  from public, anon;
grant execute on function public.staff_list_students_for_archive_v2()
  to authenticated;
