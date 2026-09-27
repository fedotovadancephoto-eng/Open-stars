create or replace function private.staff_can_activate_parent_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.current_role() in ('owner', 'project_director', 'manager') then exists (
      select 1 from public.children c where c.id = p_child_id and c.archived_at is null
    )
    when private.current_role() = 'admin' then exists (
      select 1
      from public.children c
      where c.id = p_child_id
        and c.archived_at is null
        and private.current_staff_branch() is not null
        and c.branch = private.current_staff_branch()
    )
    when private.current_role() = 'sales' then exists (
      select 1
      from public.children c
      where c.id = p_child_id
        and c.archived_at is null
        and (
          private.current_staff_branch() is null
          or c.branch = private.current_staff_branch()
        )
    )
    else false
  end
$$;

revoke all on function private.staff_can_activate_parent_child(uuid) from public;

create or replace function public.staff_parent_activation_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_children jsonb;
begin
  if v_role not in ('owner', 'project_director', 'manager', 'admin', 'sales') then
    raise exception 'not authorized';
  end if;
  if v_role = 'admin' and v_staff_branch is null then
    raise exception 'staff branch missing';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'child_id', c.id,
        'family_id', c.family_id,
        'child_name', concat_ws(' ', c.first_name, c.last_name),
        'parent_name', coalesce(parent_profile.full_name, latest_invite.full_name, ''),
        'phone', coalesce(parent_profile.phone, latest_invite.phone, ''),
        'branch', coalesce(c.branch, ''),
        'group_name', coalesce(c.group_name, ''),
        'activation_status', case
          when parent_profile.auth_user_id is not null or latest_invite.claimed_at is not null then 'active'
          when latest_invite.id is not null then 'invited'
          else 'not_invited'
        end
      )
      order by c.last_name, c.first_name
    ),
    '[]'::jsonb
  )
  into v_children
  from public.children c
  left join lateral (
    select up.full_name, up.phone, up.auth_user_id
    from public.family_members fm
    join public.users_profile up on up.id = fm.user_id
    where fm.family_id = c.family_id
      and fm.relationship = 'parent'
    order by up.created_at asc nulls last
    limit 1
  ) parent_profile on true
  left join lateral (
    select pi.id, pi.full_name, pi.phone, pi.claimed_at
    from public.parent_invites pi
    where pi.family_id = c.family_id
      and pi.revoked_at is null
    order by pi.created_at desc
    limit 1
  ) latest_invite on true
  where c.archived_at is null
    and c.family_id is not null
    and (
      v_role in ('owner', 'project_director', 'manager')
      or (v_role = 'admin' and c.branch = v_staff_branch)
      or (v_role = 'sales' and (v_staff_branch is null or c.branch = v_staff_branch))
    );

  return jsonb_build_object(
    'role', v_role,
    'staff_branch', coalesce(v_staff_branch, ''),
    'children', v_children
  );
end;
$$;

revoke all on function public.staff_parent_activation_context() from public;
grant execute on function public.staff_parent_activation_context() to authenticated;

create or replace function public.staff_generate_parent_invite(p_child_id uuid, p_valid_hours integer default 168)
returns table(child_id uuid, family_id uuid, child_name text, parent_name text, phone text, activation_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_family_id uuid;
  v_child_name text;
  v_parent_name text;
  v_phone text;
  v_auth_user_id uuid;
  v_code text;
  v_expires timestamptz;
begin
  v_role := private.current_role();
  if v_role not in ('owner', 'project_director', 'manager', 'admin', 'sales') then
    raise exception 'not authorized';
  end if;
  if not private.staff_can_activate_parent_child(p_child_id) then
    raise exception 'not authorized';
  end if;

  select c.family_id, concat_ws(' ', c.first_name, c.last_name)
    into v_family_id, v_child_name
  from public.children c
  where c.id = p_child_id and c.archived_at is null;

  if v_family_id is null then raise exception 'student not found'; end if;

  select up.full_name, up.phone, up.auth_user_id
    into v_parent_name, v_phone, v_auth_user_id
  from public.family_members fm
  join public.users_profile up on up.id = fm.user_id
  where fm.family_id = v_family_id
    and fm.relationship = 'parent'
  order by up.created_at asc nulls last
  limit 1;

  if v_phone is null then
    select pi.full_name, pi.phone
      into v_parent_name, v_phone
    from public.parent_invites pi
    where pi.family_id = v_family_id
    order by pi.created_at desc
    limit 1;
  end if;

  if v_auth_user_id is not null then raise exception 'parent already active'; end if;
  if v_phone is null or btrim(v_phone) = '' then raise exception 'parent phone missing'; end if;
  if v_parent_name is null or btrim(v_parent_name) = '' then v_parent_name := 'Родитель'; end if;

  select s.activation_code, s.expires_at
    into v_code, v_expires
  from public.service_create_parent_invite(
    (select auth.uid()), v_family_id, v_phone, v_parent_name, p_valid_hours
  ) s
  limit 1;

  return query select p_child_id, v_family_id, v_child_name, v_parent_name, v_phone, v_code, v_expires;
end;
$$;

create or replace function public.staff_reissue_parent_invite(p_child_id uuid, p_valid_hours integer default 168)
returns table(child_id uuid, family_id uuid, child_name text, parent_name text, phone text, activation_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
begin
  if private.current_role() not in ('owner', 'project_director', 'manager', 'admin', 'sales') then
    raise exception 'not authorized';
  end if;
  if not private.staff_can_activate_parent_child(p_child_id) then
    raise exception 'not authorized';
  end if;

  select c.family_id into v_family_id
  from public.children c
  where c.id = p_child_id and c.archived_at is null;

  if v_family_id is null then raise exception 'student not found'; end if;

  if not exists (
    select 1
    from public.parent_invites pi
    where pi.family_id = v_family_id
      and pi.claimed_at is null
      and pi.revoked_at is null
  ) then
    raise exception 'parent invite missing';
  end if;

  return query
  select * from public.staff_generate_parent_invite(p_child_id, p_valid_hours);
end;
$$;

create or replace function public.staff_generate_parent_invites(p_branch text default null, p_valid_hours integer default 168)
returns table(family_id uuid, children text, parent_name text, phone text, branch text, group_name text, activation_code text, expires_at timestamptz, error text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_staff_branch text;
  r record;
  v_parent_name text;
  v_phone text;
  v_auth_user_id uuid;
  v_code text;
  v_expires timestamptz;
  v_error text;
begin
  v_role := private.current_role();
  v_staff_branch := private.current_staff_branch();
  if v_role not in ('owner', 'project_director', 'manager', 'admin', 'sales') then
    raise exception 'not authorized';
  end if;

  if v_role = 'admin' then
    if v_staff_branch is null then raise exception 'staff branch missing'; end if;
    if p_branch is not null and p_branch <> v_staff_branch then raise exception 'not authorized'; end if;
  end if;
  if v_role = 'sales' and v_staff_branch is not null and p_branch is not null and p_branch <> v_staff_branch then
    raise exception 'not authorized';
  end if;

  for r in
    select
      c.family_id,
      string_agg(concat_ws(' ', c.first_name, c.last_name), ', ' order by c.last_name, c.first_name) as child_names,
      min(c.branch) as child_branch,
      string_agg(distinct coalesce(c.group_name, ''), ', ' order by coalesce(c.group_name, '')) as child_groups
    from public.children c
    where c.archived_at is null
      and c.family_id is not null
      and (v_role <> 'admin' or c.branch = v_staff_branch)
      and (v_role <> 'sales' or v_staff_branch is null or c.branch = v_staff_branch)
      and (p_branch is null or c.branch = p_branch)
    group by c.family_id
    order by min(c.branch), min(c.last_name), min(c.first_name)
  loop
    v_parent_name := null;
    v_phone := null;
    v_auth_user_id := null;
    v_code := null;
    v_expires := null;
    v_error := null;

    select up.full_name, up.phone, up.auth_user_id
      into v_parent_name, v_phone, v_auth_user_id
    from public.family_members fm
    join public.users_profile up on up.id = fm.user_id
    where fm.family_id = r.family_id and fm.relationship = 'parent'
    order by up.created_at asc nulls last
    limit 1;

    if v_phone is null then
      select pi.full_name, pi.phone
        into v_parent_name, v_phone
      from public.parent_invites pi
      where pi.family_id = r.family_id
      order by pi.created_at desc
      limit 1;
    end if;

    if v_auth_user_id is not null then continue; end if;

    if exists (
      select 1
      from public.parent_invites pi
      where pi.family_id = r.family_id
        and pi.claimed_at is null
        and pi.revoked_at is null
        and pi.expires_at > now()
        and pi.attempt_count < pi.max_attempts
    ) then
      continue;
    end if;

    if v_parent_name is null or btrim(v_parent_name) = '' then v_parent_name := 'Родитель'; end if;

    begin
      if v_phone is null or btrim(v_phone) = '' then raise exception 'parent phone missing'; end if;
      select s.activation_code, s.expires_at
        into v_code, v_expires
      from public.service_create_parent_invite(
        (select auth.uid()), r.family_id, v_phone, v_parent_name, p_valid_hours
      ) s
      limit 1;
    exception when others then
      v_error := sqlerrm;
    end;

    family_id := r.family_id;
    children := r.child_names;
    parent_name := v_parent_name;
    phone := v_phone;
    branch := r.child_branch;
    group_name := r.child_groups;
    activation_code := v_code;
    expires_at := v_expires;
    error := v_error;
    return next;
  end loop;
end;
$$;

revoke all on function public.staff_generate_parent_invite(uuid, integer) from public;
revoke all on function public.staff_reissue_parent_invite(uuid, integer) from public;
revoke all on function public.staff_generate_parent_invites(text, integer) from public;
grant execute on function public.staff_generate_parent_invite(uuid, integer) to authenticated;
grant execute on function public.staff_reissue_parent_invite(uuid, integer) to authenticated;
grant execute on function public.staff_generate_parent_invites(text, integer) to authenticated;
