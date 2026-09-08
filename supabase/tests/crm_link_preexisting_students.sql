-- Run after the migration; all simulated changes are rolled back.
begin;
do $t$ declare own uuid; lid uuid; cid uuid; result jsonb; denied boolean; before_children bigint; before_payments bigint; begin
 assert (select count(*) from crm_existing.link_audit)=10,'ten links';
 assert not exists(select 1 from crm_existing.link_audit a join public.crm_leads l on l.id=a.lead_id where l.stage is distinct from a.previous_lead->>'stage' or l.converted_child_id is not null or l.linked_existing_child_id<>a.child_id or l.next_contact_at is distinct from (a.previous_lead->>'next_contact_at')::timestamptz or l.comment is distinct from a.previous_lead->>'comment'),'workflow preserved';
 select u.auth_user_id into own from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',own::text,true);
 select lead_id,child_id into lid,cid from crm_existing.link_audit limit 1;
 select count(*) into before_children from public.children;select count(*) into before_payments from public.payments;
 denied:=false;begin perform public.crm_convert_lead_to_student(lid,'','','',null,null,null);exception when others then denied:=sqlerrm='lead must be paid';end;assert denied,'cannot convert before paid';
 update public.crm_leads set stage='paid' where id=lid;
 execute 'set local role authenticated';
 result:=public.crm_convert_lead_to_student(lid,'','','',null,null,null);
 assert (result->>'childId')::uuid=cid and (result->>'reusedExisting')::boolean,'same child reused';
 result:=public.crm_convert_lead_to_student(lid,'','','',null,null,null);
 assert (result->>'alreadyConverted')::boolean,'repeat safe';
 execute 'reset role';
 assert (select count(*) from public.children)=before_children,'no new child';
 assert (select count(*) from public.payments)=before_payments,'no fabricated payment';
end $t$;
rollback;
