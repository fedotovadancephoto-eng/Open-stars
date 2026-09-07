-- Use the child's assigned weekday for all group publications.
CREATE OR REPLACE FUNCTION public.staff_publish_group_comment(p_branch text, p_group_name text, p_stream_start time without time zone, p_subject text, p_title text, p_comment_text text, p_comment_date date, p_teacher_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_count integer := 0;
  v_child record;
  v_publication_id uuid := gen_random_uuid();
begin
  v_role := private.current_role();
  if p_comment_date is null then raise exception 'date required'; end if;
  if btrim(coalesce(p_subject,'')) = '' then raise exception 'subject required'; end if;
  if btrim(coalesce(p_comment_text,'')) = '' then raise exception 'comment required'; end if;
  if v_role = 'admin' and p_branch is distinct from private.current_staff_branch() then raise exception 'wrong branch'; end if;
  if v_role = 'teacher' and not exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_user_id = (select auth.uid())
      and ta.group_name = p_group_name
      and ta.subject = p_subject
      and (ta.branch is null or ta.branch = p_branch)
  ) then raise exception 'not authorized'; end if;
  if auth.uid() is null or v_role is null or v_role not in ('owner','project_director','manager','admin','teacher') then raise exception 'not authorized'; end if;

  for v_child in
    select c.id
    from public.children c
    where c.archived_at is null
      and c.branch = p_branch
      and c.group_name = p_group_name
      and nullif(c.lesson_time,'')::time = p_stream_start
      and private.academic_child_matches_lesson_date(c.id, p_comment_date)
  loop
    if not private.academic_can_access_child_subject(v_child.id, p_subject) then raise exception 'not authorized'; end if;
    insert into public.teacher_comments(
      child_id, teacher_user_id, teacher_name, subject, title,
      comment_text, comment_date, publication_id, audience_scope
    ) values (
      v_child.id, (select auth.uid()), nullif(btrim(coalesce(p_teacher_name,'')),''),
      btrim(p_subject), nullif(btrim(coalesce(p_title,'')),''), btrim(p_comment_text),
      coalesce(p_comment_date,current_date), v_publication_id, 'group'
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('count', v_count, 'publication_id', v_publication_id);
end
$function$
;

CREATE OR REPLACE FUNCTION public.staff_publish_group_homework(p_branch text, p_group_name text, p_stream_start time without time zone, p_subject text, p_title text, p_description text, p_due_date date, p_lesson_date date, p_teacher_name text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_count integer:=0; v_child record;
begin
  v_role:=private.current_role();
  if p_lesson_date is null then raise exception 'date required'; end if;
  if btrim(coalesce(p_title,''))='' or btrim(coalesce(p_subject,''))='' then raise exception 'title and subject required'; end if;
  if v_role='admin' and p_branch is distinct from private.current_staff_branch() then raise exception 'wrong branch'; end if;
  if v_role='teacher' and not exists(select 1 from public.teacher_assignments ta where ta.teacher_user_id=(select auth.uid()) and ta.group_name=p_group_name and ta.subject=p_subject and (ta.branch is null or ta.branch=p_branch)) then raise exception 'not authorized'; end if;
  if auth.uid() is null or v_role is null or v_role not in ('owner','project_director','manager','admin','teacher') then raise exception 'not authorized'; end if;
  for v_child in select c.id from public.children c where c.archived_at is null and c.branch=p_branch and c.group_name=p_group_name and nullif(c.lesson_time,'')::time=p_stream_start
      and private.academic_child_matches_lesson_date(c.id, p_lesson_date) loop
    if not private.academic_can_access_child_subject(v_child.id,p_subject) then raise exception 'not authorized'; end if;
    insert into public.homework(child_id,subject,text_content,lesson_date,title,description,due_date,status,created_by,teacher_name)
    values(v_child.id,p_subject,p_description,p_lesson_date,p_title,p_description,p_due_date,'new',(select auth.uid()),nullif(btrim(coalesce(p_teacher_name,'')),''));
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$
;

-- Changing only a child's weekday must also resync future schedule rows.
drop trigger children_sync_group_schedules on public.children;
create trigger children_sync_group_schedules
after insert or update of branch,group_name,lesson_time,lesson_day,archived_at on public.children
for each row execute function public.sync_child_group_schedules();

revoke all on function public.staff_publish_group_homework(text,text,time,text,text,text,date,date,text) from public,anon;
revoke all on function public.staff_publish_group_comment(text,text,time,text,text,text,date,text) from public,anon;
grant execute on function public.staff_publish_group_homework(text,text,time,text,text,text,date,date,text) to authenticated;
grant execute on function public.staff_publish_group_comment(text,text,time,text,text,text,date,text) to authenticated;
