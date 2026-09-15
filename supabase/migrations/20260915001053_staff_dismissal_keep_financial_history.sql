-- Dismissal revokes the working role without deleting financial attribution.
insert into public.roles(name) values('dismissed') on conflict(name) do nothing;

create function private.dismiss_staff(p_profile_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.business_current_profile_id();
  v_person public.users_profile%rowtype;
  v_role text; v_assignments jsonb; v_at timestamptz:=now();
begin
  if auth.uid() is null or v_actor is null or coalesce(private.current_role(),'')<>'owner' then raise exception 'not authorized'; end if;
  if p_profile_id is null or p_profile_id=v_actor then raise exception 'cannot dismiss yourself'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'dismiss reason required'; end if;
  select * into v_person from public.users_profile where id=p_profile_id for update;
  if not found then raise exception 'staff not found'; end if;
  select name into v_role from public.roles where id=v_person.role_id;
  if v_role='dismissed' then return jsonb_build_object('profileId',p_profile_id,'dismissed',true); end if;
  if coalesce(v_role,'') not in ('project_director','manager','admin','teacher','sales','marketer') then raise exception 'invalid staff role'; end if;
  select coalesce(jsonb_agg(to_jsonb(ta)),'[]') into v_assignments
    from public.teacher_assignments ta where ta.teacher_user_id=v_person.auth_user_id;
  update public.users_profile set role_id=(select id from public.roles where name='dismissed'),staff_branch=null where id=p_profile_id;
  delete from public.teacher_assignments where teacher_user_id=v_person.auth_user_id;
  update public.staff_invites set revoked_at=v_at,updated_at=v_at
    where phone_normalized=v_person.phone_normalized and revoked_at is null;
  insert into public.approval_log(entity_type,entity_id,action,actor_profile_id,comment,metadata)
  values('staff_access',p_profile_id,'dismissed',v_actor,btrim(p_reason),
    jsonb_build_object('role',v_role,'branch',v_person.staff_branch,'assignments',v_assignments,'dismissed_at',v_at));
  return jsonb_build_object('profileId',p_profile_id,'dismissed',true,'dismissedAt',v_at);
end $$;
revoke all on function private.dismiss_staff(uuid,text) from public,anon;
grant execute on function private.dismiss_staff(uuid,text) to authenticated;
create function public.staff_dismiss_staff(p_profile_id uuid,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select private.dismiss_staff(p_profile_id,p_reason) $$;
revoke all on function public.staff_dismiss_staff(uuid,text) from public,anon;
grant execute on function public.staff_dismiss_staff(uuid,text) to authenticated;

create function private.dismissed_staff_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or coalesce(private.current_role(),'')<>'owner' then raise exception 'not authorized'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'profileId',up.id,'fullName',coalesce(nullif(up.staff_display_name,''),up.full_name,'Сотрудник'),
    'roleName',al.metadata->>'role','branch',al.metadata->>'branch','dismissedAt',al.created_at,'reason',al.comment
  ) order by al.created_at desc),'[]') from public.users_profile up join public.roles r on r.id=up.role_id
  left join lateral(select a.created_at,a.metadata,a.comment from public.approval_log a
    where a.entity_type='staff_access' and a.entity_id=up.id and a.action='dismissed'
    order by a.created_at desc limit 1) al on true
  where r.name='dismissed');
end $$;
revoke all on function private.dismissed_staff_directory() from public,anon;
grant execute on function private.dismissed_staff_directory() to authenticated;
create function public.staff_list_dismissed_staff() returns jsonb
language sql security invoker set search_path='' as $$ select private.dismissed_staff_directory() $$;
revoke all on function public.staff_list_dismissed_staff() from public,anon;
grant execute on function public.staff_list_dismissed_staff() to authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_staff_directory()
 RETURNS TABLE(profile_id uuid, full_name text, role_name text, branch text, phone text, auth_user_id uuid, teaching_subjects text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text;
begin
  v_role := private.current_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('owner','project_director') then raise exception 'not authorized'; end if;
  return query
  select up.id,
         coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Сотрудник'),
         r.name,
         up.staff_branch,
         up.phone,
         up.auth_user_id,
         coalesce((
           select array_agg(distinct ta.subject order by ta.subject)
           from public.teacher_assignments ta
           where ta.teacher_user_id = up.auth_user_id
         ), array[]::text[])
  from public.users_profile up
  join public.roles r on r.id=up.role_id
  where r.name in ('owner','project_director','manager','admin','teacher','sales','marketer')
  order by case r.name
             when 'owner' then 1
             when 'project_director' then 2
             when 'manager' then 3
             when 'sales' then 4
             when 'marketer' then 5
             when 'admin' then 6
             else 7
           end,
           coalesce(up.staff_branch,''), coalesce(up.full_name,'');
end
$function$


