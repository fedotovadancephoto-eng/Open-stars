-- VK provides the exact confirmation string; our server must echo that string.
-- Do not generate a different confirmation string.
alter table private.crm_vk_callback_config
  drop constraint if exists crm_vk_callback_config_confirmation_code_check;
alter table private.crm_vk_callback_config
  add constraint crm_vk_callback_config_confirmation_code_check
  check (length(confirmation_code) between 4 and 128);

drop function if exists public.crm_vk_generate_setup(bigint);

create or replace function public.crm_vk_generate_setup(
  p_group_id bigint,
  p_confirmation_code text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := private.crm_actor_profile_id();
  v_role text := private.current_role();
  v_secret text;
  v_code text := trim(coalesce(p_confirmation_code, ''));
begin
  if (select auth.uid()) is null or v_actor is null
     or v_role not in ('owner','project_director') then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 then
    raise exception 'invalid group id';
  end if;
  if length(v_code) < 4 or length(v_code) > 128
     or v_code !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid VK confirmation code';
  end if;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');

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
$$;

revoke all on function public.crm_vk_generate_setup(bigint,text) from public, anon, authenticated, service_role;
grant execute on function public.crm_vk_generate_setup(bigint,text) to authenticated;
