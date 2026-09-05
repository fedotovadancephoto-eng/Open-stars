-- OPEN STARS · CRM workflow hardening
-- «Стал учеником» is only reached through conversion; next-contact tasks stay clean.

create or replace function public.crm_update_lead(
  p_lead_id uuid,
  p_stage text,
  p_trial_at timestamptz,
  p_next_contact_at timestamptz,
  p_comment text,
  p_is_lost boolean default false,
  p_lost_reason text default null,
  p_responsible_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_actor uuid := private.crm_actor_profile_id();
  v_old_stage text;
  v_old_is_lost boolean;
  v_old_lost_reason text;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found or not private.crm_can_access_branch(v_lead.branch) then raise exception 'not authorized'; end if;
  if p_stage not in ('new','contacted','trial_booked','trial_attended','thinking','awaiting_payment','paid','student') then raise exception 'invalid stage'; end if;
  if p_stage = 'student' and v_lead.converted_child_id is null then raise exception 'student conversion required'; end if;
  if coalesce(p_is_lost,false) and p_lost_reason not in ('no_answer','not_responding','rescheduled','refusal','other_school','unqualified') then raise exception 'lost reason required'; end if;
  if not coalesce(p_is_lost,false) and p_next_contact_at is null and p_stage <> 'student' then raise exception 'next contact required'; end if;

  v_old_stage := v_lead.stage;
  v_old_is_lost := v_lead.is_lost;
  v_old_lost_reason := v_lead.lost_reason;

  update public.crm_leads set
    stage = p_stage,
    trial_at = p_trial_at,
    next_contact_at = coalesce(p_next_contact_at, next_contact_at),
    comment = nullif(trim(coalesce(p_comment,'')),''),
    is_lost = coalesce(p_is_lost,false),
    lost_reason = case when coalesce(p_is_lost,false) then p_lost_reason else null end,
    responsible_profile_id = coalesce(p_responsible_profile_id, responsible_profile_id),
    updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  if v_old_stage is distinct from v_lead.stage
     or v_old_is_lost is distinct from v_lead.is_lost
     or v_old_lost_reason is distinct from v_lead.lost_reason then
    insert into public.crm_lead_history (lead_id, from_stage, to_stage, is_lost, lost_reason, changed_by)
    values (v_lead.id, v_old_stage, v_lead.stage, v_lead.is_lost, v_lead.lost_reason, v_actor);
  end if;

  if v_lead.is_lost then
    update public.crm_tasks
    set status='cancelled', updated_at=now()
    where lead_id=v_lead.id and status='open';
  elsif v_lead.stage = 'student' then
    update public.crm_tasks
    set status='done', completed_at=coalesce(completed_at,now()), updated_at=now()
    where lead_id=v_lead.id and status='open';
  elsif p_next_contact_at is not null then
    update public.crm_tasks
    set status='cancelled', updated_at=now()
    where lead_id=v_lead.id
      and status='open'
      and title in ('Связаться с клиентом','Следующий контакт')
      and due_at is distinct from p_next_contact_at;

    insert into public.crm_tasks (lead_id, title, due_at, assigned_profile_id, created_by)
    select v_lead.id, 'Следующий контакт', p_next_contact_at, v_lead.responsible_profile_id, v_actor
    where not exists (
      select 1 from public.crm_tasks t
      where t.lead_id=v_lead.id and t.status='open' and t.due_at=p_next_contact_at
    );
  end if;

  return jsonb_build_object('id',v_lead.id,'stage',v_lead.stage,'isLost',v_lead.is_lost,'lostReason',v_lead.lost_reason);
end;
$$;

revoke all on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) from public, anon;
grant execute on function public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid) to authenticated;
