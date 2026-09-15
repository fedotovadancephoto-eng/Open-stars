-- No messages or push jobs survive this test. All writes, including pg_net wake-ups, roll back.
begin;
do $$
declare
  v_owner uuid; v_admin uuid; v_admin_profile uuid; v_branch text;
  v_parent uuid; v_parent_profile uuid; v_child uuid; v_other uuid;
  v_feedback uuid; v_request uuid := gen_random_uuid(); v_reply jsonb; v_retry jsonb;
  v_notification uuid; v_result jsonb; v_denied boolean; v_count integer;
  v_subscriptions integer; v_bad_role text; v_bad_auth uuid;
begin
  select u.auth_user_id into v_owner from public.users_profile u join public.roles r on r.id=u.role_id
    where r.name='owner' and u.auth_user_id is not null limit 1;
  select u.auth_user_id,u.id,u.staff_branch into v_admin,v_admin_profile,v_branch
    from public.users_profile u join public.roles r on r.id=u.role_id
    where r.name='admin' and u.auth_user_id is not null and u.staff_branch is not null limit 1;
  select u.auth_user_id,u.id,c.id into v_parent,v_parent_profile,v_child
    from public.children c join public.family_members fm on fm.family_id=c.family_id
    join public.users_profile u on u.id=fm.user_id
    where c.archived_at is null and c.branch=v_branch and u.auth_user_id is not null
      and u.auth_user_id not in (v_owner,v_admin) limit 1;
  select u.auth_user_id into v_other from public.users_profile u join public.roles r on r.id=u.role_id
    where r.name='parent' and u.auth_user_id is not null and u.auth_user_id<>v_parent limit 1;
  if v_owner is null or v_admin is null or v_parent is null or v_other is null then
    raise exception 'Owner, branch admin, linked parent and another parent fixtures required';
  end if;

  perform set_config('request.jwt.claim.sub',v_parent::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_parent,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_feedback := public.submit_parent_feedback(v_child,'education','Rollback-only parent feedback');
  if not exists(select 1 from jsonb_array_elements(public.parent_list_feedback(v_child)) x where x->>'id'=v_feedback::text) then
    raise exception 'Parent cannot see the original message';
  end if;
  v_denied:=false;
  begin perform public.staff_reply_parent_feedback(v_feedback,'Forged staff reply',gen_random_uuid());
    exception when others then v_denied:=sqlerrm='Нет доступа к ответам родителям.'; end;
  if not v_denied then raise exception 'Parent can impersonate staff'; end if;
  v_denied:=false;
  begin insert into public.parent_feedback_replies(feedback_id,staff_name_snapshot,message,request_id)
    values(v_feedback,'Forged staff','Must not be inserted',gen_random_uuid());
    exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Direct reply insertion is allowed'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_denied:=false;
  begin perform public.staff_reply_parent_feedback(v_feedback,'   ',gen_random_uuid());
    exception when others then v_denied:=sqlerrm='Введите ответ от 1 до 2000 символов.'; end;
  if not v_denied then raise exception 'Blank reply accepted'; end if;
  v_reply:=public.staff_reply_parent_feedback(v_feedback,'Rollback-only school answer',v_request);
  v_retry:=public.staff_reply_parent_feedback(v_feedback,'Rollback-only school answer',v_request);
  if v_reply<>v_retry then raise exception 'Retry returned a different reply'; end if;
  v_denied:=false;
  begin perform public.staff_reply_parent_feedback(v_feedback,'Changed message',v_request);
    exception when others then v_denied:=sqlerrm='Этот запрос уже использован для другого ответа.'; end;
  if not v_denied then raise exception 'Request ID allowed different content'; end if;
  execute 'reset role';
  if (select count(*) from public.parent_feedback_replies where feedback_id=v_feedback)<>1 then raise exception 'Duplicate replies'; end if;
  if (select status from public.parent_feedback where id=v_feedback)<>'read' then raise exception 'Reply did not mark message read'; end if;
  if (select count(*) from public.notifications where target='feedback' and target_id=v_feedback)<>1 then raise exception 'Duplicate notifications'; end if;
  select id into v_notification from public.notifications where target='feedback' and target_id=v_feedback;
  if not exists(select 1 from public.notifications where id=v_notification and recipient_user_id=v_parent) then raise exception 'Wrong notification recipient'; end if;
  select count(*) into v_subscriptions from parent_push.subscriptions where user_id=v_parent and enabled;
  if (select count(*) from parent_push.deliveries where notification_id=v_notification)<>v_subscriptions then raise exception 'Push queue missed an enabled device'; end if;
  if not private.pp_deliverable(v_notification,v_parent) or private.pp_deliverable(v_notification,v_other) then raise exception 'Wrong push delivery access'; end if;

  perform set_config('request.jwt.claim.sub',v_parent::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_parent,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select x into v_result from jsonb_array_elements(public.parent_list_feedback(v_child)) x where x->>'id'=v_feedback::text;
  if (v_result->'replies'->0->>'message') is distinct from 'Rollback-only school answer' then raise exception 'Reply missing in parent history'; end if;
  v_result:=public.parent_push('destination',jsonb_build_object('id',v_notification));
  if (v_result->>'tab') is distinct from 'feedback' or (v_result->>'feedbackId') is distinct from v_feedback::text or (v_result->>'childId') is distinct from v_child::text then raise exception 'Incorrect notification destination'; end if;
  v_denied:=false;
  begin update public.parent_feedback_replies set message='Tampered' where feedback_id=v_feedback;
    exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Reply editing allowed'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',v_other::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.parent_feedback where id=v_feedback) or exists(select 1 from public.parent_feedback_replies where feedback_id=v_feedback) then raise exception 'Another parent can read the thread'; end if;
  if exists(select 1 from jsonb_array_elements(public.parent_list_feedback(v_child)) x where x->>'id'=v_feedback::text) then raise exception 'Another parent can list the thread'; end if;
  if public.parent_push('destination',jsonb_build_object('id',v_notification)) is not null then raise exception 'Another parent can open notification'; end if;
  execute 'reset role';

  -- Move this rollback fixture outside the admin's branch and verify both RLS and write checks.
  update public.parent_feedback set branch_snapshot='Rollback other branch' where id=v_feedback;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.parent_feedback_replies where feedback_id=v_feedback) then raise exception 'Cross-branch read allowed'; end if;
  v_denied:=false;
  begin perform public.staff_reply_parent_feedback(v_feedback,'Wrong branch',gen_random_uuid());
    exception when others then v_denied:=sqlerrm='Обращение недоступно.'; end;
  if not v_denied then raise exception 'Cross-branch reply allowed'; end if;
  execute 'reset role';

  foreach v_bad_role in array array['dismissed','teacher','marketer'] loop
    select u.auth_user_id into v_bad_auth from public.users_profile u join public.roles r on r.id=u.role_id
      where r.name=v_bad_role and u.auth_user_id is not null limit 1;
    if v_bad_auth is null then raise exception 'Missing rejected-role fixture: %',v_bad_role; end if;
    perform set_config('request.jwt.claim.sub',v_bad_auth::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_bad_auth,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    v_denied:=false;
    begin perform public.staff_reply_parent_feedback(v_feedback,'Unauthorized role',gen_random_uuid());
      exception when others then v_denied:=sqlerrm='Нет доступа к ответам родителям.'; end;
    if not v_denied then raise exception 'Role % could reply',v_bad_role; end if;
    execute 'reset role';
  end loop;

  -- Global staff can add a second answer even to a closed/archived conversation.
  update public.parent_feedback set status='archived' where id=v_feedback;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.staff_reply_parent_feedback(v_feedback,'Rollback-only follow-up',gen_random_uuid());
  execute 'reset role';
  select count(*) into v_count from public.parent_feedback_replies where feedback_id=v_feedback;
  if v_count<>2 or (select status from public.parent_feedback where id=v_feedback)<>'archived' then raise exception 'Follow-up lost history or archive state'; end if;
  -- Removing family access also revokes feedback visibility and queued delivery.
  update public.children set archived_at=now() where id=v_child;
  if private.pp_deliverable(v_notification,v_parent) then raise exception 'Push survives child access revocation'; end if;
  perform set_config('request.jwt.claim.sub',v_parent::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_parent,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.parent_feedback_replies where feedback_id=v_feedback) then raise exception 'History survives child access revocation'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role authenticated';
  v_denied:=false;
  begin perform public.staff_reply_parent_feedback(v_feedback,'No login',gen_random_uuid());
    exception when others then v_denied:=sqlerrm='Нет доступа к ответам родителям.'; end;
  if not v_denied then raise exception 'Anonymous reply allowed'; end if;
  v_denied:=false;
  begin perform public.staff_delete_feedback(v_feedback); exception when others then v_denied:=sqlerrm='not authorized'; end;
  if not v_denied then raise exception 'Anonymous deletion allowed'; end if;
  execute 'reset role';
end $$;
rollback;
select 'PASS: parent isolation, branch access, rejected roles, immutable replies, idempotent send, one notification, device queue, destination and history. All messages rolled back.' as result;
