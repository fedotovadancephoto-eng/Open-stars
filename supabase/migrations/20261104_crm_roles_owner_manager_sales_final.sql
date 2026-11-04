-- Tighten CRM lead visibility and staff push recipients to the three roles approved by the owner.
-- These policies affect CRM-only notifications; parent learning/payment alerts remain untouched.
alter policy crm_inbound_staff_read on public.crm_inbound_items
using (private.current_role() in ('owner','manager','sales'));

alter policy crm_notifications_restricted_select on public.notifications
using (target not in ('crm_inbound','crm_push_test') or target is null
  or (recipient_user_id=(select auth.uid()) and private.current_role() in ('owner','manager','sales')));

alter policy crm_notifications_restricted_update on public.notifications
using (target not in ('crm_inbound','crm_push_test') or target is null
  or (recipient_user_id=(select auth.uid()) and private.current_role() in ('owner','manager','sales')))
with check (target not in ('crm_inbound','crm_push_test') or target is null
  or (recipient_user_id=(select auth.uid()) and private.current_role() in ('owner','manager','sales')));

delete from public.notifications n where n.target in ('crm_inbound','crm_push_test')
  and not exists (select 1 from public.users_profile u join public.roles r on r.id=u.role_id
    where u.auth_user_id=n.recipient_user_id and r.name in ('owner','manager','sales'));
