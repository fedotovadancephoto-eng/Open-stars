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
  where b.lesson_date >= coalesce(p_from_date, current_date)
    and (
      private.staff_has_global_access()
      or (private.current_role() = 'admin' and b.branch = private.current_staff_branch())
    )
  order by b.lesson_date, b.stream_start, b.branch, b.group_name;
$function$;
