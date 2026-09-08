create or replace function public.staff_attendance_overview(p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_role text:=private.current_role(); v_result jsonb;
begin
 if auth.uid() is null or coalesce(v_role,'') not in ('owner','project_director','manager','admin') then raise exception 'not authorized'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>92 then raise exception 'invalid period'; end if;
 with children as (
   select c.* from public.children c where v_role<>'admin' or c.branch=private.current_staff_branch()
 ), dates as (
   select p_from+i as lesson_on from generate_series(0,p_to-p_from) i
 ), planned as (
   select c.id child_id,d.lesson_on from children c cross join dates d
   where (c.created_at at time zone 'Asia/Irkutsk')::date<=d.lesson_on
     and (c.archived_at is null or (c.archived_at at time zone 'Asia/Irkutsk')::date>d.lesson_on)
     and private.lesson_day_matches_date(c.lesson_day,d.lesson_on)
   union select s.child_id,s.lesson_date from public.schedules s join children c on c.id=s.child_id
     where s.lesson_date between p_from and p_to
 ), marks as (
   select a.child_id,a.lesson_date lesson_on,bool_or(a.present is true) present,
     count(*) filter(where a.present is not null) marked,
     count(*) filter(where a.present is false) absent_marks
   from public.attendance a join children c on c.id=a.child_id
   where a.lesson_date between p_from and p_to group by a.child_id,a.lesson_date
 ), scheduled as (
   select s.child_id,s.lesson_date lesson_on,count(distinct s.subject) subjects,
     count(distinct s.subject) filter(where exists(
       select 1 from public.attendance a where a.child_id=s.child_id and a.lesson_date=s.lesson_date
         and a.subject=s.subject and a.present is false)) absent_subjects
   from public.schedules s join children c on c.id=s.child_id
   where s.lesson_date between p_from and p_to group by s.child_id,s.lesson_date
 ), keys as (
   select child_id,lesson_on from planned union select child_id,lesson_on from marks
 ), rows as (
   select c.id,c.first_name||' '||c.last_name name,coalesce(c.branch,'Без округа') branch,
     c.group_name,c.lesson_day,c.lesson_time,k.lesson_on,
     exists(select 1 from planned p where p.child_id=k.child_id and p.lesson_on=k.lesson_on) expected,
     case when m.present then 'present'
       when s.subjects>0 and s.absent_subjects=s.subjects then 'absent'
       else 'unmarked' end status,
     coalesce(m.marked,0) marked,coalesce(s.subjects,0) subjects
   from keys k join children c on c.id=k.child_id
   left join marks m on m.child_id=k.child_id and m.lesson_on=k.lesson_on
   left join scheduled s on s.child_id=k.child_id and s.lesson_on=k.lesson_on
 )
 select jsonb_build_object('branches',(select jsonb_agg(b.name order by b.name) from public.branches b where v_role<>'admin' or b.name=private.current_staff_branch()),'rows',coalesce((
   select jsonb_agg(jsonb_build_object('childId',id,'name',name,'branch',branch,
     'group',group_name,'lessonDay',lesson_day,'time',lesson_time,'date',lesson_on,
     'expected',expected,'status',status,'markedSubjects',marked,'scheduledSubjects',subjects)
     order by lesson_on desc,branch,name) from rows),'[]'::jsonb),
   'unassigned',coalesce((select jsonb_agg(jsonb_build_object('childId',id,
      'name',first_name||' '||last_name,'branch',coalesce(branch,'Без округа')))
     from children where archived_at is null and coalesce(lesson_day,'') not in ('Суббота','Воскресенье')),'[]'::jsonb))
 into v_result;
 return v_result;
end $$;
revoke all on function public.staff_attendance_overview(date,date) from public,anon;
grant execute on function public.staff_attendance_overview(date,date) to authenticated;
