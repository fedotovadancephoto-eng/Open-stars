-- Exercise both weekend groups under real role checks. All fixture writes roll back.
begin;
do $$
declare v_owner uuid; v_teacher uuid; v_day date; v_count integer; v_expected integer;
  v_title text := 'weekday-regression-'||gen_random_uuid(); v_child uuid;
begin
 select up.auth_user_id into v_owner from public.users_profile up join public.roles r on r.id=up.role_id
 where r.name='owner' and up.auth_user_id is not null limit 1;
 select ta.teacher_user_id into v_teacher from public.teacher_assignments ta
 join public.users_profile up on up.auth_user_id=ta.teacher_user_id join public.roles r on r.id=up.role_id
 where r.name='teacher' and ta.group_name='Базовый' and ta.subject='Фотопозирование'
 and (ta.branch is null or ta.branch='Свердловский') limit 1;
 if v_owner is null or v_teacher is null then raise exception 'fixture roles missing'; end if;
 perform set_config('request.jwt.claim.sub',v_teacher::text,true);
 foreach v_day in array array[date '2026-09-05',date '2026-09-06'] loop
   select count(*) into v_expected from public.staff_academic_roster('Свердловский','Базовый','11:00',v_day,'Фотопозирование');
   if v_expected=0 then raise exception 'fixture group empty'; end if;
   v_count:=public.staff_publish_group_homework('Свердловский','Базовый','11:00','Фотопозирование',v_title,'test',v_day+7,v_day,null);
   if v_count<>v_expected then raise exception 'homework audience differs from roster'; end if;
   if exists(select 1 from public.homework h join public.children c on c.id=h.child_id
     where h.title=v_title and not private.lesson_day_matches_date(c.lesson_day,h.lesson_date)) then raise exception 'wrong weekday homework'; end if;
 end loop;
 if exists(select child_id from public.homework where title=v_title group by child_id having count(*)<>1) then raise exception 'child assigned both days'; end if;
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 select id into v_child from public.children where branch='Свердловский' and group_name='Базовый' and lesson_time='11:00'
   and lesson_day='Суббота' and archived_at is null limit 1;
 -- Known future Saturday/Sunday; publisher is exercised before weekday-only transfer.
 perform public.staff_publish_group_schedule('Свердловский','Базовый','2098-01-04','11:00',
 '[{"subject":"Фотопозирование"},{"subject":"Хореография"},{"subject":"Дефиле"}]',1);
 perform public.staff_publish_group_schedule('Свердловский','Базовый','2098-01-05','11:00',
 '[{"subject":"Фотопозирование"},{"subject":"Хореография"},{"subject":"Дефиле"}]',1);
 if (select count(*) from public.schedules where child_id=v_child and lesson_date='2098-01-04')<>3 then raise exception 'Saturday schedule missing'; end if;
 if exists(select 1 from public.schedules where child_id=v_child and lesson_date='2098-01-05') then raise exception 'Sunday schedule leaked'; end if;
 update public.children set lesson_day='Воскресенье' where id=v_child;
 if exists(select 1 from public.schedules where child_id=v_child and lesson_date='2098-01-04') then raise exception 'old day schedule retained'; end if;
 if (select count(*) from public.schedules where child_id=v_child and lesson_date='2098-01-05')<>3 then raise exception 'new day schedule missing'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.staff_publish_group_homework('Свердловский','Базовый','11:00','Фотопозирование',v_title,'test',current_date,current_date,null);
   raise exception 'anonymous publication allowed';
 exception when raise_exception then if sqlerrm<>'not authorized' then raise; end if; end;
end $$;
rollback;
