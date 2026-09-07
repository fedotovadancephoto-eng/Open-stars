-- A parent may have multiple children; duplicate identity is phone + normalized child name.
create or replace function private.crm_child_name_key(p_name text)
returns text language sql immutable strict set search_path = ''
as $$ select lower(replace(regexp_replace(btrim(p_name),'\s+',' ','g'),'ё','е')) $$;
revoke all on function private.crm_child_name_key(text) from public,anon;
grant execute on function private.crm_child_name_key(text) to authenticated;

drop index public.crm_leads_active_phone_unique;
create unique index crm_leads_active_child_phone_unique
on public.crm_leads(phone_normalized,private.crm_child_name_key(child_name))
where not is_lost and converted_child_id is null;

create or replace function public.crm_create_lead(
  p_branch text,
  p_child_name text,
  p_child_birth_date date,
  p_parent_name text,
  p_parent_phone text,
  p_source text,
  p_source_note text,
  p_campaign text,
  p_trial_at timestamptz,
  p_next_contact_at timestamptz,
  p_comment text,
  p_responsible_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_branch text := trim(coalesce(p_branch,''));
  v_phone text := private.crm_normalize_phone(p_parent_phone);
  v_actor uuid := private.crm_actor_profile_id();
  v_lead public.crm_leads%rowtype;
  v_duplicate uuid;
begin
  if auth.uid() is null or v_role is null or v_role not in ('owner','project_director','manager','sales','admin') then
    raise exception 'not authorized';
  end if;
  if v_role = 'admin' then v_branch := private.current_staff_branch(); end if;
  if v_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  if nullif(trim(coalesce(p_child_name,'')),'') is null then raise exception 'child name required'; end if;
  if nullif(trim(coalesce(p_parent_name,'')),'') is null then raise exception 'parent name required'; end if;
  if v_phone is null then raise exception 'invalid phone'; end if;
  if nullif(trim(coalesce(p_source,'')),'') is null then raise exception 'source required'; end if;
  if p_next_contact_at is null then raise exception 'next contact required'; end if;

  select l.id into v_duplicate
  from public.crm_leads l
  where l.phone_normalized = v_phone
    and private.crm_child_name_key(l.child_name) = private.crm_child_name_key(p_child_name)
    and not l.is_lost
    and l.converted_child_id is null
  order by l.created_at desc
  limit 1;
  if v_duplicate is not null then raise exception 'duplicate phone:%', v_duplicate; end if;

  insert into public.crm_leads (
    branch, child_name, child_birth_date, parent_name, parent_phone, phone_normalized,
    source, source_note, campaign, stage, trial_at, next_contact_at,
    responsible_profile_id, comment, created_by
  ) values (
    v_branch, trim(p_child_name), p_child_birth_date, trim(p_parent_name), trim(p_parent_phone), v_phone,
    trim(p_source), nullif(trim(coalesce(p_source_note,'')),''), nullif(trim(coalesce(p_campaign,'')),''),
    case when p_trial_at is not null then 'trial_booked' else 'new' end,
    p_trial_at, p_next_contact_at, coalesce(p_responsible_profile_id, v_actor),
    nullif(trim(coalesce(p_comment,'')),''), v_actor
  ) returning * into v_lead;

  insert into public.crm_tasks (lead_id, title, due_at, assigned_profile_id, created_by)
  values (v_lead.id, 'Связаться с клиентом', p_next_contact_at, coalesce(p_responsible_profile_id, v_actor), v_actor);

  insert into public.crm_lead_history (lead_id, from_stage, to_stage, changed_by)
  values (v_lead.id, null, v_lead.stage, v_actor);

  return jsonb_build_object('id',v_lead.id,'branch',v_lead.branch,'stage',v_lead.stage,'phoneNormalized',v_lead.phone_normalized);
end;
$$;


revoke all on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) from public,anon;
grant execute on function public.crm_create_lead(text,text,date,text,text,text,text,text,timestamptz,timestamptz,text,uuid) to authenticated;
