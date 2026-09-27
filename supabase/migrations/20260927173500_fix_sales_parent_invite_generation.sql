create or replace function public.service_create_parent_invite(
  p_actor_auth_user_id uuid,
  p_family_id uuid,
  p_phone text,
  p_full_name text,
  p_valid_hours integer default 168
)
returns table(profile_id uuid, invite_id uuid, activation_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_branch text;
  v_phone text;
  v_profile_id uuid;
  v_invite_id uuid;
  v_code text;
  v_expires timestamptz;
  v_existing_auth uuid;
begin
  select r.name, up.staff_branch
    into v_actor_role, v_actor_branch
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.auth_user_id = p_actor_auth_user_id
  limit 1;

  if v_actor_role not in ('owner', 'project_director', 'admin', 'manager', 'sales') then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.families f where f.id = p_family_id) then
    raise exception 'family not found';
  end if;

  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then raise exception 'invalid phone format'; end if;
  if p_full_name is null or btrim(p_full_name) = '' then raise exception 'full name is required'; end if;

  if v_actor_role = 'admin' and not exists (
    select 1
    from public.children c
    where c.family_id = p_family_id
      and c.branch = v_actor_branch
      and c.archived_at is null
  ) then
    raise exception 'not authorized for family';
  end if;

  if v_actor_role = 'sales' then
    if v_actor_branch is not null and not exists (
      select 1
      from public.children c
      where c.family_id = p_family_id
        and c.branch = v_actor_branch
        and c.archived_at is null
    ) then
      raise exception 'not authorized for family';
    end if;

    if not exists (
      select 1
      from public.family_members fm
      join public.users_profile up on up.id = fm.user_id
      where fm.family_id = p_family_id
        and fm.relationship = 'parent'
        and public.normalize_phone(up.phone) = v_phone
    ) and not exists (
      select 1
      from public.parent_invites pi
      where pi.family_id = p_family_id
        and pi.phone_normalized = v_phone
    ) then
      raise exception 'not authorized for parent phone';
    end if;
  end if;

  select up.id, up.auth_user_id
    into v_profile_id, v_existing_auth
  from public.users_profile up
  where up.phone_normalized = v_phone
  limit 1;

  if v_existing_auth is not null then raise exception 'phone already registered'; end if;

  if v_profile_id is null then
    insert into public.users_profile (phone, phone_normalized, full_name, role_id)
    values (
      v_phone,
      v_phone,
      btrim(p_full_name),
      (select r.id from public.roles r where r.name = 'parent' limit 1)
    )
    returning id into v_profile_id;
  else
    update public.users_profile
    set phone = v_phone,
        phone_normalized = v_phone,
        full_name = btrim(p_full_name),
        role_id = (select r.id from public.roles r where r.name = 'parent' limit 1)
    where id = v_profile_id;
  end if;

  insert into public.family_members (family_id, user_id, relationship)
  values (p_family_id, v_profile_id, 'parent')
  on conflict (family_id, user_id) do update
    set relationship = excluded.relationship;

  update public.parent_invites pi
  set revoked_at = now(), updated_at = now()
  where pi.phone_normalized = v_phone
    and pi.family_id <> p_family_id
    and pi.claimed_at is null
    and pi.revoked_at is null;

  v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_valid_hours, 168), 720)));

  select pi.id
    into v_invite_id
  from public.parent_invites pi
  where pi.family_id = p_family_id
    and pi.phone = v_phone
  limit 1;

  if v_invite_id is null then
    insert into public.parent_invites (
      family_id,
      phone,
      phone_normalized,
      full_name,
      invite_code_hash,
      expires_at,
      attempt_count,
      max_attempts,
      claimed_at,
      revoked_at,
      updated_at
    ) values (
      p_family_id,
      v_phone,
      v_phone,
      btrim(p_full_name),
      extensions.crypt(v_code, extensions.gen_salt('bf', 10)),
      v_expires,
      0,
      5,
      null,
      null,
      now()
    )
    returning id into v_invite_id;
  else
    update public.parent_invites pi
    set phone = v_phone,
        phone_normalized = v_phone,
        full_name = btrim(p_full_name),
        invite_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf', 10)),
        expires_at = v_expires,
        attempt_count = 0,
        max_attempts = 5,
        claimed_at = null,
        revoked_at = null,
        updated_at = now()
    where pi.id = v_invite_id;
  end if;

  return query select v_profile_id, v_invite_id, v_code, v_expires;
end;
$$;

revoke all on function public.service_create_parent_invite(uuid, uuid, text, text, integer) from public;
revoke all on function public.service_create_parent_invite(uuid, uuid, text, text, integer) from anon;
revoke all on function public.service_create_parent_invite(uuid, uuid, text, text, integer) from authenticated;
grant execute on function public.service_create_parent_invite(uuid, uuid, text, text, integer) to service_role;
