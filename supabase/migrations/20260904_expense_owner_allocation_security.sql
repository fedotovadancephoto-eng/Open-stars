-- OPEN STARS BUSINESS · privacy/security hardening for allocated expenses
-- Preserve existing receipt-file verification and make sensitive expense rows owner-only end to end.

create or replace function private.business_can_access_expense(p_expense_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.expense_requests er
    join public.expense_categories ec on ec.id = er.category_id
    where er.id = p_expense_request_id
      and (
        private.current_role() = 'owner'
        or (
          private.current_role() in ('manager', 'project_director', 'admin')
          and not ec.owner_only
          and private.business_can_access_branch(er.branch_id)
        )
      )
  )
$$;

-- Request rows themselves must not leak salary/credit amount or description.
drop policy if exists expense_requests_staff_read on public.expense_requests;
create policy expense_requests_staff_read on public.expense_requests
for select to authenticated
using (private.business_can_access_expense(id));

-- Attachments inherit the exact same expense visibility.
drop policy if exists expense_attachments_staff_read on public.expense_attachments;
create policy expense_attachments_staff_read on public.expense_attachments
for select to authenticated
using (private.business_can_access_expense(expense_request_id));

create or replace function public.staff_attach_expense_receipt(
  p_expense_request_id uuid,
  p_storage_path text,
  p_file_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_profile_id uuid := private.business_current_profile_id();
  v_role text := private.current_role();
  v_request public.expense_requests%rowtype;
  v_branch_code text;
  v_attachment_id uuid;
begin
  if v_profile_id is null or v_role not in ('owner', 'manager', 'project_director', 'admin') then
    raise exception 'not authorized';
  end if;

  select * into v_request
  from public.expense_requests
  where id = p_expense_request_id;

  if not found or not private.business_can_access_expense(v_request.id) then
    raise exception 'expense request not found';
  end if;

  if v_request.status <> 'submitted'
     and not (v_role = 'owner' and v_request.status = 'approved') then
    raise exception 'expense request is closed';
  end if;

  if v_request.branch_id is null then
    if v_role <> 'owner' then raise exception 'not authorized'; end if;
    v_branch_code := 'common';
  else
    select code into v_branch_code
    from public.branches
    where id = v_request.branch_id;
  end if;

  if p_storage_path is null
     or p_storage_path not like v_branch_code || '/' || p_expense_request_id::text || '/%' then
    raise exception 'invalid receipt path';
  end if;

  -- Do not accept metadata for a file that was never uploaded.
  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'business-expense-receipts'
      and so.name = p_storage_path
  ) then
    raise exception 'receipt file not found';
  end if;

  insert into public.expense_attachments (
    expense_request_id,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    uploaded_by_profile_id
  ) values (
    p_expense_request_id,
    p_storage_path,
    nullif(trim(coalesce(p_file_name, '')), ''),
    nullif(trim(coalesce(p_mime_type, '')), ''),
    p_size_bytes,
    v_profile_id
  )
  returning id into v_attachment_id;

  insert into public.approval_log (
    entity_type, entity_id, action, actor_profile_id, metadata
  ) values (
    'expense_request', p_expense_request_id, 'receipt_attached', v_profile_id,
    jsonb_build_object('attachment_id', v_attachment_id)
  );

  return v_attachment_id;
end;
$$;

revoke all on function public.staff_attach_expense_receipt(uuid,text,text,text,bigint) from public, anon;
grant execute on function public.staff_attach_expense_receipt(uuid,text,text,text,bigint) to authenticated;

-- Receipt read access follows the expense row, including owner-only categories.
drop policy if exists business_expense_receipts_read on storage.objects;
create policy business_expense_receipts_read on storage.objects
for select to authenticated
using (
  bucket_id = 'business-expense-receipts'
  and exists (
    select 1
    from public.expense_requests er
    left join public.branches b on b.id = er.branch_id
    where er.id::text = (storage.foldername(storage.objects.name))[2]
      and (
        (er.branch_id is null and (storage.foldername(storage.objects.name))[1] = 'common')
        or b.code = (storage.foldername(storage.objects.name))[1]
      )
      and private.business_can_access_expense(er.id)
  )
);

-- Upload only into an existing accessible request. Staff can upload while submitted;
-- owner can also attach a receipt to a direct expense that is already approved.
drop policy if exists business_expense_receipts_insert on storage.objects;
create policy business_expense_receipts_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'business-expense-receipts'
  and exists (
    select 1
    from public.expense_requests er
    left join public.branches b on b.id = er.branch_id
    where er.id::text = (storage.foldername(storage.objects.name))[2]
      and (
        (er.branch_id is null and (storage.foldername(storage.objects.name))[1] = 'common')
        or b.code = (storage.foldername(storage.objects.name))[1]
      )
      and private.business_can_access_expense(er.id)
      and (
        er.status = 'submitted'
        or (private.current_role() = 'owner' and er.status = 'approved')
      )
  )
);
