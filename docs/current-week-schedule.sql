CREATE OR REPLACE FUNCTION public.staff_publish_group_schedule(p_branch text, p_group_name text, p_first_date date, p_stream_start time without time zone, p_lessons jsonb, p_weeks integer DEFAULT 1)
 RETURNS TABLE(batch_id uuid, lesson_date date, students_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_profile_id uuid;
  v_week integer;
  v_batch_id uuid;
  v_date date;
  v_duration integer;
  v_break integer;
  v_pos integer;
  v_subject text;
  v_instructor text;
  v_room text;
  v_start time;
  v_end time;
  v_students integer;
begin
  select r.name, up.id into v_role, v_profile_id
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.auth_user_id = (select auth.uid())
  limit 1;

  if v_role is null or v_role not in ('owner','project_director','manager','admin') then raise exception 'not authorized'; end if;
  if v_role = 'admin' and p_branch is distinct from private.current_staff_branch() then raise exception 'wrong branch'; end if;
  if p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  if p_group_name not in ('Базовый','Продвинутый','PRO') then raise exception 'invalid group'; end if;
  if p_stream_start not in ('11:00'::time,'13:00'::time,'16:00'::time) then raise exception 'invalid stream'; end if;
  if p_first_date is null then raise exception 'date required'; end if;
  if p_weeks is distinct from 1 then raise exception 'Расписание публикуется только на одну неделю, без повторений.'; end if;
  if p_first_date < date_trunc('week', now() at time zone 'Asia/Irkutsk')::date or p_first_date >= date_trunc('week', now() at time zone 'Asia/Irkutsk')::date + 7 then raise exception 'Выберите дату текущей недели.'; end if;
  if jsonb_typeof(p_lessons) <> 'array' or jsonb_array_length(p_lessons) <> 3 then raise exception 'three lessons required'; end if;

  v_duration := case when p_stream_start = '11:00'::time then 30 else 45 end;
  v_break := case when p_stream_start = '11:00'::time then 5 else 10 end;

  for v_week in 0..p_weeks-1 loop
    v_date := p_first_date + (v_week * 7);

    insert into public.schedule_batches(branch, group_name, lesson_date, stream_start, created_by_profile_id)
    values (p_branch, p_group_name, v_date, p_stream_start, v_profile_id)
    on conflict on constraint schedule_batches_branch_group_name_lesson_date_stream_start_key
    do update set updated_at = now(), created_by_profile_id = excluded.created_by_profile_id
    returning id into v_batch_id;

    delete from public.schedules s where s.batch_id = v_batch_id;
    delete from public.schedule_batch_lessons l where l.batch_id = v_batch_id;

    delete from public.schedules s
    using public.children c
    where s.child_id = c.id
      and s.batch_id is null
      and s.lesson_date = v_date
      and c.archived_at is null
      and c.branch = p_branch
      and c.group_name = p_group_name
      and nullif(c.lesson_time,'')::time = p_stream_start
      and private.lesson_day_matches_date(c.lesson_day, v_date);

    for v_pos in 1..3 loop
      v_subject := btrim(coalesce(p_lessons->(v_pos-1)->>'subject',''));
      if v_subject = '' then raise exception 'subject required'; end if;
      v_instructor := nullif(btrim(coalesce(p_lessons->(v_pos-1)->>'instructor','')), '');
      v_room := nullif(btrim(coalesce(p_lessons->(v_pos-1)->>'room','')), '');
      v_start := (p_stream_start + make_interval(mins => (v_pos-1) * (v_duration + v_break)))::time;
      v_end := (v_start + make_interval(mins => v_duration))::time;

      insert into public.schedule_batch_lessons(batch_id, position, subject, start_time, end_time, instructor_name, room)
      values (v_batch_id, v_pos, v_subject, v_start, v_end, v_instructor, v_room);

      insert into public.schedules(child_id, lesson_date, subject, start_time, end_time, instructor_name, room, batch_id)
      select c.id, v_date, v_subject, v_start, v_end, v_instructor, v_room, v_batch_id
      from public.children c
      where c.archived_at is null
        and c.branch = p_branch
        and c.group_name = p_group_name
        and nullif(c.lesson_time,'')::time = p_stream_start
        and private.lesson_day_matches_date(c.lesson_day, v_date);
    end loop;

    select count(*)::integer into v_students
    from public.children c
    where c.archived_at is null
      and c.branch = p_branch
      and c.group_name = p_group_name
      and nullif(c.lesson_time,'')::time = p_stream_start
      and private.lesson_day_matches_date(c.lesson_day, v_date);

    batch_id := v_batch_id;
    lesson_date := v_date;
    students_count := v_students;
    return next;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.staff_list_group_schedules(p_from_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(batch_id uuid, branch text, group_name text, lesson_date date, stream_start time without time zone, students_count bigint, lessons jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    b.id,
    b.branch,
    b.group_name,
    b.lesson_date,
    b.stream_start,
    (select count(distinct s.child_id) from public.schedules s join public.children c on c.id = s.child_id and c.archived_at is null where s.batch_id = b.id) as students_count,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', l.position,
        'subject', l.subject,
        'start_time', to_char(l.start_time, 'HH24:MI'),
        'end_time', to_char(l.end_time, 'HH24:MI'),
        'instructor', l.instructor_name,
        'room', l.room
      ) order by l.position)
      from public.schedule_batch_lessons l where l.batch_id = b.id
    ), '[]'::jsonb) as lessons
  from public.schedule_batches b
  where b.lesson_date >= date_trunc('week', now() at time zone 'Asia/Irkutsk')::date
    and b.lesson_date < date_trunc('week', now() at time zone 'Asia/Irkutsk')::date + 7
    and (
      private.staff_has_global_access()
      or (private.current_role() = 'admin' and b.branch = private.current_staff_branch())
    )
  order by b.lesson_date, b.stream_start, b.branch, b.group_name;
$function$;

create table private.schedule_cleanup_20261127 as
select 'schedule_batches'::text as source, to_jsonb(b) as data from public.schedule_batches b where lesson_date >= '2026-11-30'
union all select 'schedule_batch_lessons',to_jsonb(l) from public.schedule_batch_lessons l join public.schedule_batches b on b.id=l.batch_id where b.lesson_date >= '2026-11-30'
union all select 'schedules',to_jsonb(s) from public.schedules s where s.lesson_date >= '2026-11-30';
alter table private.schedule_cleanup_20261127 enable row level security;
revoke all on private.schedule_cleanup_20261127 from public,anon,authenticated;
delete from public.schedules where lesson_date >= '2026-11-30';
delete from public.schedule_batches where lesson_date >= '2026-11-30';

