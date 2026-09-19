-- OPEN STARS · safe reactivation for an existing staff account
-- Keeps the same profile and auth user while allowing the owner to issue a
-- one-time code that replaces the employee's password during activation.

create or replace function public.staff_create_staff_reactivation_invite(
  p_profile_id uuid,
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
  v_profile public.users_profile%rowtype;
  v_role text;
  v_subject text;
  v_code text;
  v_expires timestamptz;
  v_id uuid;
begin
  if private.current_role() <> 'owner' then
    raise exception 'not authorized';
  end if;
  if coalesce(p_valid_hours, 0) < 1 or p_valid_hours > 720 then
    raise exception 'invalid validity';
  end if;

  select up.*
    into v_profile
  from public.users_profile up
  where up.id = p_profile_id
  for update;

  if not found or v_profile.auth_user_id is null or v_profile.phone_normalized is null then
    raise exception 'staff account is not active';
  end if;

  select r.name
    into v_role
  from public.roles r
  where r.id = v_profile.role_id;
  if v_role = 'owner' then
    raise exception 'cannot reactivate owner';
  end if;
  if v_role not in ('project_director','manager','admin','teacher','sales','marketer') then
    raise exception 'invalid staff role';
  end if;

  select ta.subject
    into v_subject
  from public.teacher_assignments ta
  where ta.teacher_user_id = v_profile.auth_user_id
  order by ta.subject
  limit 1;

  update public.staff_invites
     set revoked_at = now(), updated_at = now()
   where phone_normalized = v_profile.phone_normalized
     and claimed_at is null
     and revoked_at is null;

  v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  v_expires := now() + make_interval(hours => p_valid_hours);

  insert into public.staff_invites(
    phone, phone_normalized, full_name, role_name, branch, teaching_subject,
    invite_code_hash, expires_at, attempt_count, max_attempts
  ) values (
    v_profile.phone_normalized,
    v_profile.phone_normalized,
    coalesce(nullif(v_profile.staff_display_name, ''), nullif(v_profile.full_name, ''), 'Сотрудник'),
    v_role,
    case when v_role in ('sales','marketer') then null else v_profile.staff_branch end,
    v_subject,
    extensions.crypt(v_code, extensions.gen_salt('bf')),
    v_expires,
    0,
    5
  ) returning id into v_id;

  return query
  select v_id,
         coalesce(nullif(v_profile.staff_display_name, ''), nullif(v_profile.full_name, ''), 'Сотрудник'),
         v_profile.phone_normalized,
         v_role,
         case when v_role in ('sales','marketer') then null else v_profile.staff_branch end,
         v_subject,
         v_code,
         v_expires;
end;
$$;

revoke all on function public.staff_create_staff_reactivation_invite(uuid,integer)
  from public, anon;
grant execute on function public.staff_create_staff_reactivation_invite(uuid,integer)
  to authenticated;
