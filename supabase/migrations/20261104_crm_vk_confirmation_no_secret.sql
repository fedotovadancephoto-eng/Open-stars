-- VK sends the initial confirmation callback without the shared secret.
-- Only the server role can read the expected confirmation string.
create or replace function public.crm_vk_confirmation(p_group_id bigint)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_group_id is null or p_group_id < 1 then
    return null;
  end if;
  select confirmation_code into v_code
  from private.crm_vk_callback_config
  where singleton = true and group_id = p_group_id;
  return v_code;
end;
$$;
revoke all on function public.crm_vk_confirmation(bigint) from public, anon, authenticated, service_role;
grant execute on function public.crm_vk_confirmation(bigint) to service_role;
