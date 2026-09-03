create table if not exists public.child_internal_profiles (
  child_id uuid primary key references public.children(id) on delete cascade,
  height_cm smallint null,
  acquisition_source text null,
  acquisition_source_note text null,
  updated_by_profile_id uuid null references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_internal_profiles_height_check
    check (height_cm is null or height_cm between 40 and 230),
  constraint child_internal_profiles_source_check
    check (
      acquisition_source is null or acquisition_source in (
        'Instagram', 'VK', '2ГИС', 'Яндекс', 'Сайт', 'Рекомендация',
        'Старая база', 'Наружная реклама', 'Партнёры', 'Мероприятие', 'Другое'
      )
    ),
  constraint child_internal_profiles_note_length_check
    check (acquisition_source_note is null or char_length(acquisition_source_note) <= 500)
);

create index if not exists child_internal_profiles_source_idx
  on public.child_internal_profiles(acquisition_source);
create index if not exists child_internal_profiles_updated_by_idx
  on public.child_internal_profiles(updated_by_profile_id);

alter table public.child_internal_profiles enable row level security;

create or replace function private.staff_can_access_child_internal(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.current_role() in ('owner','project_director','manager') then true
    when private.current_role() = 'admin' then exists (
      select 1
      from public.children c
      where c.id = p_child_id
        and c.branch = private.current_staff_branch()
    )
    else false
  end
$$;

revoke all on function private.staff_can_access_child_internal(uuid) from public, anon;
grant execute on function private.staff_can_access_child_internal(uuid) to authenticated;

revoke all on table public.child_internal_profiles from public, anon, authenticated;
grant select on table public.child_internal_profiles to authenticated;

drop policy if exists child_internal_profiles_staff_read on public.child_internal_profiles;
create policy child_internal_profiles_staff_read
on public.child_internal_profiles
for select
to authenticated
using (private.staff_can_access_child_internal(child_id));

create or replace function public.staff_set_child_internal_profile(
  p_child_id uuid,
  p_height_cm integer default null,
  p_acquisition_source text default null,
  p_acquisition_source_note text default null
)
returns table(
  child_id uuid,
  height_cm smallint,
  acquisition_source text,
  acquisition_source_note text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text := nullif(btrim(coalesce(p_acquisition_source, '')), '');
  v_note text := nullif(btrim(coalesce(p_acquisition_source_note, '')), '');
  v_profile_id uuid;
begin
  if not private.staff_can_access_child_internal(p_child_id) then
    raise exception 'not authorized';
  end if;

  if p_height_cm is not null and (p_height_cm < 40 or p_height_cm > 230) then
    raise exception 'invalid height';
  end if;

  if v_source is not null and v_source not in (
    'Instagram', 'VK', '2ГИС', 'Яндекс', 'Сайт', 'Рекомендация',
    'Старая база', 'Наружная реклама', 'Партнёры', 'Мероприятие', 'Другое'
  ) then
    raise exception 'invalid acquisition source';
  end if;

  if v_source = 'Другое' and v_note is null then
    raise exception 'source note is required';
  end if;

  if v_source is distinct from 'Другое' then
    v_note := null;
  end if;

  select up.id
  into v_profile_id
  from public.users_profile up
  where up.auth_user_id = (select auth.uid())
  limit 1;

  if p_height_cm is null and v_source is null and v_note is null then
    delete from public.child_internal_profiles cip
    where cip.child_id = p_child_id;

    return query
    select p_child_id, null::smallint, null::text, null::text, now();
    return;
  end if;

  insert into public.child_internal_profiles as cip (
    child_id,
    height_cm,
    acquisition_source,
    acquisition_source_note,
    updated_by_profile_id,
    updated_at
  )
  values (
    p_child_id,
    p_height_cm::smallint,
    v_source,
    v_note,
    v_profile_id,
    now()
  )
  on conflict on constraint child_internal_profiles_pkey do update
  set height_cm = excluded.height_cm,
      acquisition_source = excluded.acquisition_source,
      acquisition_source_note = excluded.acquisition_source_note,
      updated_by_profile_id = excluded.updated_by_profile_id,
      updated_at = excluded.updated_at;

  return query
  select cip.child_id, cip.height_cm, cip.acquisition_source, cip.acquisition_source_note, cip.updated_at
  from public.child_internal_profiles cip
  where cip.child_id = p_child_id;
end;
$$;

revoke all on function public.staff_set_child_internal_profile(uuid,integer,text,text) from public, anon;
grant execute on function public.staff_set_child_internal_profile(uuid,integer,text,text) to authenticated;

create or replace function public.staff_quick_create_student_v2(
  p_first_name text,
  p_last_name text,
  p_parent_name text,
  p_parent_phone text,
  p_branch text,
  p_group_name text,
  p_birth_date date default null,
  p_lesson_day text default null,
  p_lesson_time text default null,
  p_photo_url text default null,
  p_height_cm integer default null,
  p_acquisition_source text default null,
  p_acquisition_source_note text default null
)
returns table(child_id uuid, family_id uuid, parent_profile_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child_id uuid;
  v_family_id uuid;
  v_parent_profile_id uuid;
begin
  select q.child_id, q.family_id, q.parent_profile_id
  into v_child_id, v_family_id, v_parent_profile_id
  from public.staff_quick_create_student(
    p_first_name,
    p_last_name,
    p_parent_name,
    p_parent_phone,
    p_branch,
    p_group_name,
    p_birth_date,
    p_lesson_day,
    p_lesson_time,
    p_photo_url
  ) q
  limit 1;

  if p_height_cm is not null
     or nullif(btrim(coalesce(p_acquisition_source, '')), '') is not null
     or nullif(btrim(coalesce(p_acquisition_source_note, '')), '') is not null then
    perform public.staff_set_child_internal_profile(
      v_child_id,
      p_height_cm,
      p_acquisition_source,
      p_acquisition_source_note
    );
  end if;

  return query select v_child_id, v_family_id, v_parent_profile_id;
end;
$$;

revoke all on function public.staff_quick_create_student_v2(text,text,text,text,text,text,date,text,text,text,integer,text,text) from public, anon;
grant execute on function public.staff_quick_create_student_v2(text,text,text,text,text,text,date,text,text,text,integer,text,text) to authenticated;