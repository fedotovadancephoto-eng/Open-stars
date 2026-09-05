-- OPEN STARS · Events security hardening
-- SECURITY DEFINER RPCs must not be callable by signed-out roles.

revoke all on function public.parent_set_event_participation(uuid, uuid, text) from anon, public;
revoke all on function public.staff_set_event_participant_fee(uuid, numeric) from anon, public;
revoke all on function public.staff_confirm_event_payment(uuid, numeric, text, timestamptz, text) from anon, public;
revoke all on function public.owner_add_event_expense(uuid, text, numeric, date, text) from anon, public;
revoke all on function public.owner_event_financial_summary(uuid) from anon, public;

grant execute on function public.parent_set_event_participation(uuid, uuid, text) to authenticated;
grant execute on function public.staff_set_event_participant_fee(uuid, numeric) to authenticated;
grant execute on function public.staff_confirm_event_payment(uuid, numeric, text, timestamptz, text) to authenticated;
grant execute on function public.owner_add_event_expense(uuid, text, numeric, date, text) to authenticated;
grant execute on function public.owner_event_financial_summary(uuid) to authenticated;
