begin;
do $$
declare
  v_owner uuid;
  v_target uuid;
  v_target_auth uuid;
  v_name text;
  v_assignment_count integer;
  v_attendance public.attendance%rowtype;
  v_grade_id uuid;
  v_failed boolean;
begin
  select up.auth_user_id into v_owner
  from public.users_profile up join public.roles r on r.id=up.role_id
  where r.name='owner' and up.auth_user_id is not null limit 1;
  select up.id,up.auth_user_id,up.full_name into v_target,v_target_auth,v_name
  from public.users_profile up join public.roles r on r.id=up.role_id
  where r.name='teacher' and up.auth_user_id is not null limit 1;
  select count(*) into v_assignment_count from public.teacher_assignments where teacher_user_id=v_target_auth;
  select * into v_attendance from public.attendance where present=true limit 1;
  if v_owner is null or v_target is null or v_attendance.id is null then raise exception 'Fixtures required'; end if;

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  execute 'set local role authenticated';

  perform public.staff_dismiss_staff(v_target,'Restore rollback check');
  perform public.staff_restore_staff(v_target,v_name,'Restore rollback check');
  if not exists(select 1 from public.staff_list_staff_directory() where profile_id=v_target) then
    raise exception 'Restored staff missing from active directory';
  end if;
  if (select count(*) from public.teacher_assignments where teacher_user_id=v_target_auth)<>v_assignment_count then
    raise exception 'Teacher assignments were not restored';
  end if;

  v_grade_id:=public.staff_add_history_grade(v_attendance.child_id,v_attendance.subject,5,v_attendance.lesson_date);
  if not exists(select 1 from public.grades where id=v_grade_id and grade=5) then
    raise exception 'Past grade was not saved';
  end if;
  v_failed:=false;
  begin
    perform public.staff_add_history_grade(v_attendance.child_id,v_attendance.subject,5,'1900-01-01'::date);
  exception when others then
    v_failed:=sqlerrm='attendance required';
  end;
  if not v_failed then raise exception 'Grade without attendance was not rejected'; end if;
end $$;
rollback;

select 'PASS: staff restore keeps the same account and assignments; a past grade requires recorded attendance. All changes rolled back.' as result;
