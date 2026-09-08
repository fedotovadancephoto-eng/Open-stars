create table team_workspace.group_targets (
 branch text not null, lesson_day text not null, lesson_time text not null, group_name text not null,
 target integer not null check(target between 0 and 1000),age_from integer check(age_from between 0 and 100),age_to integer check(age_to between 0 and 100),check((age_from is null and age_to is null) or (age_from is not null and age_to is not null and age_from<=age_to)),updated_by uuid not null references public.users_profile(id),updated_at timestamptz not null default now(),
 primary key(branch,lesson_day,lesson_time,group_name)
);
alter table team_workspace.group_targets enable row level security;
revoke all on team_workspace.group_targets from public,anon,authenticated;
create function team_workspace.group_occupancy(p_branch text default null) returns jsonb language sql stable set search_path='' as $$
 with actual as (
 select branch,coalesce(nullif(btrim(lesson_day),''),'Не указан') lesson_day,
 coalesce(nullif(left(btrim(lesson_time),5),''),'Не указано') lesson_time,
 coalesce(nullif(btrim(group_name),''),'Не указана') group_name,count(*)::integer actual
 from public.children where archived_at is null and (p_branch is null or branch=p_branch) group by 1,2,3,4
 ), keys as (
 select branch,lesson_day,lesson_time,group_name from actual union
 select branch,lesson_day,lesson_time,group_name from team_workspace.group_targets where p_branch is null or branch=p_branch
 )
 select coalesce(jsonb_agg(jsonb_build_object('branch',k.branch,'day',k.lesson_day,'time',k.lesson_time,'group',k.group_name,'ageFrom',t.age_from,'ageTo',t.age_to,'actual',coalesce(a.actual,0),'target',t.target,'missing',case when t.target is null then null else greatest(t.target-coalesce(a.actual,0),0) end)
 order by k.branch,array_position(array['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'],k.lesson_day),k.lesson_time,k.group_name),'[]')
 from keys k left join actual a using(branch,lesson_day,lesson_time,group_name) left join team_workspace.group_targets t using(branch,lesson_day,lesson_time,group_name)
$$;
revoke all on function team_workspace.group_occupancy(text) from public,anon,authenticated;
-- Administrator enrollment/payment report and project-role exclusion.
alter table team_workspace.team_work_tasks drop constraint team_work_tasks_metric_check;
alter table team_workspace.team_work_tasks add constraint team_work_tasks_metric_check check(metric in ('none','calls','leads','enrollment','branch_report'));
-- Preserve cancelled tasks and their history, but remove project staff from enrollment work.
with changed as (
 update team_workspace.team_work_tasks t set status='cancelled',version=version+1,updated_at=now()
 from public.users_profile u join public.roles r on r.id=u.role_id
 where t.assignee_id=u.id and r.name='project_director' and t.status not in ('accepted','cancelled') returning t.id,t.created_by
)
insert into team_workspace.team_work_events(task_id,actor_id,action,payload)
select id,created_by,'cancel',jsonb_build_object('comment','Исключено из плана набора по решению руководителя: сотрудник занимается проектами.') from changed;
update team_workspace.team_work_tasks t set metric='branch_report',title='План и оплаты своего округа',
 description='Заполните факт учеников без выбывших, сколько оплатили и сколько ещё должны оплатить за выбранный месяц. Недобор до цели рассчитается автоматически.',version=version+1,updated_at=now()
from public.users_profile u join public.roles r on r.id=u.role_id
where t.assignee_id=u.id and r.name='admin' and t.routine_key='daily' and t.status in ('todo','in_progress','returned');
create or replace function team_workspace.team_work_api(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=private.crm_actor_profile_id();
 role_name text:=private.current_role();
 reviewer boolean:=coalesce(private.current_role() in ('owner','manager'),false);
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
 branch_target integer;
 paid_students integer;
 due_students integer;
 payment_month date;
 wanted_group text:=btrim(p_payload->>'groupName');
begin
 if auth.uid() is null or actor is null or coalesce(role_name,'') not in ('owner','manager','admin','sales','marketer','teacher') then
  raise exception 'not authorized';
 end if;
 if role_name='admin' and private.current_staff_branch() is null then raise exception 'not authorized'; end if;
 if work_day<date '2026-09-08' or work_day>school_today+366 then raise exception 'invalid work day'; end if;
 if p_action='group_plan' then
  if not reviewer and role_name<>'admin' then raise exception 'not authorized'; end if;
  if role_name='admin' and wanted_branch is distinct from private.current_staff_branch() then raise exception 'not authorized'; end if;
  if wanted_branch is null or not exists(select 1 from public.branches where name=wanted_branch and is_active) then raise exception 'invalid branch'; end if;
  if coalesce(p_payload->>'lessonDay','') not in ('Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье')
   or coalesce(p_payload->>'lessonTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or coalesce(length(btrim(p_payload->>'groupName')),0) not between 1 and 100
   or wanted_plan is null or wanted_plan not between 0 and 1000 then raise exception 'invalid group plan'; end if;
  if wanted_branch='НЛО' and p_payload->>'lessonDay'='Воскресенье' and p_payload->>'lessonTime'='11:00' then
   wanted_group:=case lower(wanted_group) when 'база 1' then 'Базовый' when 'база 2' then 'Продвинутый' else wanted_group end;
  end if;
  insert into team_workspace.group_targets(branch,lesson_day,lesson_time,group_name,target,age_from,age_to,updated_by)
  values(wanted_branch,p_payload->>'lessonDay',p_payload->>'lessonTime',wanted_group,wanted_plan,nullif(p_payload->>'ageFrom','')::integer,nullif(p_payload->>'ageTo','')::integer,actor)
  on conflict(branch,lesson_day,lesson_time,group_name) do update set target=excluded.target,age_from=excluded.age_from,age_to=excluded.age_to,updated_by=actor,updated_at=now();
  return jsonb_build_object('saved',true);
 end if;
 if p_action='prepare' then
  -- Materialize every day since launch so unopened days remain visible as overdue.
  if school_today>=date '2026-09-08' then
   insert into team_workspace.team_work_tasks(assignee_id,created_by,branch,title,description,due_date,metric,routine_key)
   select up.id,actor,case when r.name='admin' then up.staff_branch else null end,
    case r.name when 'sales' then 'Звонки и результат дня'
      when 'marketer' then 'Заявки и результат дня'
      when 'admin' then 'План и оплаты своего округа'
      else 'Контроль наполняемости всей школы' end,
    case r.name when 'sales' then 'Укажите количество звонков, дозвонов, результат и следующий шаг. События CRM показаны отдельно.'
      when 'marketer' then 'Проверьте новые заявки в CRM, опишите работу по каналам и следующий шаг.'
      when 'admin' then 'Заполните факт учеников без выбывших, сколько оплатили и сколько ещё должны оплатить за выбранный месяц. Недобор до цели рассчитается автоматически.'
      else 'Проверьте план по округам, просроченные задачи и отчёты. Укажите действия для достижения цели.' end,
    d.day::date,case r.name when 'sales' then 'calls' when 'marketer' then 'leads' when 'admin' then 'branch_report' else 'enrollment' end,'daily'
   from public.users_profile up join public.roles r on r.id=up.role_id
   cross join generate_series(date '2026-09-08',least(greatest(work_day,school_today),date '2026-09-30'),interval '1 day') d(day)
   where up.auth_user_id is not null and r.name in ('sales','marketer','admin','manager')
     and (reviewer or up.id=actor)
   on conflict(assignee_id,due_date,routine_key) do nothing;
  end if;
  p_action:='context';
 end if;
 if p_action='context' then
  select jsonb_build_object(
   'groups',team_workspace.group_occupancy(null),'actorId',actor,'role',role_name,'canReview',reviewer,'day',work_day,'today',school_today,
   'goal',(select to_jsonb(g) from team_workspace.team_goal g where id='september_2026'),
   'branches',(select coalesce(jsonb_agg(jsonb_build_object('branch',b.name,'target',coalesce(t.student_target,0),
      'active',(select count(*) from public.children c where c.branch=b.name and c.archived_at is null)) order by b.sort_order,b.name),'[]')
     from public.branches b left join public.branch_student_targets t on t.branch_id=b.id where b.is_active),
   'staff',(select coalesce(jsonb_agg(jsonb_build_object('id',up.id,'name',coalesce(nullif(up.staff_display_name,''),up.full_name,'Сотрудник'),
       'role',r.name,'branch',up.staff_branch) order by up.full_name),'[]')
     from public.users_profile up join public.roles r on r.id=up.role_id
     where up.auth_user_id is not null and r.name in ('owner','manager','admin','sales','marketer','teacher') and (reviewer or up.id=actor)),
   'tasks',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('assigneeRole',(select name from public.roles where id=up.role_id),'branchTarget',(select bt.student_target from public.branches b join public.branch_student_targets bt on bt.branch_id=b.id where b.name=t.branch),'assigneeName',coalesce(nullif(up.staff_display_name,''),up.full_name,'Сотрудник'),
     'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from team_workspace.team_work_events e where e.task_id=t.id),'[]'))
      order by t.due_date,t.priority desc,t.created_at),'[]')
     from team_workspace.team_work_tasks t join public.users_profile up on up.id=t.assignee_id
     where exists(select 1 from public.roles r where r.id=up.role_id and r.name<>'project_director') and (reviewer or t.assignee_id=actor)
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
  where up.id=assigned and up.auth_user_id is not null and r.name in ('owner','manager','admin','sales','marketer','teacher');
  if not found then raise exception 'invalid assignee'; end if;
  select name into assignee_role from public.roles where id=assignee.role_id;
  if assignee_role='admin' then wanted_branch:=assignee.staff_branch; end if;
  if task.routine_key='daily' and assignee_role='admin' then raise exception 'branch report fixed'; end if;
  if p_payload->>'metric'='branch_report' and assignee_role<>'admin' then raise exception 'invalid assignee'; end if;
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
  if task.metric='branch_report' then
   select bt.student_target into branch_target from public.branches b join public.branch_student_targets bt on bt.branch_id=b.id where b.name=task.branch;
   paid_students:=nullif(p_payload->>'paidStudents','')::integer;
   due_students:=nullif(p_payload->>'dueStudents','')::integer;
   payment_month:=nullif(p_payload->>'paymentMonth','')::date;
   if branch_target is null or actual is null or paid_students is null or due_students is null or payment_month is null then raise exception 'branch figures required'; end if;
   if paid_students<0 or due_students<0 or paid_students+due_students>actual then raise exception 'invalid branch figures'; end if;
   if payment_month<>date_trunc('month',payment_month)::date then raise exception 'invalid payment month'; end if;
  end if;
  if task.metric='calls' and actual is null then raise exception 'calls required'; end if;
  if actual<0 or actual>100000 or reached<0 or reached>coalesce(actual,0) then raise exception 'invalid actual'; end if;
  update team_workspace.team_work_tasks set status='submitted',version=version+1,updated_at=now() where id=item_id;
  insert into team_workspace.team_work_events(task_id,actor_id,action,payload)
  values(item_id,actor,'report',jsonb_build_object('actual',actual,'reached',reached,'outcome',btrim(p_payload->>'outcome'),
    'nextStep',coalesce(p_payload->>'nextStep',''),'crm',case when assignee_role='teacher' then null else snapshot end,'plan',case when task.metric='branch_report' then branch_target else task.planned_amount end,'groups',case when task.metric='branch_report' then team_workspace.group_occupancy(task.branch) else null end,'paidStudents',paid_students,'dueStudents',due_students,'paymentMonth',payment_month,'missingStudents',case when task.metric='branch_report' then greatest(branch_target-actual,0) else null end));
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
