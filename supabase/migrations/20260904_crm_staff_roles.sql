-- OPEN STARS · CRM staff roles
-- Add CRM-only staff roles to the existing invitation flow without changing legacy staff roles.

create or replace function public.staff_create_staff_invite(
  p_full_name text,
  p_phone text,
  p_role_name text,
  p_branch text default null,
  p_teaching_subject text default null,
  p_valid_hours integer default 168
)
returns table(
  invite_id uuid,
  full_name text,
  phone text,
  role_name text,
  branch text,
  teaching_subject text,
  activation_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_phone text;
  v_role text;
  v_branch text;
  v_subject text;
  v_code text;
  v_expires timestamptz;
  v_id uuid;
begin
  v_actor_role := private.current_role();
  if v_actor_role not in ('owner','project_director') then raise exception 'not authorized'; end if;

  if nullif(btrim(coalesce(p_full_name,'')),'') is null then raise exception 'full name required'; end if;
  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then raise exception 'invalid phone'; end if;

  v_role := lower(btrim(coalesce(p_role_name,'')));
  if v_role not in ('project_director','manager','admin','teacher','sales','marketer') then raise exception 'invalid staff role'; end if;
  if v_role='project_director' and v_actor_role <> 'owner' then raise exception 'not authorized'; end if;

  v_branch := nullif(btrim(coalesce(p_branch,'')),'');
  if v_role in ('manager','admin','teacher') then
    if v_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'branch required'; end if;
  else
    v_branch := null;
  end if;

  v_subject := nullif(btrim(coalesce(p_teaching_subject,'')),'');
  if v_role='teacher' and v_subject is null then raise exception 'teaching subject required'; end if;
  if v_role in ('project_director','sales','marketer') then v_subject := null; end if;

  if coalesce(p_valid_hours,0) < 1 or p_valid_hours > 720 then raise exception 'invalid validity'; end if;

  if exists (
    select 1 from public.users_profile up
    where up.phone_normalized=v_phone and up.auth_user_id is not null
  ) then raise exception 'phone already active'; end if;

  update public.staff_invites
     set revoked_at=now(), updated_at=now()
   where phone_normalized=v_phone
     and claimed_at is null
     and revoked_at is null;

  v_code := lpad((floor(random()*1000000))::integer::text,6,'0');
  v_expires := now() + make_interval(hours => p_valid_hours);

  insert into public.staff_invites(
    phone, phone_normalized, full_name, role_name, branch, teaching_subject,
    invite_code_hash, expires_at, attempt_count, max_attempts
  ) values (
    v_phone, v_phone, btrim(p_full_name), v_role, v_branch, v_subject,
    extensions.crypt(v_code, extensions.gen_salt('bf')), v_expires, 0, 5
  ) returning id into v_id;

  return query select v_id, btrim(p_full_name), v_phone, v_role, v_branch, v_subject, v_code, v_expires;
end
$$;

create or replace function public.staff_list_staff_directory()
returns table(
  profile_id uuid,
  full_name text,
  role_name text,
  branch text,
  phone text,
  auth_user_id uuid,
  teaching_subjects text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text;
begin
  v_role := private.current_role();
  if v_role not in ('owner','project_director') then raise exception 'not authorized'; end if;
  return query
  select up.id,
         coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Сотрудник'),
         r.name,
         up.staff_branch,
         up.phone,
         up.auth_user_id,
         coalesce((
           select array_agg(distinct ta.subject order by ta.subject)
           from public.teacher_assignments ta
           where ta.teacher_user_id = up.auth_user_id
         ), array[]::text[])
  from public.users_profile up
  join public.roles r on r.id=up.role_id
  where r.name in ('owner','project_director','manager','admin','teacher','sales','marketer')
  order by case r.name
             when 'owner' then 1
             when 'project_director' then 2
             when 'manager' then 3
             when 'sales' then 4
             when 'marketer' then 5
             when 'admin' then 6
             else 7
           end,
           coalesce(up.staff_branch,''), coalesce(up.full_name,'');
end
$$;

revoke all on function public.staff_create_staff_invite(text,text,text,text,text,integer) from public, anon;
revoke all on function public.staff_list_staff_directory() from public, anon;
grant execute on function public.staff_create_staff_invite(text,text,text,text,text,integer) to authenticated;
grant execute on function public.staff_list_staff_directory() to authenticated;
