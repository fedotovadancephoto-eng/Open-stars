begin;

do $t$
declare own uuid; adm uuid; adm_auth uuid; pd uuid; b text; j jsonb; tid uuid; ver integer; denied boolean; total int; before_target int;
begin
select u.auth_user_id into own from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
select u.id,u.auth_user_id,u.staff_branch into adm,adm_auth,b from public.users_profile u join public.roles r on r.id=u.role_id where r.name='admin' and u.auth_user_id is not null limit 1;
select u.auth_user_id into pd from public.users_profile u join public.roles r on r.id=u.role_id where r.name='project_director' and u.auth_user_id is not null limit 1;
perform set_config('request.jwt.claim.sub',own::text,true);
j:=public.team_work('prepare','{}');
assert not exists(select 1 from jsonb_array_elements(j->'staff') x where x->>'role'='project_director'),'project staff excluded';
assert not exists(select 1 from jsonb_array_elements(j->'tasks') x where x->>'assigneeRole'='project_director'),'project tasks excluded';
assert (select sum((x->>'actual')::int) from jsonb_array_elements(j->'groups') x)=(select count(*) from public.children where archived_at is null),'group counts reconcile';
assert not exists(select 1 from jsonb_array_elements(j->'groups') x where length(x->>'time')=8),'time normalized';
perform set_config('request.jwt.claim.sub',adm_auth::text,true);
perform public.team_work('group_plan',jsonb_build_object('branch',b,'lessonDay','Воскресенье','lessonTime','11:00','groupName','Тестовая пустая группа','plannedAmount',12,'ageFrom',7,'ageTo',10));
j:=public.team_work('context','{}');
assert exists(select 1 from jsonb_array_elements(j->'groups') x where x->>'group'='Тестовая пустая группа' and (x->>'actual')::int=0 and (x->>'missing')::int=12 and (x->>'ageFrom')::int=7),'empty group age need';
denied:=false;begin perform public.team_work('group_plan',jsonb_build_object('branch',case when b='НЛО' then 'Октябрьский' else 'НЛО' end,'lessonDay','Суббота','lessonTime','11:00','groupName','Тест','plannedAmount',1));exception when others then denied:=sqlerrm='not authorized';end;assert denied,'admin cross branch denied';
select id,version into tid,ver from team_workspace.team_work_tasks where assignee_id=adm and routine_key='daily' and due_date=(now() at time zone 'Asia/Irkutsk')::date and status in ('todo','in_progress','returned') limit 1;
assert tid is not null,'admin routine exists';
assert (select metric from team_workspace.team_work_tasks where id=tid)='branch_report','admin metric';
denied:=false;begin perform public.team_work('report',jsonb_build_object('id',tid,'version',ver,'actual',40,'paidStudents',35,'dueStudents',10,'paymentMonth','2026-09-01','outcome','invalid'));exception when others then denied:=sqlerrm='invalid branch figures';end;assert denied,'invalid payment counts';
perform public.team_work('report',jsonb_build_object('id',tid,'version',ver,'actual',40,'paidStudents',30,'dueStudents',10,'paymentMonth','2026-09-01','outcome','Проверено'));
select payload into j from team_workspace.team_work_events where task_id=tid and action='report' order by created_at desc limit 1;
assert (j->>'actual')::int=40 and (j->>'paidStudents')::int=30 and (j->>'dueStudents')::int=10,'manual report preserved';
assert (j->>'missingStudents')::int=greatest((j->>'plan')::int-40,0),'shortage calculated';
assert jsonb_array_length(j->'groups')>0,'group snapshot retained';
perform set_config('request.jwt.claim.sub',pd::text,true);
denied:=false;begin perform public.team_work('context','{}');exception when others then denied:=sqlerrm='not authorized';end;assert denied,'project director excluded';
perform set_config('request.jwt.claim.sub',own::text,true);
end $t$;
set local role authenticated;
select jsonb_array_length(public.team_work('context','{}')->'groups') as groups_visible;
reset role;

rollback;

