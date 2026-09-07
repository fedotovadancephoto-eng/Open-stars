-- Repair the confirmed Sverdlovsky weekend contamination; retain full recoverable rows.
create temporary table wrong_weekday_homework on commit drop as
select h.id from public.homework h join public.children c on c.id=h.child_id
where c.branch='Свердловский' and c.archived_at is null
  and c.lesson_day in ('Суббота','Воскресенье')
  and h.lesson_date in (date '2026-09-05',date '2026-09-06')
  and not private.lesson_day_matches_date(c.lesson_day,h.lesson_date);
create temporary table wrong_weekday_schedules on commit drop as
select s.id from public.schedules s join public.children c on c.id=s.child_id
where c.branch='Свердловский' and c.archived_at is null
  and c.lesson_day in ('Суббота','Воскресенье') and s.batch_id is not null
  and s.lesson_date in (date '2026-09-05',date '2026-09-06')
  and not private.lesson_day_matches_date(c.lesson_day,s.lesson_date);
do $$
begin
  perform 1 from public.homework where id in(select id from wrong_weekday_homework) for update;
  perform 1 from public.schedules where id in(select id from wrong_weekday_schedules) for update;
  if (select count(*) from wrong_weekday_homework) <> 43
    or (select count(*) from wrong_weekday_schedules) <> 6 then
    raise exception 'weekday repair target counts changed';
  end if;
  if exists(select 1 from public.homework h join wrong_weekday_homework t on t.id=h.id where h.status is distinct from 'new')
    or exists(select 1 from public.homework_teacher_comments hc join wrong_weekday_homework t on t.id=hc.homework_id) then
    raise exception 'weekday repair needs review: homework has work or comments';
  end if;
end $$;

insert into private.academic_cleanup_backups(operation_key,entity_type,record_id,payload)
select 'sverdlovsky_weekday_2026_09_07','homework',h.id,to_jsonb(h)
from public.homework h join wrong_weekday_homework t on t.id=h.id;
insert into private.academic_cleanup_backups(operation_key,entity_type,record_id,payload)
select 'sverdlovsky_weekday_2026_09_07','schedule',s.id,to_jsonb(s)
from public.schedules s join wrong_weekday_schedules t on t.id=s.id;
delete from public.homework h using wrong_weekday_homework t where h.id=t.id;
delete from public.schedules s using wrong_weekday_schedules t where s.id=t.id;
