-- OPEN STARS · disable bulk monthly charges by group
-- Business rule: every child has an individual monthly price and individual payment timing.
-- Keep the historical function for audit/backward compatibility, but make it non-callable from staff clients.

revoke all on function public.staff_bulk_set_monthly_charge(date,text,text,numeric,date,text) from public, anon, authenticated;
