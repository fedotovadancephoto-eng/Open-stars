-- A parent-facing action must not alter CRM staff notifications, even for dual-role accounts.
create or replace function public.parent_mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.notifications set is_read=true
  where id=p_notification_id
    and recipient_user_id=(select auth.uid())
    and target in ('news','coins','progress','homework','comments','payments','feedback','push_test');
$$;
