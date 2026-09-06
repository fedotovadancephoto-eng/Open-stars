-- Run after 20260906_academic_roster_lesson_day.sql.

do $$
declare
  v_roster text;
  v_save text;
begin
  if private.academic_expected_lesson_day('2026-09-05'::date) <> 'Суббота'
     or private.academic_expected_lesson_day('2026-09-06'::date) <> 'Воскресенье' then
    raise exception 'Russian lesson weekday mapping is incorrect';
  end if;
  select pg_get_functiondef('public.staff_academic_roster(text,text,time,date,text)'::regprocedure) into v_roster;
  select pg_get_functiondef('public.staff_save_academic_group(date,text,jsonb,text)'::regprocedure) into v_save;
  if position('academic_expected_lesson_day' in v_roster) = 0 then
    raise exception 'academic roster does not filter the configured lesson day';
  end if;
  if position('academic_child_matches_lesson_date' in v_save) = 0
     or position('wrong lesson date' in v_save) = 0 then
    raise exception 'academic save does not reject a mismatched lesson day';
  end if;
end;
$$;

