-- OPEN STARS · allow CRM-only staff roles in activation invites
alter table public.staff_invites
  drop constraint if exists staff_invites_role_allowed;

alter table public.staff_invites
  add constraint staff_invites_role_allowed
  check (
    role_name = any (
      array[
        'admin'::text,
        'manager'::text,
        'teacher'::text,
        'project_director'::text,
        'sales'::text,
        'marketer'::text
      ]
    )
  );
