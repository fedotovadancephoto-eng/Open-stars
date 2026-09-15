begin;
do $$
declare v_owner uuid; v_owner_profile uuid; v_target uuid; v_auth uuid; v_role text; v_failed boolean;
v_before jsonb; v_after jsonb; v_result jsonb;
begin
 select up.auth_user_id,up.id into v_owner,v_owner_profile from public.users_profile up join public.roles r on r.id=up.role_id where r.name='owner' limit 1;
 select up.id,up.auth_user_id into v_target,v_auth from public.users_profile up join public.roles r on r.id=up.role_id where r.name='teacher' and up.auth_user_id is not null limit 1;
 if v_owner is null or v_target is null then raise exception 'Owner and teacher fixtures required'; end if;
 select jsonb_build_array((select count(*) from public.teacher_payroll_payouts),(select coalesce(sum(amount),0) from public.teacher_payroll_payouts),
   (select count(*) from public.expense_requests),(select coalesce(sum(amount),0) from public.expense_requests),
   (select count(*) from public.cashflow_transactions),(select coalesce(sum(amount),0) from public.cashflow_transactions)) into v_before;
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 v_failed:=false; begin perform public.staff_dismiss_staff(v_target,'Rollback check'); exception when others then v_failed:=sqlerrm='not authorized'; end;
 if not v_failed then raise exception 'Non-owner dismissal was not denied'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 v_failed:=false; begin perform public.staff_dismiss_staff(v_owner_profile,'Rollback check'); exception when others then v_failed:=sqlerrm='cannot dismiss yourself'; end;
 if not v_failed then raise exception 'Self dismissal was not denied'; end if;
 v_result:=public.staff_dismiss_staff(v_target,'Rollback check');
 if not (v_result->>'dismissed')::boolean then raise exception 'Dismissal failed'; end if;
 if exists(select 1 from public.staff_list_staff_directory() where profile_id=v_target) then raise exception 'Dismissed person remains active'; end if;
 if not exists(select 1 from jsonb_array_elements(public.staff_list_dismissed_staff()) x where x->>'profileId'=v_target::text) then raise exception 'Dismissal missing from archive'; end if;
 perform public.staff_dismiss_staff(v_target,'Retry rollback check');
 execute 'reset role';
 if (select count(*) from public.approval_log where entity_type='staff_access' and entity_id=v_target and action='dismissed')<>1 then raise exception 'Duplicate dismissal audit'; end if;
 if exists(select 1 from public.teacher_assignments where teacher_user_id=v_auth) then raise exception 'Assignments remain accessible'; end if;
 if exists(select 1 from public.staff_invites i join public.users_profile up on up.phone_normalized=i.phone_normalized where up.id=v_target and i.revoked_at is null) then raise exception 'Access invite remains valid'; end if;
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if private.current_role()<>'dismissed' or private.is_staff() or private.staff_has_global_access() then raise exception 'Old token retained staff role'; end if;
 v_failed:=false; begin perform public.staff_payroll_context(current_date,current_date); exception when others then v_failed:=sqlerrm='not authorized'; end;
 if not v_failed then raise exception 'Dismissed token can read payroll'; end if;
 v_failed:=false; begin perform public.staff_list_staff_directory(); exception when others then v_failed:=sqlerrm='not authorized'; end;
 if not v_failed then raise exception 'Dismissed token can read staff directory'; end if;
 execute 'reset role';
 select jsonb_build_array((select count(*) from public.teacher_payroll_payouts),(select coalesce(sum(amount),0) from public.teacher_payroll_payouts),
   (select count(*) from public.expense_requests),(select coalesce(sum(amount),0) from public.expense_requests),
   (select count(*) from public.cashflow_transactions),(select coalesce(sum(amount),0) from public.cashflow_transactions)) into v_after;
 if v_before<>v_after then raise exception 'Dismissal changed financial history'; end if;
end $$;
rollback;
select 'PASS: owner-only dismissal, archive, immediate role revocation, assignment/invite revocation, retry and preserved financial records. All fixtures rolled back.' as result;
