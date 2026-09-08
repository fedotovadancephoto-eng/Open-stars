-- Separate unexposed schema avoids widening access to existing private routines.
create schema team_workspace;
revoke all on schema team_workspace from public,anon;
grant usage on schema team_workspace to authenticated;
-- Shared September goal and an audited daily task/report workflow.
create table team_workspace.team_goal (
  id text primary key, title text not null, starts_on date not null, due_on date not null,
  check(due_on>=starts_on)
);
insert into team_workspace.team_goal values('september_2026','330 действующих учеников','2026-09-08','2026-09-30');
alter table team_workspace.team_goal enable row level security;

create table team_workspace.team_work_tasks (
 id uuid primary key default gen_random_uuid(),
 goal_id text not null default 'september_2026' references team_workspace.team_goal(id),
 assignee_id uuid not null references public.users_profile(id),
 created_by uuid not null references public.users_profile(id),
 branch text, title text not null check(length(title) between 1 and 250),
 description text not null default '' check(length(description)<=4000),
 due_date date not null, priority text not null default 'normal' check(priority in ('normal','high')),
 metric text not null default 'none' check(metric in ('none','calls','leads','enrollment')),
 planned_amount integer check(planned_amount between 0 and 100000),
 status text not null default 'todo' check(status in ('todo','in_progress','submitted','accepted','returned','cancelled')),
 routine_key text, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(assignee_id,due_date,routine_key)
);
create index team_work_tasks_assignee_date on team_workspace.team_work_tasks(assignee_id,due_date);
create table team_workspace.team_work_events (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references team_workspace.team_work_tasks(id),
 actor_id uuid not null references public.users_profile(id),
 action text not null, payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create index team_work_events_task_date on team_workspace.team_work_events(task_id,created_at);
alter table team_workspace.team_work_tasks enable row level security;
alter table team_workspace.team_work_events enable row level security;
revoke all on team_workspace.team_goal,team_workspace.team_work_tasks,team_workspace.team_work_events from public,anon,authenticated;

-- Internal aggregate; only called inside the role-checked API below.
create function team_workspace.team_crm_day(p_day date,p_branch text,p_sales_id uuid default null)
returns jsonb language sql stable set search_path=''
as $$
 with leads as (
  select l.* from public.crm_leads l
  where (p_branch is null or l.branch=p_branch)
    and (p_sales_id is null or l.responsible_profile_id=p_sales_id)
 ), events as (
  select h.* from public.crm_lead_history h join leads l on l.id=h.lead_id
  where h.created_at>=p_day::timestamp at time zone 'Asia/Irkutsk'
    and h.created_at<(p_day+1)::timestamp at time zone 'Asia/Irkutsk'
 )
 select jsonb_build_object(
 'leads',(select count(*) from leads where created_at>=p_day::timestamp at time zone 'Asia/Irkutsk' and created_at<(p_day+1)::timestamp at time zone 'Asia/Irkutsk'),
 'trials',(select count(distinct lead_id) from events where to_stage='trial_booked' and from_stage is distinct from to_stage),
 'paid',(select count(distinct lead_id) from events where to_stage='paid' and from_stage is distinct from to_stage),
 'students',(select count(distinct lead_id) from events where to_stage='student' and from_stage is distinct from to_stage)
 )
$$;
revoke all on function team_workspace.team_crm_day(date,text,uuid) from public,anon,authenticated;

create function team_workspace.team_work_api(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=private.crm_actor_profile_id();
 role_name text:=private.current_role();
 reviewer boolean:=coalesce(private.current_role() in ('owner','project_director','manager'),false);
 work_day date:=coalesce(nullif(p_payload->>'day','')::date,(now() at time zone 'Asia/Irkutsk')::date);
 school_today date:=(now() at time zone 'Asia/Irkutsk')::date;
 task team_workspace.team_work_tasks%rowtype;
 assignee public.users_profile%rowtype;
 assignee_role text;
 item_id uuid:=nullif(p_payload->>'id','')::uuid;
 assigned uuid:=nullif(p_payload->>'assigneeId','')::uuid;
 wanted_branch text:=nullif(btrim(p_payload->>'branch'),'');
 wanted_plan integer:=nullif(p_payload->>'plannedAmount','')::integer;
 result jsonb;
 snapshot jsonb;
 actual integer;
 reached integer;
 daily_title text;
begin
 if auth.uid() is null or actor is null or coalesce(role_name,'') not in ('owner','project_director','manager','admin','sales','marketer','teacher') then
  raise exception 'not authorized';
 end if;
 if role_name='admin' and private.current_staff_branch() is null then raise exception 'not authorized'; end if;
 if work_day<date '2026-09-08' or work_day>school_today+366 then raise exception 'invalid work day'; end if;
 if p_action='prepare' then
  -- Materialize every day since launch so unopened days remain visible as overdue.
  if school_today>=date '2026-09-08' then
   insert into team_workspace.team_work_tasks(assignee_id,created_by,branch,title,description,due_date,metric,routine_key)
   select up.id,actor,case when r.name='admin' then up.staff_branch else null end,
    case r.name when 'sales' then 'Звонки и результат дня'
      when 'marketer' then 'Заявки и результат дня'
      when 'admin' then 'Наполняемость своего округа'
      else 'Контроль наполняемости всей школы' end,
    case r.name when 'sales' then 'Укажите количество звонков, дозвонов, результат и следующий шаг. События CRM показаны отдельно.'
      when 'marketer' then 'Проверьте новые заявки в CRM, опишите работу по каналам и следующий шаг.'
      when 'admin' then 'Проверьте пробные, пропуски, продления и причины ухода. Укажите действия по набору.'
      else 'Проверьте план по округам, просроченные задачи и отчёты. Укажите действия для достижения цели.' end,
    d.day::date,case r.name when 'sales' then 'calls' when 'marketer' then 'leads' else 'enrollment' end,'daily'
   from public.users_profile up join public.roles r on r.id=up.role_id
   cross join generate_series(date '2026-09-08',least(greatest(work_day,school_today),date '2026-09-30'),interval '1 day') d(day)
   where up.auth_user_id is not null and r.name in ('sales','marketer','admin','manager','project_director')
     and (reviewer or up.id=actor)
   on conflict(assignee_id,due_date,routine_key) do nothing;
  end if;
  p_action:='context';
 end if;
 if p_action='context' then
  select jsonb_build_object(
   'actorId',actor,'role',role_name,'canReview',reviewer,'day',work_day,'today',school_today,
   'goal',(select to_jsonb(g) from team_workspace.team_goal g where id='september_2026'),
   'branches',(select coalesce(jsonb_agg(jsonb_build_object('branch',b.name,'target',coalesce(t.student_target,0),
      'active',(select count(*) from public.children c where c.branch=b.name and c.archived_at is null)) order by b.sort_order,b.name),'[]')
     from public.branches b left join public.branch_student_targets t on t.branch_id=b.id where b.is_active),
   'staff',(select coalesce(jsonb_agg(jsonb_build_object('id',up.id,'name',coalesce(nullif(up.staff_display_name,''),up.full_name,'Сотрудник'),
       'role',r.name,'branch',up.staff_branch) order by up.full_name),'[]')
     from public.users_profile up join public.roles r on r.id=up.role_id
     where up.auth_user_id is not null and r.name in ('owner','project_director','manager','admin','sales','marketer','teacher') and (reviewer or up.id=actor)),
   'tasks',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('assigneeName',coalesce(nullif(up.staff_display_name,''),up.full_name,'Сотрудник'),
     'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from team_workspace.team_work_events e where e.task_id=t.id),'[]'))
      order by t.due_date,t.priority desc,t.created_at),'[]')
     from team_workspace.team_work_tasks t join public.users_profile up on up.id=t.assignee_id
     where (reviewer or t.assignee_id=actor)
       and (t.due_date=work_day or (t.due_date<work_day and t.status not in ('accepted','cancelled')))),
   'crm',case when role_name='teacher' then null else team_workspace.team_crm_day(work_day,
       case when role_name='admin' then private.current_staff_branch() else null end,
       case when role_name='sales' then actor else null end) end
  ) into result;
  return result;
 end if;
 if p_action='save' then
  if item_id is not null then
   select * into task from team_workspace.team_work_tasks where id=item_id for update;
   if not found or (not reviewer and task.assignee_id<>actor) then raise exception 'not authorized'; end if;
   if task.version is distinct from (p_payload->>'version')::integer then raise exception 'task changed'; end if;
   if task.status not in ('todo','in_progress') then raise exception 'task locked'; end if;
   assigned:=task.assignee_id;
  else assigned:=coalesce(assigned,actor);
  end if;
  if not reviewer and assigned<>actor then raise exception 'not authorized'; end if;
  select up.* into assignee from public.users_profile up join public.roles r on r.id=up.role_id
  where up.id=assigned and up.auth_user_id is not null and r.name in ('owner','project_director','manager','admin','sales','marketer','teacher');
  if not found then raise exception 'invalid assignee'; end if;
  select name into assignee_role from public.roles where id=assignee.role_id;
  if assignee_role='admin' then wanted_branch:=assignee.staff_branch; end if;
  if wanted_branch is not null and not exists(select 1 from public.branches where name=wanted_branch and is_active) then raise exception 'invalid branch'; end if;
  if coalesce(length(btrim(p_payload->>'title')),0) not between 1 and 250 then raise exception 'title required'; end if;
  if item_id is null then
   insert into team_workspace.team_work_tasks(assignee_id,created_by,branch,title,description,due_date,priority,metric,planned_amount)
   values(assigned,actor,wanted_branch,btrim(p_payload->>'title'),coalesce(p_payload->>'description',''),work_day,
      coalesce(p_payload->>'priority','normal'),coalesce(p_payload->>'metric','none'),wanted_plan) returning id into item_id;
  else
   update team_workspace.team_work_tasks set branch=wanted_branch,title=btrim(p_payload->>'title'),description=coalesce(p_payload->>'description',''),
     due_date=work_day,priority=coalesce(p_payload->>'priority','normal'),metric=coalesce(p_payload->>'metric','none'),
     planned_amount=wanted_plan,version=version+1,updated_at=now() where id=item_id;
  end if;
  insert into team_workspace.team_work_events(task_id,actor_id,action,payload)
  select item_id,actor,'plan',jsonb_build_object('before',case when task.id is not null then to_jsonb(task) else null end,'after',to_jsonb(t))
  from team_workspace.team_work_tasks t where t.id=item_id;
  return jsonb_build_object('id',item_id);
 end if;
 select * into task from team_workspace.team_work_tasks where id=item_id for update;
 if not found or (not reviewer and task.assignee_id<>actor) then raise exception 'not authorized'; end if;
 if task.version is distinct from (p_payload->>'version')::integer then raise exception 'task changed'; end if;
 if p_action='start' then
  if task.assignee_id<>actor or task.status not in ('todo','returned') then raise exception 'invalid transition'; end if;
  update team_workspace.team_work_tasks set status='in_progress',version=version+1,updated_at=now() where id=item_id;
 elsif p_action='report' then
  if task.assignee_id<>actor or task.status not in ('todo','in_progress','returned') then raise exception 'invalid transition'; end if;
  if task.due_date>school_today then raise exception 'future report'; end if;
  if coalesce(length(btrim(p_payload->>'outcome')),0) not between 1 and 4000 then raise exception 'result required'; end if;
  if length(coalesce(p_payload->>'nextStep',''))>4000 then raise exception 'result too long'; end if;
  select r.name into assignee_role from public.users_profile up join public.roles r on r.id=up.role_id where up.id=task.assignee_id;
  snapshot:=team_workspace.team_crm_day(task.due_date,task.branch,case when assignee_role='sales' then actor else null end);
  actual:=nullif(p_payload->>'actual','')::integer;
  reached:=nullif(p_payload->>'reached','')::integer;
  if task.metric='leads' then actual:=(snapshot->>'leads')::integer; end if;
  if task.metric='enrollment' then select count(*) into actual from public.children where archived_at is null and (task.branch is null or branch=task.branch); end if;
  if task.metric='calls' and actual is null then raise exception 'calls required'; end if;
  if actual<0 or actual>100000 or reached<0 or reached>coalesce(actual,0) then raise exception 'invalid actual'; end if;
  update team_workspace.team_work_tasks set status='submitted',version=version+1,updated_at=now() where id=item_id;
  insert into team_workspace.team_work_events(task_id,actor_id,action,payload)
  values(item_id,actor,'report',jsonb_build_object('actual',actual,'reached',reached,'outcome',btrim(p_payload->>'outcome'),
    'nextStep',coalesce(p_payload->>'nextStep',''),'crm',case when assignee_role='teacher' then null else snapshot end,'plan',task.planned_amount));
  return jsonb_build_object('id',item_id);
 elsif p_action in ('accept','return','cancel') then
  if not reviewer or (task.assignee_id=actor and role_name<>'owner') then raise exception 'not authorized'; end if;
  if p_action in ('accept','return') and task.status<>'submitted' then raise exception 'invalid transition'; end if;
  if p_action='cancel' and task.status in ('accepted','cancelled') then raise exception 'invalid transition'; end if;
  if p_action in ('return','cancel') and coalesce(length(btrim(p_payload->>'comment')),0)=0 then raise exception 'comment required'; end if;
  if length(coalesce(p_payload->>'comment',''))>4000 then raise exception 'result too long'; end if;
  update team_workspace.team_work_tasks set status=case p_action when 'accept' then 'accepted' when 'return' then 'returned' else 'cancelled' end,
    version=version+1,updated_at=now() where id=item_id;
 else raise exception 'unknown action';
 end if;
 insert into team_workspace.team_work_events(task_id,actor_id,action,payload) values(item_id,actor,p_action,jsonb_build_object('comment',coalesce(p_payload->>'comment','')));
 return jsonb_build_object('id',item_id);
end $$;
revoke all on function team_workspace.team_work_api(text,jsonb) from public,anon;
grant execute on function team_workspace.team_work_api(text,jsonb) to authenticated;
create function public.team_work(p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path=''
as $$ select team_workspace.team_work_api(p_action,p_payload) $$;
revoke all on function public.team_work(text,jsonb) from public,anon;
grant execute on function public.team_work(text,jsonb) to authenticated;
