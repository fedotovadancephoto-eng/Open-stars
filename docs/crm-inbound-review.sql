alter table public.crm_inbound_items add column if not exists staff_comment text not null default '' check(length(staff_comment)<=4000);
create or replace function public.crm_review_inbound(
 p_inbound_id uuid, p_action text, p_comment text,
 p_branch text default null, p_child_name text default null,
 p_parent_name text default null, p_parent_phone text default null,
 p_next_contact_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_item public.crm_inbound_items%rowtype;
 v_actor uuid := private.crm_actor_profile_id();
 v_result jsonb;
begin
 if auth.uid() is null or coalesce(private.current_role(),'') not in ('owner','manager','sales') or v_actor is null then raise exception 'not authorized'; end if;
 if p_action is null or p_action not in ('save','archive','restore','convert') then raise exception 'invalid action'; end if;
 if length(coalesce(p_comment,''))>4000 then raise exception 'comment too long'; end if;
 select * into v_item from public.crm_inbound_items where id=p_inbound_id for update;
 if not found then raise exception 'inbound item not found'; end if;
 if v_item.status not in ('new','ignored') then raise exception 'inbound item already processed'; end if;
 if p_action in ('archive','convert') and v_item.status <> 'new' then raise exception 'restore archived item first'; end if;
 if p_action='restore' and v_item.status <> 'ignored' then raise exception 'inbound item is not archived'; end if;
 update public.crm_inbound_items set staff_comment=coalesce(p_comment,''),reviewed_by=v_actor,reviewed_at=now() where id=p_inbound_id;
 if p_action='convert' then
  v_result := public.crm_process_inbound(p_inbound_id,'convert',p_branch,p_child_name,p_parent_name,p_parent_phone,p_next_contact_at);
  if nullif(trim(p_comment),'') is not null then
   update public.crm_leads set comment=concat_ws(E'\n\n',nullif(comment,''),'Комментарий по заявке: ' || p_comment) where id=(v_result->>'lead_id')::uuid;
  end if;
  return v_result;
 end if;
 update public.crm_inbound_items set status=case p_action when 'archive' then 'ignored' when 'restore' then 'new' else status end where id=p_inbound_id returning * into v_item;
 return jsonb_build_object('id',v_item.id,'status',v_item.status);
end $fn$;
revoke all on function public.crm_review_inbound(uuid,text,text,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.crm_review_inbound(uuid,text,text,text,text,text,text,timestamptz) to authenticated;
notify pgrst,'reload schema';