-- Keep files private and publish the complete assignment in one transaction.
alter table public.homework
  add column materials jsonb not null default '[]'::jsonb,
  add column publication_id uuid;
alter table public.homework add constraint homework_materials_limit
  check (jsonb_typeof(materials)='array' and jsonb_array_length(materials)<=10);
create index homework_material_paths on public.homework using gin(materials jsonb_path_ops);
create index homework_publication_id on public.homework(publication_id) where publication_id is not null;
create unique index homework_publication_child on public.homework(publication_id,child_id) where publication_id is not null;

create table private.homework_publications (
  request_id uuid primary key,
  actor uuid not null,
  payload jsonb not null,
  recipient_count integer not null check (recipient_count>0),
  created_at timestamptz not null default now()
);
alter table private.homework_publications enable row level security;
revoke all on private.homework_publications from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('homework-materials','homework-materials',false,52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']);

create policy homework_materials_insert on storage.objects for insert to authenticated
with check(bucket_id='homework-materials' and (storage.foldername(name))[1]=(select auth.uid())::text
  and private.current_role() in ('owner','project_director','manager','admin','teacher'));
create policy homework_materials_read on storage.objects for select to authenticated
using(bucket_id='homework-materials' and (
  ((storage.foldername(name))[1]=(select auth.uid())::text
    and private.current_role() in ('owner','project_director','manager','admin','teacher'))
  or exists(select 1 from public.homework h
    where h.materials @> jsonb_build_array(jsonb_build_object('path',storage.objects.name)))
));

create function private.homework_material_unattached(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and split_part(p_path,'/',1)=auth.uid()::text
    and private.current_role() in ('owner','project_director','manager','admin','teacher')
    and not exists(select 1 from public.homework h
      where h.materials @> jsonb_build_array(jsonb_build_object('path',p_path)))
$$;
revoke all on function private.homework_material_unattached(text) from public,anon;
grant execute on function private.homework_material_unattached(text) to authenticated;
create policy homework_materials_delete on storage.objects for delete to authenticated
using(bucket_id='homework-materials' and private.homework_material_unattached(name));

create function private.validate_homework_materials() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_kind text; v_meta jsonb; v_seen text[]:='{}'; v_identity text; v_size bigint; v_existing boolean;
begin
  if tg_op='UPDATE' and new.materials is not distinct from old.materials then return new; end if;
  if new.materials is null or jsonb_typeof(new.materials)<>'array' or jsonb_array_length(new.materials)>10 then
    raise exception 'Не больше 10 материалов в одном домашнем задании.';
  end if;
  if new.materials='[]'::jsonb then return new; end if;
  if auth.uid() is null or coalesce(private.current_role(),'') not in ('owner','project_director','manager','admin','teacher') then
    raise exception 'not authorized';
  end if;
  for v_item in select value from jsonb_array_elements(new.materials) loop
    v_kind:=v_item->>'kind';
    if jsonb_typeof(v_item)<>'object' or jsonb_typeof(v_item->'name') is distinct from 'string'
      or length(btrim(v_item->>'name')) not between 1 and 180 then
      raise exception 'Укажите название материала до 180 символов.';
    end if;
    if v_kind='link' then
      if jsonb_typeof(v_item->'url') is distinct from 'string'
        or length(v_item->>'url')>2048
        or (v_item->>'url')!~'^https?://[^/?#[:space:]]+'
        or (v_item->>'url')~'[[:space:][:cntrl:]]'
        or strpos(v_item->>'url',chr(92))>0
        or (v_item->>'url')~'^https?://[^/?#]*@'
        or v_item ? 'path' then
        raise exception 'Добавьте обычную ссылку http или https без логина и пароля.';
      end if;
      v_identity:='link:'||(v_item->>'url');
    elsif v_kind in ('image','video') then
      if jsonb_typeof(v_item->'path') is distinct from 'string'
        or (v_item->>'path')!~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$'
        or jsonb_typeof(v_item->'size') is distinct from 'number'
        or jsonb_typeof(v_item->'mimeType') is distinct from 'string' then
        raise exception 'Некорректный файл домашнего задания.';
      end if;
      v_existing:=false;
      if tg_op='UPDATE' then
        v_existing:=old.materials @> jsonb_build_array(jsonb_build_object('path',v_item->>'path'));
      end if;
      if not v_existing and split_part(v_item->>'path','/',1)<>auth.uid()::text then
        raise exception 'Прикрепите файл, загруженный с вашего аккаунта.';
      end if;
      select o.metadata into v_meta from storage.objects o
        where o.bucket_id='homework-materials' and o.name=v_item->>'path' for key share;
      if not found then raise exception 'Файл не загружен. Загрузите его повторно.'; end if;
      v_size:=(v_meta->>'size')::bigint;
      if v_size is null or v_size<=0 or (v_meta->>'mimetype') is null or (v_item->>'size')::numeric<>v_size
        or (v_item->>'mimeType') is distinct from (v_meta->>'mimetype')
        or (v_kind='image' and ((v_meta->>'mimetype') not in ('image/jpeg','image/png','image/webp','image/gif') or v_size>10485760))
        or (v_kind='video' and ((v_meta->>'mimetype') not in ('video/mp4','video/quicktime','video/webm') or v_size>52428800)) then
        raise exception 'Проверьте формат и размер: фото до 10 МБ, видео до 50 МБ.';
      end if;
      v_identity:='file:'||(v_item->>'path');
    else raise exception 'Материал должен быть ссылкой, фото или видео.';
    end if;
    if v_identity=any(v_seen) then raise exception 'Этот материал уже прикреплён.'; end if;
    v_seen:=array_append(v_seen,v_identity);
  end loop;
  return new;
end $$;
revoke all on function private.validate_homework_materials() from public,anon,authenticated;
create trigger validate_homework_materials before insert or update of materials on public.homework
for each row execute function private.validate_homework_materials();

create function private.publish_group_homework_materials(
  p_branch text,p_group_name text,p_stream_start time,p_subject text,p_title text,
  p_description text,p_due_date date,p_lesson_date date,p_teacher_name text,p_materials jsonb,p_request uuid
) returns integer language plpgsql security definer set search_path='' as $$
declare v_role text; v_count integer; v_payload jsonb; v_existing private.homework_publications%rowtype;
begin
  v_role:=private.current_role();
  if auth.uid() is null or v_role is null or v_role not in ('owner','project_director','manager','admin','teacher') then raise exception 'not authorized'; end if;
  if p_request is null then raise exception 'request required'; end if;
  if p_lesson_date is null then raise exception 'date required'; end if;
  if btrim(coalesce(p_title,''))='' or btrim(coalesce(p_subject,''))='' then raise exception 'title and subject required'; end if;
  if v_role='admin' and p_branch is distinct from private.current_staff_branch() then raise exception 'wrong branch'; end if;
  if v_role='teacher' and not exists(select 1 from public.teacher_assignments ta
    where ta.teacher_user_id=(select auth.uid()) and ta.group_name=p_group_name and ta.subject=p_subject
      and (ta.branch is null or ta.branch=p_branch)) then raise exception 'not authorized'; end if;
  v_payload:=jsonb_build_object('branch',p_branch,'group',p_group_name,'stream',p_stream_start,
    'subject',p_subject,'title',p_title,'description',p_description,'dueDate',p_due_date,
    'lessonDate',p_lesson_date,'teacherName',p_teacher_name,'materials',coalesce(p_materials,'[]'));
  perform pg_advisory_xact_lock(hashtextextended('homework:'||p_request::text,0));
  select * into v_existing from private.homework_publications where request_id=p_request;
  if found then
    if v_existing.actor is distinct from auth.uid() then raise exception 'not authorized'; end if;
    if v_existing.payload is distinct from v_payload then raise exception 'Публикация уже сохранена с другим содержимым. Обновите историю.'; end if;
    return v_existing.recipient_count;
  end if;
  insert into public.homework(child_id,subject,text_content,lesson_date,title,description,due_date,status,created_by,teacher_name,materials,publication_id)
    select c.id,p_subject,p_description,p_lesson_date,p_title,p_description,p_due_date,'new',auth.uid(),
      nullif(btrim(coalesce(p_teacher_name,'')),''),coalesce(p_materials,'[]'),p_request
    from public.children c
    where c.archived_at is null and c.branch=p_branch and c.group_name=p_group_name
      and nullif(c.lesson_time,'')::time=p_stream_start
      and private.academic_child_matches_lesson_date(c.id,p_lesson_date)
      and private.academic_can_access_child_subject(c.id,p_subject);
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'В выбранной группе на эту дату нет учеников. Обновите список группы.'; end if;
  insert into private.homework_publications(request_id,actor,payload,recipient_count)
    values(p_request,auth.uid(),v_payload,v_count);
  return v_count;
end $$;
revoke all on function private.publish_group_homework_materials(text,text,time,text,text,text,date,date,text,jsonb,uuid) from public,anon;
grant execute on function private.publish_group_homework_materials(text,text,time,text,text,text,date,date,text,jsonb,uuid) to authenticated;
create function public.staff_publish_group_homework_materials(
  p_branch text,p_group_name text,p_stream_start time,p_subject text,p_title text,
  p_description text,p_due_date date,p_lesson_date date,p_teacher_name text,p_materials jsonb,p_request uuid
) returns integer language sql security invoker set search_path='' as $$
  select private.publish_group_homework_materials(p_branch,p_group_name,p_stream_start,p_subject,p_title,p_description,
    p_due_date,p_lesson_date,p_teacher_name,p_materials,p_request)
$$;
revoke all on function public.staff_publish_group_homework_materials(text,text,time,text,text,text,date,date,text,jsonb,uuid) from public,anon;
grant execute on function public.staff_publish_group_homework_materials(text,text,time,text,text,text,date,date,text,jsonb,uuid) to authenticated;
