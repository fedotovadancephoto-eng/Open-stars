-- Run as postgres on a populated school database. Everything, including push
-- queues, is rolled back. Storage rows below are metadata fixtures, not files.
begin;
do $$
declare
  v_teacher uuid; v_parent uuid; v_other_parent uuid; v_manager uuid;
  v_child uuid; v_branch text; v_group text; v_stream time; v_subject text; v_date date;
  v_request uuid:=gen_random_uuid(); v_path text; v_video_path text;
  v_materials jsonb; v_bad jsonb; v_failed boolean; v_count integer; v_expected integer;
  v_notifications bigint; v_deliveries bigint; v_ledger bigint;
begin
  select ta.teacher_user_id,c.id,c.branch,c.group_name,nullif(c.lesson_time,'')::time,
    ta.subject,up.auth_user_id,d.day::date
  into v_teacher,v_child,v_branch,v_group,v_stream,v_subject,v_parent,v_date
  from public.teacher_assignments ta
  join public.users_profile teacher on teacher.auth_user_id=ta.teacher_user_id
  join public.roles tr on tr.id=teacher.role_id and tr.name='teacher'
  join public.children c on c.group_name=ta.group_name and (ta.branch is null or ta.branch=c.branch)
  join public.family_members fm on fm.family_id=c.family_id
  join public.users_profile up on up.id=fm.user_id and up.auth_user_id is not null
  join public.roles pr on pr.id=up.role_id and pr.name='parent'
  cross join generate_series(current_date::timestamp,current_date+interval '6 days',interval '1 day') d(day)
  where c.archived_at is null and nullif(c.lesson_time,'') is not null
    and private.academic_child_matches_lesson_date(c.id,d.day::date)
  order by c.id,d.day limit 1;
  if v_teacher is null then raise exception 'Fixture needed: assigned teacher, active child and parent'; end if;
  select up.auth_user_id into v_other_parent from public.users_profile up
  join public.roles r on r.id=up.role_id and r.name='parent'
  where up.auth_user_id is not null and up.auth_user_id<>v_parent
    and not exists(select 1 from public.family_members fm join public.children c on c.family_id=fm.family_id
      where fm.user_id=up.id and c.archived_at is null and c.branch=v_branch and c.group_name=v_group
        and nullif(c.lesson_time,'')::time=v_stream and private.academic_child_matches_lesson_date(c.id,v_date))
  limit 1;
  select up.auth_user_id into v_manager from public.users_profile up
  join public.roles r on r.id=up.role_id and r.name='manager' where up.auth_user_id is not null limit 1;
  if v_other_parent is null or v_manager is null then raise exception 'Fixture needed: unrelated parent and manager'; end if;
  select count(*) into v_expected from public.children c where c.archived_at is null and c.branch=v_branch
    and c.group_name=v_group and nullif(c.lesson_time,'')::time=v_stream
    and private.academic_child_matches_lesson_date(c.id,v_date);
  v_path:=v_teacher::text||'/'||gen_random_uuid()::text||'.jpg';
  v_video_path:=v_teacher::text||'/'||gen_random_uuid()::text||'.mp4';
  insert into storage.objects(bucket_id,name,metadata) values
    ('homework-materials',v_path,jsonb_build_object('size',1024,'mimetype','image/jpeg')),
    ('homework-materials',v_video_path,jsonb_build_object('size',2048,'mimetype','video/mp4'));
  v_materials:=jsonb_build_array(
    jsonb_build_object('kind','link','name','Exercise link','url','https://example.org/exercise'),
    jsonb_build_object('kind','image','name','Exercise.jpg','path',v_path,'size',1024,'mimeType','image/jpeg'),
    jsonb_build_object('kind','video','name','Exercise.mp4','path',v_video_path,'size',2048,'mimeType','video/mp4'));

  perform set_config('request.jwt.claim.sub',v_teacher::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if not private.homework_material_unattached(v_path) then raise exception 'Own draft must be removable'; end if;
  v_count:=public.staff_publish_group_homework_materials(v_branch,v_group,v_stream,v_subject,
    'ROLLBACK homework materials test','Exercise',v_date+7,v_date,'Test',v_materials,v_request);
  if v_count<>v_expected or v_count<1 then raise exception 'Wrong weekday/stream recipient count'; end if;
  if private.homework_material_unattached(v_path) then raise exception 'Published file must be protected from draft cleanup'; end if;
  execute 'reset role';
  if exists(select 1 from public.homework where publication_id=v_request and materials<>v_materials)
    then raise exception 'Materials were not published atomically'; end if;
  select count(*) into v_notifications from public.notifications where target='homework'
    and target_id in (select id from public.homework where publication_id=v_request);
  if v_notifications<1 then raise exception 'Expected normal parent notification'; end if;
  select count(*) into v_deliveries from parent_push.deliveries;

  execute 'set local role authenticated';
  v_count:=public.staff_publish_group_homework_materials(v_branch,v_group,v_stream,v_subject,
    'ROLLBACK homework materials test','Exercise',v_date+7,v_date,'Test',v_materials,v_request);
  if v_count<>v_expected then raise exception 'Retry must return original recipient count'; end if;
  v_failed:=false;
  begin
    perform public.staff_publish_group_homework_materials(v_branch,v_group,v_stream,v_subject,
      'Changed retry','Exercise',v_date+7,v_date,'Test',v_materials,v_request);
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'Changed retry payload must fail'; end if;
  execute 'reset role';
  if (select count(*) from public.homework where publication_id=v_request)<>v_expected
    or (select count(*) from public.notifications where target='homework'
      and target_id in (select id from public.homework where publication_id=v_request))<>v_notifications
    or (select count(*) from parent_push.deliveries)<>v_deliveries
    then raise exception 'Retry created duplicate homework or notifications'; end if;
  select count(*) into v_ledger from private.homework_publications;

  execute 'set local role authenticated';
  for v_bad in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_array(jsonb_build_object('kind','link','name','Bad','url','javascript:alert(1)')),
    jsonb_build_array(jsonb_build_object('kind','link','name','Bad','url','https://user:pass@example.org')),
    jsonb_build_array(jsonb_build_object('kind','link','name','Bad','url',E'https://example.org/a\\b')),
    jsonb_build_array((v_materials->1)-'mimeType'),
    jsonb_build_array(jsonb_set(v_materials->1,'{size}','2048')),
    jsonb_build_array(jsonb_set(v_materials->1,'{kind}','"video"')),
    jsonb_build_array(jsonb_set(v_materials->1,'{path}',to_jsonb(v_other_parent::text||'/'||gen_random_uuid()::text||'.jpg'))),
    jsonb_build_array(jsonb_set(v_materials->1,'{path}',to_jsonb(v_teacher::text||'/'||gen_random_uuid()::text||'.jpg'))),
    jsonb_build_array(v_materials->1,v_materials->1),
    v_materials||v_materials||v_materials||v_materials
  )) loop
    v_failed:=false;
    begin
      perform public.staff_publish_group_homework_materials(v_branch,v_group,v_stream,v_subject,
        'ROLLBACK invalid materials test','Exercise',v_date+7,v_date,'Test',v_bad,gen_random_uuid());
    exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'Invalid material accepted: %',v_bad; end if;
  end loop;
  v_failed:=false;
  begin
    perform public.staff_publish_group_homework_materials(v_branch,v_group,v_stream,'Unassigned test subject',
      'ROLLBACK wrong subject','Exercise',v_date+7,v_date,'Test',v_materials,gen_random_uuid());
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'Unassigned teacher subject accepted'; end if;
  execute 'reset role';
  if (select count(*) from private.homework_publications)<>v_ledger then raise exception 'Failed publish wrote ledger'; end if;

  perform set_config('request.jwt.claim.sub',v_parent::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_parent,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from storage.objects where bucket_id='homework-materials' and name in(v_path,v_video_path))<>2
    then raise exception 'Recipient parent cannot read attachments'; end if;
  v_failed:=false;
  begin
    perform public.staff_publish_group_homework_materials(v_branch,v_group,v_stream,v_subject,
      'ROLLBACK parent publish','Exercise',v_date+7,v_date,'Test',v_materials,gen_random_uuid());
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'Parent can publish homework'; end if;
  update public.homework set title='Parent edit denied' where publication_id=v_request;
  get diagnostics v_count=row_count;
  if v_count<>0 then raise exception 'Parent can edit homework'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',v_other_parent::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other_parent,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from storage.objects where bucket_id='homework-materials' and name in(v_path,v_video_path))
    then raise exception 'Unrelated parent can read attachments'; end if;
  if exists(select 1 from public.homework where publication_id=v_request) then raise exception 'Unrelated parent can read homework'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',v_manager::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_manager,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  update public.homework set materials=jsonb_set(materials,'{1,name}','"Updated photo name"') where publication_id=v_request;
  get diagnostics v_count=row_count;
  if v_count<>v_expected then raise exception 'Manager must retain and edit teacher attachments'; end if;
  execute 'reset role';
  if has_table_privilege('authenticated','private.homework_publications','SELECT')
    or has_table_privilege('anon','private.homework_publications','SELECT') then raise exception 'Private publication ledger is exposed'; end if;
  if exists(select 1 from storage.buckets where id='homework-materials' and public) then raise exception 'Homework bucket must remain private'; end if;
end $$;
rollback;
select 'PASS: atomic publication; retry without duplicate notifications; material validation; teacher permissions; parent isolation; manager editing; private bucket and ledger. All fixtures rolled back.' as result;
