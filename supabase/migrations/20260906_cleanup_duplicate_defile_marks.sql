-- Remove the accidental Sunday copy of Saturday Defile marks.
-- Keep a private JSON backup so the cleanup can be reversed deliberately.

create table if not exists private.academic_cleanup_backups (
  operation_key text not null,
  entity_type text not null,
  record_id uuid not null,
  payload jsonb not null,
  backed_up_at timestamptz not null default now(),
  primary key (operation_key, entity_type, record_id)
);

revoke all on table private.academic_cleanup_backups from public, anon, authenticated;

create temporary table cleanup_duplicate_defile_target_children
on commit drop
as
select g.child_id
from public.grades g
join public.children c on c.id = g.child_id
where g.subject = 'Дефиле'
  and g.lesson_date in (date '2026-09-05', date '2026-09-06')
  and c.branch = 'Октябрьский'
  and lower(trim(c.lesson_day)) = 'суббота'
group by g.child_id
having count(distinct g.lesson_date) = 2
   and min(g.grade) = 5
   and max(g.grade) = 5;

do $$
declare
  affected_children integer;
  saturday_grades integer;
  sunday_grades integer;
  sunday_attendance integer;
  sunday_coins integer;
begin
  select count(*) into affected_children
  from cleanup_duplicate_defile_target_children;

  select count(*) into saturday_grades
  from public.grades g
  join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
  where g.subject = 'Дефиле'
    and g.lesson_date = date '2026-09-05';

  select count(*) into sunday_grades
  from public.grades g
  join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
  where g.subject = 'Дефиле'
    and g.lesson_date = date '2026-09-06';

  select count(*) into sunday_attendance
  from public.attendance a
  join cleanup_duplicate_defile_target_children t on t.child_id = a.child_id
  where a.subject = 'Дефиле'
    and a.lesson_date = date '2026-09-06';

  select count(*) into sunday_coins
  from public.coin_transactions ct
  join public.grades g on g.id = ct.source_id
  join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
  where ct.source = 'grade'
    and g.subject = 'Дефиле'
    and g.lesson_date = date '2026-09-06';

  if affected_children <> 14
     or saturday_grades <> 14
     or sunday_grades <> 14
     or sunday_attendance <> 13
     or sunday_coins <> 14 then
    raise exception
      'Duplicate Defile cleanup aborted: children %, Saturday grades %, Sunday grades %, attendance %, coins %',
      affected_children, saturday_grades, sunday_grades, sunday_attendance, sunday_coins;
  end if;
end;
$$;

insert into private.academic_cleanup_backups (
  operation_key,
  entity_type,
  record_id,
  payload
)
select
  'duplicate_defile_2026_09_06',
  'grade',
  g.id,
  to_jsonb(g)
from public.grades g
join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
where g.subject = 'Дефиле'
  and g.lesson_date = date '2026-09-06'
on conflict do nothing;

insert into private.academic_cleanup_backups (
  operation_key,
  entity_type,
  record_id,
  payload
)
select
  'duplicate_defile_2026_09_06',
  'attendance',
  a.id,
  to_jsonb(a)
from public.attendance a
join cleanup_duplicate_defile_target_children t on t.child_id = a.child_id
where a.subject = 'Дефиле'
  and a.lesson_date = date '2026-09-06'
on conflict do nothing;

insert into private.academic_cleanup_backups (
  operation_key,
  entity_type,
  record_id,
  payload
)
select
  'duplicate_defile_2026_09_06',
  'coin_transaction',
  ct.id,
  to_jsonb(ct)
from public.coin_transactions ct
join public.grades g on g.id = ct.source_id
join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
where ct.source = 'grade'
  and g.subject = 'Дефиле'
  and g.lesson_date = date '2026-09-06'
on conflict do nothing;

do $$
declare
  backed_up_grades integer;
  backed_up_attendance integer;
  backed_up_coins integer;
begin
  select count(*) filter (where entity_type = 'grade'),
         count(*) filter (where entity_type = 'attendance'),
         count(*) filter (where entity_type = 'coin_transaction')
  into backed_up_grades, backed_up_attendance, backed_up_coins
  from private.academic_cleanup_backups
  where operation_key = 'duplicate_defile_2026_09_06';

  if backed_up_grades <> 14
     or backed_up_attendance <> 13
     or backed_up_coins <> 14 then
    raise exception
      'Duplicate Defile cleanup backup incomplete: grades %, attendance %, coins %',
      backed_up_grades, backed_up_attendance, backed_up_coins;
  end if;
end;
$$;

delete from public.attendance a
using cleanup_duplicate_defile_target_children t
where a.child_id = t.child_id
  and a.subject = 'Дефиле'
  and a.lesson_date = date '2026-09-06';

-- The grade trigger removes its linked Star Coin transaction and recalculates balance.
delete from public.grades g
using cleanup_duplicate_defile_target_children t
where g.child_id = t.child_id
  and g.subject = 'Дефиле'
  and g.lesson_date = date '2026-09-06';

do $$
declare
  saturday_grades integer;
  sunday_grades integer;
  sunday_attendance integer;
  sunday_coins integer;
begin
  select count(*) into saturday_grades
  from public.grades g
  join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
  where g.subject = 'Дефиле'
    and g.lesson_date = date '2026-09-05';

  select count(*) into sunday_grades
  from public.grades g
  join cleanup_duplicate_defile_target_children t on t.child_id = g.child_id
  where g.subject = 'Дефиле'
    and g.lesson_date = date '2026-09-06';

  select count(*) into sunday_attendance
  from public.attendance a
  join cleanup_duplicate_defile_target_children t on t.child_id = a.child_id
  where a.subject = 'Дефиле'
    and a.lesson_date = date '2026-09-06';

  select count(*) into sunday_coins
  from public.coin_transactions ct
  join cleanup_duplicate_defile_target_children t on t.child_id = ct.child_id
  where ct.source = 'grade'
    and ct.source_id in (
      select (b.payload ->> 'id')::uuid
      from private.academic_cleanup_backups b
      where b.operation_key = 'duplicate_defile_2026_09_06'
        and b.entity_type = 'grade'
    );

  if saturday_grades <> 14
     or sunday_grades <> 0
     or sunday_attendance <> 0
     or sunday_coins <> 0 then
    raise exception
      'Duplicate Defile cleanup verification failed: Saturday grades %, Sunday grades %, attendance %, coins %',
      saturday_grades, sunday_grades, sunday_attendance, sunday_coins;
  end if;
end;
$$;
