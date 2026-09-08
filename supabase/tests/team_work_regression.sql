begin;

do $test$
declare own uuid; sales uuid; sales_auth uuid; tid uuid; j jsonb; n int; denied boolean;
begin
 select u.auth_user_id into own from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
 select u.id,u.auth_user_id into sales,sales_auth from public.users_profile u join public.roles r on r.id=u.role_id where r.name='sales' and u.auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',own::text,true);
 j:=public.team_work('prepare','{}'); n:=jsonb_array_length(j->'tasks');
 j:=public.team_work('prepare','{}'); assert n=jsonb_array_length(j->'tasks'),'duplicate routines';
 assert (select sum((x->>'active')::int) from jsonb_array_elements(j->'branches') x)=(select count(*) from public.children where archived_at is null),'active total';
 tid:=(public.team_work('save',jsonb_build_object('assigneeId',sales,'title','Regression calls','metric','calls','plannedAmount',10))->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',sales_auth::text,true);
 j:=public.team_work('context','{}');
 assert not exists(select 1 from jsonb_array_elements(j->'tasks') t where t->>'assignee_id'<>sales::text),'task isolation';
 perform public.team_work('report',jsonb_build_object('id',tid,'version',1,'actual',8,'reached',4,'outcome','Result one'));
 denied:=false; begin perform public.team_work('accept',jsonb_build_object('id',tid,'version',2)); exception when others then denied:=sqlerrm='not authorized'; end; assert denied,'sales must not review';
 perform set_config('request.jwt.claim.sub',own::text,true);
 perform public.team_work('return',jsonb_build_object('id',tid,'version',2,'comment','Clarify'));
 perform set_config('request.jwt.claim.sub',sales_auth::text,true);
 denied:=false; begin perform public.team_work('report',jsonb_build_object('id',tid,'version',2,'actual',9,'outcome','Stale')); exception when others then denied:=sqlerrm='task changed'; end; assert denied,'stale version';
 perform public.team_work('report',jsonb_build_object('id',tid,'version',3,'actual',9,'outcome','Result two'));
 perform set_config('request.jwt.claim.sub',own::text,true);
 perform public.team_work('accept',jsonb_build_object('id',tid,'version',4));
 assert (select status from team_workspace.team_work_tasks where id=tid)='accepted','accept';
 assert (select count(*) from team_workspace.team_work_events where task_id=tid and action='report')=2,'history retained';
 j:=public.marketing_student_sources(null);
 assert (j->>'total')::int=(select count(*) from public.children where archived_at is null),'sources active total';
 assert (j->>'total')::int=(select sum((x->>'count')::int) from jsonb_array_elements(j->'rows') x),'sources sum';
end $test$;
select set_config('request.jwt.claim.sub',(select u.auth_user_id::text from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1),true);
set local role authenticated;
select jsonb_array_length(public.team_work('context','{}')->'branches') as authenticated_branch_count,public.marketing_student_sources(null)->>'total' as authenticated_source_total;
reset role;


do $t$
declare j jsonb; a record; denied boolean;
begin
 for a in select u.auth_user_id,r.name,u.staff_branch from public.users_profile u join public.roles r on r.id=u.role_id where u.auth_user_id is not null and r.name in ('admin','teacher','parent') loop
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 if a.name='parent' then
 denied:=false;begin perform public.team_work('context','{}');exception when others then denied:=sqlerrm='not authorized';end;assert denied,'parent team access';
 else
 j:=public.team_work('prepare','{}');
 assert not exists(select 1 from jsonb_array_elements(j->'tasks') t where t->>'assignee_id'<>j->>'actorId'),'employee task scope';
 if a.name='teacher' then assert j->'crm'='null'::jsonb,'teacher CRM';
 else j:=public.marketing_student_sources(null);assert (j->>'total')::int=(select count(*) from public.children where archived_at is null and branch=a.staff_branch),'admin sources branch';
 end if;
 end if;
 if a.name in ('teacher','parent') then denied:=false;begin perform public.marketing_student_sources(null);exception when others then denied:=sqlerrm='not authorized';end;assert denied,'source unauthorized';end if;
 end loop;
end $t$;
set local role authenticated;
do $t$
declare denied boolean:=false;
begin
 begin perform count(*) from team_workspace.team_work_tasks; exception when insufficient_privilege then denied:=true;end;assert denied,'direct task table denied';
end $t$;
reset role;

rollback;

