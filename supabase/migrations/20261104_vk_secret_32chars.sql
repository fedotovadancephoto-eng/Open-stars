-- VK Callback API rejects 64-character secrets. Generate 32 hex characters (128 bits).
-- Preserve verification for previously issued 64-character secrets until the owner rotates.
-- Only owner may read or rotate the VK integration settings.
CREATE OR REPLACE FUNCTION public.crm_vk_generate_setup(p_group_id bigint, p_confirmation_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := private.crm_actor_profile_id();
  v_role text := private.current_role();
  v_secret text;
  v_code text := trim(coalesce(p_confirmation_code, ''));
begin
  if (select auth.uid()) is null or v_actor is null
     or v_role <> 'owner' then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 then
    raise exception 'invalid group id';
  end if;
  if length(v_code) < 4 or length(v_code) > 128
     or v_code !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid VK confirmation code';
  end if;

  v_secret := encode(extensions.gen_random_bytes(16), 'hex');

  insert into private.crm_vk_callback_config
    (singleton, group_id, secret_hash, confirmation_code, updated_by, updated_at)
  values
    (true, p_group_id, encode(extensions.digest(v_secret, 'sha256'), 'hex'),
     v_code, v_actor, now())
  on conflict (singleton) do update
    set group_id = excluded.group_id,
        secret_hash = excluded.secret_hash,
        confirmation_code = excluded.confirmation_code,
        updated_by = excluded.updated_by,
        updated_at = now();

  return jsonb_build_object(
    'group_id', p_group_id::text,
    'secret', v_secret,
    'confirmation_code', v_code
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_vk_verify_callback(p_group_id bigint, p_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_config private.crm_vk_callback_config%rowtype;
  v_valid boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 or
     p_secret is null or p_secret !~ '^[0-9a-f]{32}([0-9a-f]{32})?$' then
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
$function$
;

CREATE OR REPLACE FUNCTION public.crm_vk_get_setup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.current_role();
  v_config private.crm_vk_callback_config%rowtype;
begin
  if (select auth.uid()) is null
     or v_role <> 'owner' then
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
$function$
;
