-- OPEN STARS · Owner event management

create or replace function public.owner_create_event(
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_location text default null,
  p_branch_id uuid default null,
  p_default_fee numeric default null,
  p_status text default 'planned'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_event_id uuid;
begin
  if private.current_role() <> 'owner' then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then raise exception 'title required'; end if;
  if p_starts_at is null then raise exception 'starts_at required'; end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then raise exception 'invalid end time'; end if;
  if p_default_fee is not null and p_default_fee < 0 then raise exception 'invalid fee'; end if;
  if p_status not in ('planned', 'open', 'closed', 'completed', 'cancelled') then raise exception 'invalid status'; end if;
  if p_branch_id is not null and not exists (select 1 from public.branches b where b.id = p_branch_id and b.is_active) then raise exception 'invalid branch'; end if;

  insert into public.events (title, description, starts_at, ends_at, location, branch_id, default_fee, status)
  values (
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_starts_at,
    p_ends_at,
    nullif(trim(coalesce(p_location, '')), ''),
    p_branch_id,
    case when p_default_fee is null then null else round(p_default_fee::numeric, 2) end,
    p_status
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.owner_update_event(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_location text default null,
  p_branch_id uuid default null,
  p_default_fee numeric default null,
  p_status text default 'planned'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if private.current_role() <> 'owner' then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then raise exception 'title required'; end if;
  if p_starts_at is null then raise exception 'starts_at required'; end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then raise exception 'invalid end time'; end if;
  if p_default_fee is not null and p_default_fee < 0 then raise exception 'invalid fee'; end if;
  if p_status not in ('planned', 'open', 'closed', 'completed', 'cancelled') then raise exception 'invalid status'; end if;
  if p_branch_id is not null and not exists (select 1 from public.branches b where b.id = p_branch_id and b.is_active) then raise exception 'invalid branch'; end if;

  update public.events
  set title = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      location = nullif(trim(coalesce(p_location, '')), ''),
      branch_id = p_branch_id,
      default_fee = case when p_default_fee is null then null else round(p_default_fee::numeric, 2) end,
      status = p_status,
      updated_at = now()
  where id = p_event_id;

  if not found then raise exception 'event not found'; end if;
  return p_event_id;
end;
$$;

revoke all on function public.owner_create_event(text, text, timestamptz, timestamptz, text, uuid, numeric, text) from anon, public;
revoke all on function public.owner_update_event(uuid, text, text, timestamptz, timestamptz, text, uuid, numeric, text) from anon, public;
grant execute on function public.owner_create_event(text, text, timestamptz, timestamptz, text, uuid, numeric, text) to authenticated;
grant execute on function public.owner_update_event(uuid, text, text, timestamptz, timestamptz, text, uuid, numeric, text) to authenticated;
