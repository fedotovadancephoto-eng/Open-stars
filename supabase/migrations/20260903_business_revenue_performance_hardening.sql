-- OPEN STARS BUSINESS · revenue performance hardening

create index if not exists payment_receipts_voided_by_idx
  on public.payment_receipts (voided_by_profile_id)
  where voided_by_profile_id is not null;

create index if not exists branch_student_targets_updated_by_idx
  on public.branch_student_targets (updated_by_profile_id)
  where updated_by_profile_id is not null;
