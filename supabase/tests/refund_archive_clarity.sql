-- Run after 20260906_refund_archive_clarity.sql.

do $$
declare
  v_definition text;
begin
  if has_function_privilege(
    'anon',
    'public.staff_list_students_for_archive_v2()',
    'EXECUTE'
  ) then
    raise exception 'anon must not list students and their payment amounts';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.staff_list_students_for_archive_v2()',
    'EXECUTE'
  ) then
    raise exception 'authenticated staff must execute archive preview';
  end if;

  select pg_get_functiondef(
    'public.staff_list_students_for_archive_v2()'::regprocedure
  ) into v_definition;

  if position('pr.voided_at is null' in v_definition) = 0
     or position('pr.refunded_at is null' in v_definition) = 0
     or position('sum(pr.amount)' in v_definition) = 0 then
    raise exception 'archive preview must total only active tuition receipts';
  end if;
end;
$$;
