-- OPEN STARS · restore an existing staff account and add grades for attended past lessons.

create or replace function private.restore_staff(
  p_profile_id uuid,
  p_full_name text,
  p_reason text default 'Возврат к работе'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := private.business_current_profile_id();
  v_person public.users_profile%rowtype;
  v_dismissal record;
  v_role text;
  v_branch text;
  v_assignments jsonb;
  v_assignment jsonb;
  v_at timestamptz := now();
begin
  if auth.uid() is null or v_actor is null or coalesce(private.current_role(), '') <> 'owner' then
    raise exception 'not authorized';
  end if;
  if p_profile_id is null then raise exception 'staff not found'; end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null then raise exception 'full name required'; end if;
  if length(btrim(p_full_name)) > 200 then raise exception 'full name too long'; end if;

  select * into v_person
  from public.users_profile
  where id = p_profile_id
  for update;
  if not found then raise exception 'staff not found'; end if;
  if v_person.auth_user_id is null then raise exception 'staff account is not activated'; end if;
  if not exists (
    select 1 from public.roles r where r.id = v_person.role_id and r.name = 'dismissed'
  ) then raise exception 'staff is not dismissed'; end if;

  select al.metadata, al.created_at into v_dismissal
  from public.approval_log al
  where al.entity_type = 'staff_access'
    and al.entity_id = p_profile_id
    and al.action = 'dismissed'
  order by al.created_at desc
  limit 1;
  if not found then raise exception 'dismissal history not found'; end if;

  v_role := v_dismissal.metadata->>'role';
  v_branch := nullif(v_dismissal.metadata->>'branch', '');
  v_assignments := coalesce(v_dismissal.metadata->'assignments', '[]'::jsonb);
  if v_role not in ('project_director', 'manager', 'admin', 'teacher', 'sales', 'marketer') then
    raise exception 'invalid staff role';
  end if;
  if v_role in ('manager', 'admin', 'teacher') and v_branch not in ('Свердловский', 'НЛО', 'Октябрьский') then
    raise exception 'branch required';
  end if;
  if v_role = 'teacher' and jsonb_array_length(v_assignments) = 0 then
    raise exception 'teacher assignments missing';
  end if;

  update public.users_profile
  set full_name = btrim(p_full_name),
      staff_display_name = btrim(p_full_name),
      role_id = (select r.id from public.roles r where r.name = v_role limit 1),
      staff_branch = case when v_role in ('manager', 'admin', 'teacher') then v_branch else null end
  where id = p_profile_id;

  delete from public.teacher_assignments where teacher_user_id = v_person.auth_user_id;
  for v_assignment in select value from jsonb_array_elements(v_assignments)
  loop
    if nullif(v_assignment->>'group_name', '') is not null
       and nullif(v_assignment->>'subject', '') is not null
       and coalesce(nullif(v_assignment->>'branch', ''), v_branch) in ('Свердловский', 'НЛО', 'Октябрьский') then
      insert into public.teacher_assignments(teacher_user_id, group_name, subject, branch)
      values (
        v_person.auth_user_id,
        v_assignment->>'group_name',
        v_assignment->>'subject',
        coalesce(nullif(v_assignment->>'branch', ''), v_branch)
      );
    end if;
  end loop;

  insert into public.approval_log(entity_type, entity_id, action, actor_profile_id, comment, metadata)
  values (
    'staff_access', p_profile_id, 'restored', v_actor,
    btrim(coalesce(nullif(p_reason, ''), 'Возврат к работе')),
    jsonb_build_object(
      'role', v_role,
      'branch', v_branch,
      'assignments', v_assignments,
      'restored_at', v_at,
      'dismissed_at', v_dismissal.created_at
    )
  );

  return jsonb_build_object(
    'profileId', p_profile_id,
    'fullName', btrim(p_full_name),
    'roleName', v_role,
    'branch', v_branch,
    'restored', true,
    'restoredAt', v_at
  );
end
$function$;

create or replace function public.staff_restore_staff(
  p_profile_id uuid,
  p_full_name text,
  p_reason text default 'Возврат к работе'
) returns jsonb
language sql
set search_path = ''
as $function$
  select private.restore_staff(p_profile_id, p_full_name, p_reason)
$function$;

revoke all on function public.staff_restore_staff(uuid, text, text) from public, anon;
grant execute on function public.staff_restore_staff(uuid, text, text) to authenticated;

create or replace function public.staff_add_history_grade(
  p_child_id uuid,
  p_subject text,
  p_grade integer,
  p_lesson_date date
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_grade_id uuid;
  v_subject text := btrim(coalesce(p_subject, ''));
  v_teacher_name text;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_child_id is null or p_lesson_date is null or v_subject = '' then
    raise exception 'child, date and subject required';
  end if;
  if p_grade < 1 or p_grade > 5 then raise exception 'invalid grade'; end if;
  if not private.academic_can_access_child_subject(p_child_id, v_subject) then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1
    from public.attendance a
    where a.child_id = p_child_id
      and a.lesson_date = p_lesson_date
      and a.subject = v_subject
      and a.present = true
  ) then
    raise exception 'attendance required';
  end if;

  select coalesce(nullif(up.staff_display_name, ''), nullif(up.full_name, ''), 'Преподаватель OPEN STARS')
  into v_teacher_name
  from public.users_profile up
  where up.auth_user_id = (select auth.uid())
  limit 1;

  insert into public.grades(child_id, subject, grade, lesson_date, created_by, teacher_name)
  values (p_child_id, v_subject, p_grade, p_lesson_date, (select auth.uid()), v_teacher_name)
  on conflict(child_id, lesson_date, subject)
    where child_id is not null and lesson_date is not null and subject is not null
  do update set
    grade = excluded.grade,
    created_by = excluded.created_by,
    teacher_name = excluded.teacher_name
  returning id into v_grade_id;

  return v_grade_id;
end
$function$;

revoke all on function public.staff_add_history_grade(uuid, text, integer, date) from public, anon;
grant execute on function public.staff_add_history_grade(uuid, text, integer, date) to authenticated;
