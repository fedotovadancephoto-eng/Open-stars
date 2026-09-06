-- OPEN STARS · prevent grading a Saturday group on Sunday (and vice versa)

create or replace function private.academic_expected_lesson_day(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case extract(isodow from p_date)::integer
    when 1 then 'Понедельник'
    when 2 then 'Вторник'
    when 3 then 'Среда'
    when 4 then 'Четверг'
    when 5 then 'Пятница'
    when 6 then 'Суббота'
    when 7 then 'Воскресенье'
  end
$$;

create or replace function private.academic_child_matches_lesson_date(p_child_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.children c
    where c.id = p_child_id
      and c.archived_at is null
      and lower(btrim(coalesce(c.lesson_day, ''))) = lower(private.academic_expected_lesson_day(p_date))
  )
$$;

revoke all on function private.academic_expected_lesson_day(date) from public, anon;
revoke all on function private.academic_child_matches_lesson_date(uuid,date) from public, anon;
grant execute on function private.academic_expected_lesson_day(date) to authenticated;
grant execute on function private.academic_child_matches_lesson_date(uuid,date) to authenticated;

create or replace function public.staff_academic_roster(
  p_branch text,
  p_group_name text,
  p_stream_start time,
  p_lesson_date date,
  p_subject text
)
returns table(child_id uuid, child_name text, present boolean, grade integer)
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text;
begin
  v_role := private.current_role();
  if v_role not in ('owner','project_director','manager','admin','teacher') then raise exception 'not authorized'; end if;
  if p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  if p_group_name not in ('Базовый','Продвинутый','PRO') then raise exception 'invalid group'; end if;
  if p_stream_start not in ('11:00'::time,'13:00'::time,'16:00'::time) then raise exception 'invalid stream'; end if;
  if p_lesson_date is null then raise exception 'date required'; end if;
  if v_role = 'admin' and p_branch is distinct from private.current_staff_branch() then raise exception 'wrong branch'; end if;
  if v_role = 'teacher' and not exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_user_id = (select auth.uid())
      and ta.group_name = p_group_name
      and ta.subject = p_subject
      and (ta.branch is null or ta.branch = p_branch)
  ) then raise exception 'not authorized'; end if;

  return query
  select c.id, concat_ws(' ', c.first_name, c.last_name), a.present, g.grade
  from public.children c
  left join public.attendance a on a.child_id = c.id and a.lesson_date = p_lesson_date and a.subject = p_subject
  left join public.grades g on g.child_id = c.id and g.lesson_date = p_lesson_date and g.subject = p_subject
  where c.archived_at is null
    and c.branch = p_branch
    and c.group_name = p_group_name
    and nullif(c.lesson_time, '')::time = p_stream_start
    and lower(btrim(coalesce(c.lesson_day, ''))) = lower(private.academic_expected_lesson_day(p_lesson_date))
  order by c.last_name, c.first_name;
end;
$$;

create or replace function public.staff_save_academic_group(
  p_lesson_date date,
  p_subject text,
  p_entries jsonb,
  p_teacher_name text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_child uuid;
  v_present boolean;
  v_grade integer;
  v_count integer := 0;
begin
  if p_lesson_date is null or btrim(coalesce(p_subject, '')) = '' then raise exception 'date and subject required'; end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'entries required'; end if;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_child := (v_entry->>'childId')::uuid;
    if not private.academic_can_access_child_subject(v_child, p_subject) then raise exception 'not authorized'; end if;
    if not private.academic_child_matches_lesson_date(v_child, p_lesson_date) then raise exception 'wrong lesson date'; end if;

    if v_entry ? 'present' and nullif(v_entry->>'present', '') is not null then
      v_present := (v_entry->>'present')::boolean;
      insert into public.attendance(child_id, lesson_date, subject, present, marked_by)
      values(v_child, p_lesson_date, p_subject, v_present, (select auth.uid()))
      on conflict(child_id, lesson_date, subject) do update
      set present = excluded.present, marked_by = excluded.marked_by;
    else
      delete from public.attendance where child_id = v_child and lesson_date = p_lesson_date and subject = p_subject;
    end if;

    if v_entry ? 'grade' and nullif(v_entry->>'grade', '') is not null then
      v_grade := (v_entry->>'grade')::integer;
      if v_grade < 1 or v_grade > 5 then raise exception 'invalid grade'; end if;
      insert into public.grades(child_id, subject, grade, lesson_date, created_by, teacher_name)
      values(v_child, p_subject, v_grade, p_lesson_date, (select auth.uid()), nullif(btrim(coalesce(p_teacher_name, '')), ''))
      on conflict(child_id, lesson_date, subject) where child_id is not null and lesson_date is not null and subject is not null
      do update set grade = excluded.grade, created_by = excluded.created_by, teacher_name = excluded.teacher_name;
    else
      delete from public.grades where child_id = v_child and lesson_date = p_lesson_date and subject = p_subject;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.staff_academic_roster(text,text,time,date,text) from public, anon;
revoke all on function public.staff_save_academic_group(date,text,jsonb,text) from public, anon;
grant execute on function public.staff_academic_roster(text,text,time,date,text) to authenticated;
grant execute on function public.staff_save_academic_group(date,text,jsonb,text) to authenticated;

