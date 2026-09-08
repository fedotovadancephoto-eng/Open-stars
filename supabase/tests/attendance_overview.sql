begin;
do $$
declare v_owner uuid; v_admin uuid; v_child uuid; v_result jsonb; v_row jsonb; v_branch text;
begin
 select up.auth_user_id into v_owner from public.users_profile up join public.roles r on r.id=up.role_id where r.name='owner' and up.auth_user_id is not null limit 1;
 select up.auth_user_id into v_admin from public.users_profile up join public.roles r on r.id=up.role_id where r.name='admin' and up.auth_user_id is not null limit 1;
 select id into v_child from public.children where archived_at is null and lesson_day='Суббота' and branch='Свердловский' limit 1;
 if v_owner is null or v_admin is null or v_child is null then raise exception 'missing fixtures'; end if;
 if exists(select 1 from public.attendance where lesson_date='2097-12-28') or exists(select 1 from public.schedules where lesson_date='2097-12-28') then raise exception 'fixture date in use'; end if;
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 insert into public.schedules(child_id,lesson_date,subject,start_time,end_time)
 values(v_child,'2097-12-28','Дефиле','11:00','11:30'),(v_child,'2097-12-28','Хореография','11:35','12:05'),(v_child,'2097-12-28','Фотопозирование','12:10','12:40');
 insert into public.attendance(child_id,lesson_date,subject,present)
 values(v_child,'2097-12-28','Дефиле',true),(v_child,'2097-12-28','Хореография',true),(v_child,'2097-12-28','Фотопозирование',true);
 v_result:=public.staff_attendance_overview('2097-12-28','2097-12-28');
 if (select count(*) from jsonb_array_elements(v_result->'rows') where value->>'childId'=v_child::text)<>1 then raise exception 'subject duplication'; end if;
 select value into v_row from jsonb_array_elements(v_result->'rows') where value->>'childId'=v_child::text;
 if v_row->>'status'<>'present' then raise exception 'present missing'; end if;
 update public.attendance set present=false where child_id=v_child and lesson_date='2097-12-28';
 v_result:=public.staff_attendance_overview('2097-12-28','2097-12-28');
 select value into v_row from jsonb_array_elements(v_result->'rows') where value->>'childId'=v_child::text;
 if v_row->>'status'<>'absent' then raise exception 'full absence missing'; end if;
 delete from public.attendance where child_id=v_child and lesson_date='2097-12-28' and subject='Дефиле';
 v_result:=public.staff_attendance_overview('2097-12-28','2097-12-28');
 select value into v_row from jsonb_array_elements(v_result->'rows') where value->>'childId'=v_child::text;
 if v_row->>'status'<>'unmarked' then raise exception 'partial journal counted absent'; end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 v_branch:=private.current_staff_branch();
 v_result:=public.staff_attendance_overview('2026-09-01','2026-09-08');
 if exists(select 1 from jsonb_array_elements(v_result->'rows') where value->>'branch' is distinct from v_branch)
   or exists(select 1 from jsonb_array_elements_text(v_result->'branches') b where b is distinct from v_branch) then raise exception 'admin branch leak'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.staff_attendance_overview('2026-09-01','2026-09-08');
   raise exception 'anonymous access allowed';
 exception when raise_exception then if sqlerrm<>'not authorized' then raise; end if; end;
end $$;
rollback;
