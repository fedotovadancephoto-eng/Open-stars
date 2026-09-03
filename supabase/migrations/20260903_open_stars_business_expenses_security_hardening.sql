-- OPEN STARS BUSINESS · MVP 1 security hardening
-- Закрываем SECURITY DEFINER RPC для anon/PUBLIC и проверяем,
-- что чек реально загружен в Storage и относится к существующей заявке.

revoke execute on function public.staff_submit_expense(uuid, uuid, numeric, date, text) from public, anon;
revoke execute on function public.staff_attach_expense_receipt(uuid, text, text, text, bigint) from public, anon;
revoke execute on function public.owner_approve_expense_request(uuid, uuid, text) from public, anon;
revoke execute on function public.owner_reject_expense_request(uuid, text) from public, anon;
revoke execute on function public.staff_cancel_expense_request(uuid, text) from public, anon;

grant execute on function public.staff_submit_expense(uuid, uuid, numeric, date, text) to authenticated;
grant execute on function public.staff_attach_expense_receipt(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.owner_approve_expense_request(uuid, uuid, text) to authenticated;
grant execute on function public.owner_reject_expense_request(uuid, text) to authenticated;
grant execute on function public.staff_cancel_expense_request(uuid, text) to authenticated;

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

  if not found or not private.business_can_access_branch(v_request.branch_id) then
    raise exception 'expense request not found';
  end if;

  if v_request.status <> 'submitted' then
    raise exception 'expense request is closed';
  end if;

  select code into v_branch_code
  from public.branches
  where id = v_request.branch_id;

  if p_storage_path is null
     or p_storage_path not like v_branch_code || '/' || p_expense_request_id::text || '/%' then
    raise exception 'invalid receipt path';
  end if;

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

-- Загрузка чека возможна только в папку существующего открытого расхода,
-- доступного текущему сотруднику. Это не даёт создавать произвольные файлы
-- в bucket и одновременно сохраняет возможность коллегам одного филиала
-- помочь прикрепить чек к заявке.
drop policy if exists business_expense_receipts_insert on storage.objects;
create policy business_expense_receipts_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'business-expense-receipts'
  and exists (
    select 1
    from public.expense_requests er
    join public.branches b on b.id = er.branch_id
    where er.id::text = (storage.foldername(name))[2]
      and b.code = (storage.foldername(name))[1]
      and er.status = 'submitted'
      and private.business_can_access_branch(er.branch_id)
  )
);
