-- Only the server-side service role may access T2 API credentials.
-- Never expose tokens through RLS or RPC.
create table if not exists public.crm_telephony_accounts (
  provider text primary key check (provider = 't2'),
  work_phone text not null check (work_phone ~ '^7[0-9]{10}$'),
  access_token text,
  refresh_token text,
  connected_at timestamptz,
  token_updated_at timestamptz,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint crm_t2_tokens_both_or_none check ((access_token is null) = (refresh_token is null))
);
alter table public.crm_telephony_accounts enable row level security;
revoke all on public.crm_telephony_accounts from public, anon, authenticated;
insert into public.crm_telephony_accounts (provider,work_phone)
values ('t2','79025102269')
on conflict (provider) do update set work_phone=excluded.work_phone,updated_at=now();
comment on table public.crm_telephony_accounts is 'Restricted server-side telephony credentials. Never grant to authenticated or anon roles.';
