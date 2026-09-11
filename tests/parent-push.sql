-- Run after the migration in one transaction. All fixtures and outbound requests roll back.
begin;
do $$
declare a record; b record; g uuid; h uuid; t uuid; cmt uuid; coin uuid; sid uuid; nid uuid;
  before_count integer; n integer; secret text; jobs jsonb; job jsonb; charge public.monthly_payment_charges%rowtype;
begin
  update parent_push.config set enabled=false;
  select c.id child_id,u.auth_user_id uid into a from public.children c
    join public.family_members f on f.family_id=c.family_id join public.users_profile u on u.id=f.user_id
    where c.archived_at is null and u.auth_user_id is not null limit 1;
  select c.id child_id,u.auth_user_id uid into b from public.children c
    join public.family_members f on f.family_id=c.family_id join public.users_profile u on u.id=f.user_id
    where c.archived_at is null and u.auth_user_id is not null and not private.pp_has_child(a.uid,c.id) limit 1;
  assert a.uid is not null and b.uid is not null, 'Need two unrelated active families';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a.uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',a.uid::text,true);
  execute 'set local role authenticated';
  sid:=(public.parent_push('subscribe',jsonb_build_object('endpoint','https://fcm.googleapis.com/push/fixture-'||a.uid,
    'p256dh',repeat('A',87),'auth',repeat('B',22)))->>'id')::uuid;
  assert sid is not null, 'Authenticated parent can subscribe';
  perform public.parent_push('subscribe',jsonb_build_object('endpoint','https://fcm.googleapis.com/push/fixture-'||a.uid,
    'p256dh',repeat('A',87),'auth',repeat('B',22)));
  begin
    perform public.parent_push('subscribe',jsonb_build_object('endpoint','https://127.0.0.1/private','p256dh',repeat('A',87),'auth',repeat('B',22)));
    raise exception 'Private endpoint accepted';
  exception when others then assert sqlerrm<>'Private endpoint accepted'; end;
  execute 'reset role';
  assert (select count(*)=1 from parent_push.subscriptions where id=sid), 'Subscription registration is idempotent';
  assert not has_function_privilege('anon','public.parent_push(text,jsonb)','execute');
  assert not has_function_privilege('authenticated','public.parent_push_worker(text,text,jsonb)','execute');
  assert not has_table_privilege('authenticated','parent_push.subscriptions','select');

  insert into public.grades(child_id,subject,grade,lesson_date) values(a.child_id,'Push regression',4,current_date) returning id into g;
  select id into nid from public.notifications where target_id=g and recipient_user_id=a.uid;
  assert nid is not null, 'Grade creates family notification';
  assert not exists(select 1 from public.notifications where target_id=g and recipient_user_id=b.uid), 'No unrelated family notified';
  assert (select count(*)=1 from parent_push.deliveries where notification_id=nid and subscription_id=sid), 'Queue contains exactly one device delivery';
  select count(*) into before_count from public.notifications where target_id=g;
  update public.grades set grade=4 where id=g;
  assert (select count(*)=before_count from public.notifications where target_id=g), 'No duplicate for unchanged grade';
  update public.grades set grade=5 where id=g;
  assert (select count(*)=before_count*2 from public.notifications where target_id=g), 'Changed grade creates event';
  assert not private.pp_deliverable(nid,a.uid), 'Superseded grade is not delivered';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b.uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',b.uid::text,true);
  assert public.parent_push('destination',jsonb_build_object('id',nid)) is null, 'Notification destination cannot be read by another family';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a.uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',a.uid::text,true);
  assert public.parent_push('destination',jsonb_build_object('id',nid))->>'childId'=a.child_id::text, 'Destination selects correct child';

  insert into public.homework(child_id,subject,title,description) values(a.child_id,'Push regression','Fixture','Fixture') returning id into h;
  select count(*) into before_count from public.notifications where target_id=h;
  update public.homework set status=status where id=h;
  assert (select count(*)=before_count from public.notifications where target_id=h), 'Homework status does not resend assignment';
  insert into public.teacher_comments(child_id,subject,comment_text) values(a.child_id,'Push regression','Fixture') returning id into t;
  insert into public.homework_teacher_comments(homework_id,child_id,comment_text) values(h,a.child_id,'Fixture') returning id into cmt;
  assert exists(select 1 from public.notifications where target_id=t and target='comments');
  assert exists(select 1 from public.notifications where target_id=cmt and target='homework');
  insert into public.coin_transactions(child_id,amount,reason) values(a.child_id,1,'Push regression') returning id into coin;
  assert exists(select 1 from public.notifications where dedupe_key='coin:'||coin::text||':'||a.uid::text), 'Existing coin events feed the outbox';
  select id into nid from public.notifications where target_id=h and recipient_user_id=a.uid;
  update public.children set archived_at=now() where id=a.child_id;
  assert not private.pp_deliverable(nid,a.uid), 'Withdrawn students do not receive delivery';
  update public.children set archived_at=null where id=a.child_id;

  select * into charge from public.monthly_payment_charges limit 1;
  if charge.id is not null then
    update public.monthly_payment_charges set due_date=current_date-1,expected_amount=10000000 where id=charge.id;
    update public.payments set status='pending' where child_id=charge.child_id and month=charge.month;
    assert private.pp_charge_due(charge.id), 'Explicit unpaid charge is overdue';
    perform private.pp_debt_reminders();
    select count(*) into n from public.notifications where target='payments';
    perform private.pp_debt_reminders();
    assert (select count(*)=n from public.notifications where target='payments'), 'Reminders are not repeated within seven days';
    update public.payments set status='paid' where child_id=charge.child_id and month=charge.month;
    assert not private.pp_charge_due(charge.id), 'Paid charges stop reminders';
  end if;
  update parent_push.config set enabled=true;
  select v.decrypted_secret into secret from vault.decrypted_secrets v join parent_push.config c on c.dispatch_key_id=v.id;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  jobs:=public.parent_push_worker('claim',secret);
  assert jsonb_array_length(jobs)>0, 'Worker claims pending deliveries';
  job:=jobs->0;
  perform public.parent_push_worker('ack',secret,jsonb_build_object('results',jsonb_build_array(jsonb_build_object('id',job->'id','lease',gen_random_uuid(),'status',201))));
  assert (select state='sending' from parent_push.deliveries where id=(job->>'id')::bigint), 'Wrong lease cannot acknowledge delivery';
  perform public.parent_push_worker('ack',secret,jsonb_build_object('results',jsonb_build_array(jsonb_build_object('id',job->'id','lease',job->'lease','status',201))));
  assert (select state='sent' from parent_push.deliveries where id=(job->>'id')::bigint), 'Provider acceptance is recorded';
  if jsonb_array_length(jobs)>1 then
    job:=jobs->1;
    perform public.parent_push_worker('ack',secret,jsonb_build_object('results',jsonb_build_array(jsonb_build_object('id',job->'id','lease',job->'lease','status',410))));
    assert (select not enabled from parent_push.subscriptions where id=sid), 'Expired device is disabled';
  end if;
end $$;
select 'Parent push: access, events, deduplication, debt reminders and worker leases passed' as result;
rollback;
