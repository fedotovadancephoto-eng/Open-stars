-- Owner-only synchronization with the existing 32-character VK Callback secret.
-- Stores SHA-256 only; never returns or logs the secret.
create or replace function public.crm_vk_sync_secret(p_group_id bigint, p_secret text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := private.crm_actor_profile_id();
  v_role text := private.current_role();
begin
  if (select auth.uid()) is null or v_actor is null or v_role <> 'owner' then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 or p_secret is null
     or p_secret !~ '^[0-9a-f]{32}$' then
    raise exception 'Expected the 32-character hexadecimal secret saved in VK';
  end if;
  update private.crm_vk_callback_config
  set secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex'),
      updated_by = v_actor, updated_at = now()
  where singleton = true and group_id = p_group_id;
  if not found then raise exception 'VK callback is not configured for this group'; end if;
  return '{"ok":true}'::jsonb;
end;
$$;
revoke all on function public.crm_vk_sync_secret(bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_vk_sync_secret(bigint,text) to authenticated;
