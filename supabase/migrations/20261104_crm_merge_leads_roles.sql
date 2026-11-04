-- Merge genuine duplicate CRM lead cards without granting access to the inbound inbox.
-- Only owner, sales, and branch-limited admin may merge; manager can still view CRM but cannot merge.
-- Source data is preserved in a private audit table; tasks, history and linked inbound events are moved.
create table if not exists private.crm_lead_merge_audit (
  id uuid primary key default gen_random_uuid(),
  source_lead_id uuid not null unique,
  primary_lead_id uuid not null references public.crm_leads(id) on delete restrict,
  branch text not null,
  merged_by uuid references public.users_profile(id) on delete set null,
  source_snapshot jsonb not null,
  merged_at timestamptz not null default now(),
  constraint crm_lead_merge_not_self check (source_lead_id <> primary_lead_id)
);
create index if not exists crm_lead_merge_primary_idx on private.crm_lead_merge_audit(primary_lead_id, merged_at desc);
alter table private.crm_lead_merge_audit enable row level security;
revoke all on private.crm_lead_merge_audit from public, anon, authenticated;

create or replace function public.crm_merge_leads(p_primary_id uuid, p_duplicate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_actor uuid := private.crm_actor_profile_id();
  v_primary public.crm_leads%rowtype;
  v_duplicate public.crm_leads%rowtype;
  v_tasks integer := 0;
  v_history integer := 0;
  v_inbound integer := 0;
  v_note text;
begin
  if (select auth.uid()) is null or v_actor is null or v_role not in ('owner','admin','sales') then
    raise exception 'not authorized';
  end if;
  if p_primary_id is null or p_duplicate_id is null or p_primary_id = p_duplicate_id then
    raise exception 'select two different leads';
  end if;

  -- Deterministic row locking protects against concurrent merges and double clicks.
  perform 1 from public.crm_leads
    where id in (p_primary_id, p_duplicate_id)
    order by id for update;

  select * into v_primary from public.crm_leads where id = p_primary_id;
  select * into v_duplicate from public.crm_leads where id = p_duplicate_id;
  if v_primary.id is null or v_duplicate.id is null then
    raise exception 'lead not found';
  end if;
  if not private.crm_can_access_branch(v_primary.branch)
     or not private.crm_can_access_branch(v_duplicate.branch) then
    raise exception 'not authorized';
  end if;
  if v_primary.branch <> v_duplicate.branch then
    raise exception 'different branch';
  end if;
  if v_primary.phone_normalized <> v_duplicate.phone_normalized
    or private.crm_child_name_key(v_primary.child_name) <> private.crm_child_name_key(v_duplicate.child_name) then
    raise exception 'not the same child and phone';
  end if;
  if v_primary.child_birth_date is not null and v_duplicate.child_birth_date is not null
    and v_primary.child_birth_date <> v_duplicate.child_birth_date then
    raise exception 'different birth dates';
  end if;
  if v_primary.is_lost or v_primary.stage in ('paid','student') then
    raise exception 'choose an active unpaid primary lead';
  end if;
  if v_primary.converted_child_id is not null or v_duplicate.converted_child_id is not null
     or v_primary.linked_existing_child_id is not null or v_duplicate.linked_existing_child_id is not null
     or v_duplicate.stage in ('paid','student') then
    raise exception 'cannot merge student or paid leads';
  end if;

  insert into private.crm_lead_merge_audit
    (source_lead_id, primary_lead_id, branch, merged_by, source_snapshot)
  values (v_duplicate.id, v_primary.id, v_primary.branch, v_actor, to_jsonb(v_duplicate));

  update public.crm_tasks set lead_id = v_primary.id where lead_id = v_duplicate.id;
  get diagnostics v_tasks = row_count;
  update public.crm_lead_history set lead_id = v_primary.id where lead_id = v_duplicate.id;
  get diagnostics v_history = row_count;
  update public.crm_inbound_items set crm_lead_id = v_primary.id where crm_lead_id = v_duplicate.id;
  get diagnostics v_inbound = row_count;

  v_note := 'Объединено с дублем ' || left(v_duplicate.id::text, 8)
    || ' (' || v_duplicate.source || ', ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ').';
  if nullif(btrim(coalesce(v_duplicate.comment, '')), '') is not null then
    v_note := v_note || E'\nКомментарий дубля: ' || v_duplicate.comment;
  end if;
  update public.crm_leads set
    first_contact_at = least(v_primary.first_contact_at, v_duplicate.first_contact_at),
    trial_at = coalesce(v_primary.trial_at, v_duplicate.trial_at),
    child_birth_date = coalesce(v_primary.child_birth_date, v_duplicate.child_birth_date),
    comment = concat_ws(E'\n', nullif(btrim(coalesce(v_primary.comment,'')),''), v_note),
    updated_at = now()
  where id = v_primary.id;

  delete from public.crm_leads where id = v_duplicate.id;
  if not found then raise exception 'duplicate not removed'; end if;

  return jsonb_build_object(
    'primaryId', v_primary.id, 'mergedId', v_duplicate.id,
    'movedTasks', v_tasks, 'movedHistory', v_history, 'movedInbound', v_inbound
  );
end;
$$;

revoke all on function public.crm_merge_leads(uuid,uuid) from public, anon, authenticated;
grant execute on function public.crm_merge_leads(uuid,uuid) to authenticated;
