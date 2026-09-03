-- OPEN STARS BUSINESS · branch student goals

create table if not exists public.branch_student_targets (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  student_target integer not null check (student_target > 0),
  updated_by_profile_id uuid references public.users_profile(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.branch_student_targets (branch_id, student_target)
select b.id,
  case b.name
    when 'Октябрьский' then 130
    when 'Свердловский' then 130
    when 'НЛО' then 70
    else 1
  end
from public.branches b
where b.name in ('Октябрьский', 'Свердловский', 'НЛО')
on conflict (branch_id) do nothing;

alter table public.branch_student_targets enable row level security;

drop policy if exists branch_student_targets_owner_read on public.branch_student_targets;
create policy branch_student_targets_owner_read on public.branch_student_targets
for select to authenticated
using (private.current_role() = 'owner');

revoke all on public.branch_student_targets from anon, public;
revoke insert, update, delete on public.branch_student_targets from authenticated;
grant select on public.branch_student_targets to authenticated;

create or replace function public.owner_set_branch_student_target(
  p_branch_id uuid,
  p_target integer
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
begin
  if private.current_role() <> 'owner' or v_profile_id is null then
    raise exception 'owner only';
  end if;
  if p_target is null or p_target <= 0 then raise exception 'invalid target'; end if;
  if not exists (select 1 from public.branches where id = p_branch_id and is_active) then
    raise exception 'invalid branch';
  end if;

  insert into public.branch_student_targets (branch_id, student_target, updated_by_profile_id, updated_at)
  values (p_branch_id, p_target, v_profile_id, now())
  on conflict (branch_id) do update
  set student_target = excluded.student_target,
      updated_by_profile_id = excluded.updated_by_profile_id,
      updated_at = now();
end;
$$;

create or replace function public.owner_business_branch_goals()
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_result jsonb;
begin
  if private.current_role() <> 'owner' then raise exception 'owner only'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'branchId', b.id,
    'branch', b.name,
    'target', coalesce(t.student_target, 0),
    'activeStudents', coalesce(c.active_students, 0),
    'missing', greatest(coalesce(t.student_target, 0) - coalesce(c.active_students, 0), 0),
    'overTarget', greatest(coalesce(c.active_students, 0) - coalesce(t.student_target, 0), 0),
    'progress', case when coalesce(t.student_target, 0) > 0 then round((coalesce(c.active_students, 0)::numeric / t.student_target::numeric) * 100, 1) else 0 end
  ) order by b.sort_order, b.name), '[]'::jsonb)
  into v_result
  from public.branches b
  left join public.branch_student_targets t on t.branch_id = b.id
  left join lateral (
    select count(*)::integer as active_students
    from public.children ch
    where ch.archived_at is null
      and ch.branch = b.name
  ) c on true
  where b.is_active;

  return v_result;
end;
$$;

revoke all on function public.owner_set_branch_student_target(uuid, integer) from public, anon;
revoke all on function public.owner_business_branch_goals() from public, anon;
grant execute on function public.owner_set_branch_student_target(uuid, integer) to authenticated;
grant execute on function public.owner_business_branch_goals() to authenticated;
