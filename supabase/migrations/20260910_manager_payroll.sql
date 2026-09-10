CREATE OR REPLACE FUNCTION public.staff_correct_teacher_payroll(p_payout_id uuid, p_week_start date, p_amount numeric, p_payout_date date, p_payment_method text, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_row public.teacher_payroll_payouts%rowtype;
  v_branch_name text;
  v_teacher_name text;
  v_week_start date;
  v_account_id uuid;
  v_description text;
begin
  if v_profile_id is null or auth.uid() is null or coalesce(v_role,'') not in ('owner','manager','admin') then raise exception 'not authorized'; end if;
  if p_week_start is null then raise exception 'week required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_payout_date is null then raise exception 'payout date required'; end if;
  if p_payment_method not in ('cash','bank','card','other') then raise exception 'invalid payment method'; end if;

  select * into v_row
  from public.teacher_payroll_payouts
  where id = p_payout_id and voided_at is null
  for update;
  if not found then raise exception 'payroll not found'; end if;

  select b.name into v_branch_name from public.branches b where b.id = v_row.branch_id;
  if v_role = 'admin' and v_branch_name <> v_staff_branch then raise exception 'not authorized'; end if;

  select coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Педагог')
    into v_teacher_name
  from public.users_profile up
  where up.id = v_row.teacher_profile_id;

  v_week_start := date_trunc('week', p_week_start)::date;
  if exists (
    select 1 from public.teacher_payroll_payouts tp
    where tp.teacher_profile_id = v_row.teacher_profile_id
      and tp.week_start = v_week_start
      and tp.voided_at is null
      and tp.id <> p_payout_id
  ) then raise exception 'payroll already exists'; end if;

  v_account_id := private.payroll_cash_account(v_row.branch_id, p_payment_method);
  if p_payment_method in ('cash','bank','card') and v_account_id is null then
    raise exception 'payroll account not found';
  end if;

  v_description := 'Зарплата педагогу ' || v_teacher_name || ' · неделя с ' || to_char(v_week_start, 'DD.MM.YYYY');
  if nullif(trim(coalesce(p_comment,'')), '') is not null then
    v_description := v_description || ' · ' || trim(p_comment);
  end if;

  update public.teacher_payroll_payouts
  set week_start = v_week_start,
      payout_date = p_payout_date,
      amount = round(p_amount::numeric,2),
      payment_method = p_payment_method,
      comment = nullif(trim(coalesce(p_comment,'')), ''),
      updated_at = now()
  where id = p_payout_id;

  update public.expense_requests
  set amount = round(p_amount::numeric,2),
      expense_date = p_payout_date,
      payment_method = p_payment_method,
      description = v_description,
      updated_at = now()
  where id = v_row.expense_request_id;

  update public.expense_allocations
  set amount = round(p_amount::numeric,2)
  where expense_request_id = v_row.expense_request_id
    and branch_id = v_row.branch_id;

  update public.cashflow_transactions
  set transaction_date = p_payout_date,
      amount = round(p_amount::numeric,2),
      account_id = v_account_id,
      description = v_description
  where id = v_row.cashflow_transaction_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'teacher_payroll', p_payout_id, 'corrected', v_profile_id,
    nullif(trim(coalesce(p_comment,'')), ''),
    jsonb_build_object(
      'old_week_start', v_row.week_start,
      'new_week_start', v_week_start,
      'old_payout_date', v_row.payout_date,
      'new_payout_date', p_payout_date,
      'old_amount', v_row.amount,
      'new_amount', round(p_amount::numeric,2),
      'old_payment_method', v_row.payment_method,
      'new_payment_method', p_payment_method,
      'old_comment', coalesce(v_row.comment,''),
      'new_comment', coalesce(nullif(trim(coalesce(p_comment,'')), ''),'')
    )
  );

  return jsonb_build_object(
    'id', p_payout_id,
    'teacherName', v_teacher_name,
    'branch', v_branch_name,
    'weekStart', v_week_start,
    'payoutDate', p_payout_date,
    'amount', round(p_amount::numeric,2),
    'paymentMethod', p_payment_method
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.staff_payroll_context(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_from date := coalesce(p_from, date_trunc('month', current_date)::date);
  v_to date := coalesce(p_to, current_date);
  v_teachers jsonb := '[]'::jsonb;
  v_payouts jsonb := '[]'::jsonb;
  v_branches jsonb := '[]'::jsonb;
  v_total numeric := 0;
begin
  if auth.uid() is null or coalesce(v_role,'') not in ('owner','manager','admin') then raise exception 'not authorized'; end if;
  if v_to < v_from then raise exception 'invalid period'; end if;
  if v_role = 'admin' and nullif(trim(coalesce(v_staff_branch,'')), '') is null then
    raise exception 'invalid branch';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profileId', up.id,
      'name', coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Педагог'),
      'branch', up.staff_branch
    ) order by up.staff_branch, coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Педагог')
  ), '[]'::jsonb)
  into v_teachers
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where nullif(trim(coalesce(up.staff_branch,'')), '') is not null
    and (v_role in ('owner','manager') or up.staff_branch = v_staff_branch)
    and (
      r.name = 'teacher'
      or exists (
        select 1
        from public.teacher_assignments ta
        where ta.teacher_user_id = up.auth_user_id
          and ta.branch = up.staff_branch
      )
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tp.id,
      'teacherProfileId', tp.teacher_profile_id,
      'teacherName', coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Педагог'),
      'branchId', tp.branch_id,
      'branch', b.name,
      'weekStart', tp.week_start,
      'payoutDate', tp.payout_date,
      'amount', tp.amount,
      'paymentMethod', tp.payment_method,
      'comment', coalesce(tp.comment,''),
      'createdAt', tp.created_at,
      'createdBy', coalesce(nullif(actor.staff_display_name,''), nullif(actor.full_name,''), 'Сотрудник')
    ) order by tp.payout_date desc, tp.created_at desc
  ), '[]'::jsonb), coalesce(sum(tp.amount),0)::numeric
  into v_payouts, v_total
  from public.teacher_payroll_payouts tp
  join public.users_profile up on up.id = tp.teacher_profile_id
  join public.branches b on b.id = tp.branch_id
  join public.users_profile actor on actor.id = tp.created_by_profile_id
  where tp.voided_at is null
    and tp.payout_date between v_from and v_to
    and (v_role in ('owner','manager') or b.name = v_staff_branch);

  if v_role in ('owner','manager') then
    with totals as (
      select b.id, b.name, coalesce(sum(tp.amount),0)::numeric as amount
      from public.branches b
      left join public.teacher_payroll_payouts tp
        on tp.branch_id = b.id
       and tp.voided_at is null
       and tp.payout_date between v_from and v_to
      where b.is_active
      group by b.id, b.name, b.sort_order
      order by b.sort_order, b.name
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'branchId', id, 'branch', name, 'amount', round(amount,2)
    )), '[]'::jsonb)
    into v_branches from totals;
  end if;

  return jsonb_build_object(
    'role', v_role,
    'staffBranch', coalesce(v_staff_branch,''),
    'from', v_from,
    'to', v_to,
    'totalAmount', round(v_total,2),
    'teachers', v_teachers,
    'payouts', v_payouts,
    'branches', v_branches
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.staff_record_teacher_payroll(p_teacher_profile_id uuid, p_week_start date, p_amount numeric, p_payout_date date, p_payment_method text, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_teacher_name text;
  v_teacher_branch text;
  v_branch_id uuid;
  v_week_start date;
  v_category_id uuid;
  v_account_id uuid;
  v_payout_id uuid;
  v_expense_id uuid;
  v_cashflow_id uuid;
  v_description text;
begin
  if v_profile_id is null or auth.uid() is null or coalesce(v_role,'') not in ('owner','manager','admin') then raise exception 'not authorized'; end if;
  if p_teacher_profile_id is null then raise exception 'teacher required'; end if;
  if p_week_start is null then raise exception 'week required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_payout_date is null then raise exception 'payout date required'; end if;
  if p_payment_method not in ('cash','bank','card','other') then raise exception 'invalid payment method'; end if;

  select coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Педагог'), up.staff_branch
    into v_teacher_name, v_teacher_branch
  from public.users_profile up
  join public.roles r on r.id = up.role_id
  where up.id = p_teacher_profile_id
    and (
      r.name = 'teacher'
      or exists (
        select 1
        from public.teacher_assignments ta
        where ta.teacher_user_id = up.auth_user_id
          and ta.branch = up.staff_branch
      )
    );

  if v_teacher_branch is null then raise exception 'invalid teacher'; end if;
  if v_role = 'admin' and v_teacher_branch <> v_staff_branch then raise exception 'not authorized'; end if;

  select b.id into v_branch_id
  from public.branches b
  where b.is_active and b.name = v_teacher_branch;
  if v_branch_id is null then raise exception 'invalid branch'; end if;

  v_week_start := date_trunc('week', p_week_start)::date;
  if exists (
    select 1 from public.teacher_payroll_payouts tp
    where tp.teacher_profile_id = p_teacher_profile_id
      and tp.week_start = v_week_start
      and tp.voided_at is null
  ) then raise exception 'payroll already exists'; end if;

  select ec.id into v_category_id
  from public.expense_categories ec
  where ec.code = 'payroll' and ec.is_active
  limit 1;
  if v_category_id is null then raise exception 'payroll category not found'; end if;

  v_account_id := private.payroll_cash_account(v_branch_id, p_payment_method);
  if p_payment_method in ('cash','bank','card') and v_account_id is null then
    raise exception 'payroll account not found';
  end if;

  insert into public.teacher_payroll_payouts (
    teacher_profile_id, branch_id, week_start, payout_date, amount,
    payment_method, comment, created_by_profile_id
  ) values (
    p_teacher_profile_id, v_branch_id, v_week_start, p_payout_date,
    round(p_amount::numeric,2), p_payment_method,
    nullif(trim(coalesce(p_comment,'')), ''), v_profile_id
  ) returning id into v_payout_id;

  v_description := 'Зарплата педагогу ' || v_teacher_name || ' · неделя с ' || to_char(v_week_start, 'DD.MM.YYYY');
  if nullif(trim(coalesce(p_comment,'')), '') is not null then
    v_description := v_description || ' · ' || trim(p_comment);
  end if;

  insert into public.expense_requests (
    branch_id, category_id, amount, expense_date, description, status,
    requested_by_profile_id, reviewed_by_profile_id, reviewed_at,
    allocation_type, payment_method
  ) values (
    v_branch_id, v_category_id, round(p_amount::numeric,2), p_payout_date,
    v_description, 'approved', v_profile_id, v_profile_id, now(),
    'branch', p_payment_method
  ) returning id into v_expense_id;

  insert into public.expense_allocations (expense_request_id, branch_id, amount)
  values (v_expense_id, v_branch_id, round(p_amount::numeric,2));

  insert into public.cashflow_transactions (
    transaction_date, direction, amount, category_id, branch_id, account_id,
    source_type, source_id, description, created_by_profile_id, approved_by_profile_id
  ) values (
    p_payout_date, 'expense', round(p_amount::numeric,2), v_category_id,
    v_branch_id, v_account_id, 'teacher_payroll', v_payout_id,
    v_description, v_profile_id, v_profile_id
  ) returning id into v_cashflow_id;

  update public.expense_requests
  set cashflow_transaction_id = v_cashflow_id, updated_at = now()
  where id = v_expense_id;

  update public.teacher_payroll_payouts
  set expense_request_id = v_expense_id,
      cashflow_transaction_id = v_cashflow_id,
      updated_at = now()
  where id = v_payout_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'teacher_payroll', v_payout_id, 'paid', v_profile_id,
    nullif(trim(coalesce(p_comment,'')), ''),
    jsonb_build_object(
      'teacher_profile_id', p_teacher_profile_id,
      'teacher_name', v_teacher_name,
      'branch', v_teacher_branch,
      'week_start', v_week_start,
      'payout_date', p_payout_date,
      'amount', round(p_amount::numeric,2),
      'payment_method', p_payment_method,
      'expense_request_id', v_expense_id,
      'cashflow_transaction_id', v_cashflow_id
    )
  );

  return jsonb_build_object(
    'id', v_payout_id,
    'teacherName', v_teacher_name,
    'branch', v_teacher_branch,
    'weekStart', v_week_start,
    'payoutDate', p_payout_date,
    'amount', round(p_amount::numeric,2),
    'paymentMethod', p_payment_method
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.staff_void_teacher_payroll(p_payout_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_staff_branch text := private.current_staff_branch();
  v_row public.teacher_payroll_payouts%rowtype;
  v_branch_name text;
  v_teacher_name text;
begin
  if v_profile_id is null or auth.uid() is null or coalesce(v_role,'') not in ('owner','manager','admin') then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'void reason required'; end if;

  select * into v_row
  from public.teacher_payroll_payouts
  where id = p_payout_id and voided_at is null
  for update;
  if not found then raise exception 'payroll not found'; end if;

  select b.name into v_branch_name from public.branches b where b.id = v_row.branch_id;
  if v_role = 'admin' and v_branch_name <> v_staff_branch then raise exception 'not authorized'; end if;

  select coalesce(nullif(up.staff_display_name,''), nullif(up.full_name,''), 'Педагог')
    into v_teacher_name
  from public.users_profile up
  where up.id = v_row.teacher_profile_id;

  update public.teacher_payroll_payouts
  set voided_at = now(),
      voided_by_profile_id = v_profile_id,
      void_reason = trim(p_reason),
      cashflow_transaction_id = null,
      updated_at = now()
  where id = p_payout_id;

  update public.expense_requests
  set status = 'cancelled',
      review_comment = trim(p_reason),
      cashflow_transaction_id = null,
      updated_at = now()
  where id = v_row.expense_request_id;

  if v_row.cashflow_transaction_id is not null then
    delete from public.cashflow_transactions where id = v_row.cashflow_transaction_id;
  end if;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, comment, metadata
  ) values (
    'teacher_payroll', p_payout_id, 'voided', v_profile_id, trim(p_reason),
    jsonb_build_object(
      'teacher_name', v_teacher_name,
      'branch', v_branch_name,
      'week_start', v_row.week_start,
      'payout_date', v_row.payout_date,
      'amount', v_row.amount,
      'payment_method', v_row.payment_method,
      'cashflow_transaction_id', v_row.cashflow_transaction_id
    )
  );

  return jsonb_build_object(
    'id', p_payout_id,
    'teacherName', v_teacher_name,
    'branch', v_branch_name,
    'voided', true
  );
end;
$function$;
