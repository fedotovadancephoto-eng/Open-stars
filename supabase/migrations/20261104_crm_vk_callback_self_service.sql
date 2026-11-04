-- VK Callback API: owner-managed setup with hashed secret (no Supabase Dashboard secrets).
create table if not exists private.crm_vk_callback_config (
  singleton boolean primary key default true check (singleton),
  group_id bigint not null check (group_id > 0),
  secret_hash text not null check (length(secret_hash) = 64),
  confirmation_code text not null check (length(confirmation_code) = 32),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users_profile(id) on delete set null
);
alter table private.crm_vk_callback_config enable row level security;
revoke all on private.crm_vk_callback_config from public, anon, authenticated, service_role;

-- The secret is returned only on generation. It is never stored in plaintext.
create or replace function public.crm_vk_generate_setup(p_group_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := private.crm_actor_profile_id();
  v_role text := private.current_role();
  v_secret text;
  v_confirmation text;
begin
  if (select auth.uid()) is null or v_actor is null
     or v_role not in ('owner','project_director') then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 then
    raise exception 'invalid group id';
  end if;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  v_confirmation := encode(extensions.gen_random_bytes(16), 'hex');

  insert into private.crm_vk_callback_config
    (singleton, group_id, secret_hash, confirmation_code, updated_by, updated_at)
  values
    (true, p_group_id, encode(extensions.digest(v_secret, 'sha256'), 'hex'),
     v_confirmation, v_actor, now())
  on conflict (singleton) do update
    set group_id = excluded.group_id,
        secret_hash = excluded.secret_hash,
        confirmation_code = excluded.confirmation_code,
        updated_by = excluded.updated_by,
        updated_at = now();

  return jsonb_build_object(
    'group_id', p_group_id::text,
    'secret', v_secret,
    'confirmation_code', v_confirmation
  );
end;
$$;

create or replace function public.crm_vk_get_setup()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_config private.crm_vk_callback_config%rowtype;
begin
  if (select auth.uid()) is null
     or v_role not in ('owner','project_director') then
    raise exception 'not authorized';
  end if;
  select * into v_config from private.crm_vk_callback_config where singleton = true;
  if not found then return jsonb_build_object('configured', false); end if;
  return jsonb_build_object(
    'configured', true,
    'group_id', v_config.group_id::text,
    'confirmation_code', v_config.confirmation_code,
    'updated_at', v_config.updated_at
  );
end;
$$;

-- Server-to-server verification; PostgREST service_role only.
create or replace function public.crm_vk_verify_callback(p_group_id bigint, p_secret text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_config private.crm_vk_callback_config%rowtype;
  v_valid boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 or
     p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('authorized', false);
  end if;

  select * into v_config from private.crm_vk_callback_config
  where singleton = true and group_id = p_group_id;
  if not found then return jsonb_build_object('authorized', false); end if;

  v_valid := v_config.secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
  if not v_valid then return jsonb_build_object('authorized', false); end if;
  return jsonb_build_object(
    'authorized', true,
    'confirmation_code', v_config.confirmation_code
  );
end;
$$;

revoke all on function public.crm_vk_generate_setup(bigint) from public, anon, authenticated, service_role;
revoke all on function public.crm_vk_get_setup() from public, anon, authenticated, service_role;
revoke all on function public.crm_vk_verify_callback(bigint,text) from public, anon, authenticated, service_role;
grant execute on function public.crm_vk_generate_setup(bigint) to authenticated;
grant execute on function public.crm_vk_get_setup() to authenticated;
grant execute on function public.crm_vk_verify_callback(bigint,text) to service_role;
