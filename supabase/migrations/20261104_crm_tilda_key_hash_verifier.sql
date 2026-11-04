-- Store only a SHA-256 digest of the Tilda Webhook key.
-- Key material is generated separately and must never be committed.
create table if not exists private.crm_tilda_key_hash (
  id boolean primary key default true check (id),
  sha256 text not null check (length(sha256) = 64),
  updated_at timestamptz not null default now()
);
alter table private.crm_tilda_key_hash enable row level security;
revoke all on private.crm_tilda_key_hash from public, anon, authenticated, service_role;

create or replace function public.crm_verify_tilda_key(p_key text)
returns boolean language sql security definer set search_path = ''
as $$
  select (select auth.role()) = 'service_role'
    and length(coalesce(p_key, '')) = 64
    and coalesce(
      (select sha256 = encode(extensions.digest(p_key, 'sha256'), 'hex')
       from private.crm_tilda_key_hash where id = true),
      false);
$$;
revoke all on function public.crm_verify_tilda_key(text) from public, anon, authenticated;
grant execute on function public.crm_verify_tilda_key(text) to service_role;
