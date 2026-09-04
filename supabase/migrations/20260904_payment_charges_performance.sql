-- OPEN STARS · monthly charge performance hardening
-- Cover foreign keys explicitly so branch/profile joins and deletes stay efficient.

create index if not exists monthly_payment_charges_branch_idx
  on public.monthly_payment_charges (branch_id);

create index if not exists monthly_payment_charges_created_by_idx
  on public.monthly_payment_charges (created_by_profile_id);

create index if not exists monthly_payment_charges_updated_by_idx
  on public.monthly_payment_charges (updated_by_profile_id);
