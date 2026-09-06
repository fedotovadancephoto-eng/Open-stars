-- OPEN STARS · advertising campaigns and end-to-end attribution

create table if not exists public.crm_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text check (branch is null or branch = any (array['Свердловский'::text, 'НЛО'::text, 'Октябрьский'::text])),
  reach bigint not null default 0 check (reach >= 0),
  is_active boolean not null default true,
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(name), '') is not null)
);

create unique index if not exists crm_ad_campaigns_name_unique_idx
  on public.crm_ad_campaigns (lower(trim(name)));

alter table public.crm_ad_campaigns enable row level security;

drop policy if exists crm_ad_campaigns_select_staff on public.crm_ad_campaigns;
create policy crm_ad_campaigns_select_staff on public.crm_ad_campaigns
for select to authenticated
using (private.current_role() in ('owner','project_director','manager','admin','sales','marketer'));

revoke all on public.crm_ad_campaigns from public, anon, authenticated;
grant select on public.crm_ad_campaigns to authenticated;

alter table public.crm_leads
  add column if not exists campaign_id uuid references public.crm_ad_campaigns(id) on delete set null;

alter table public.expense_requests
  add column if not exists crm_campaign_id uuid references public.crm_ad_campaigns(id) on delete set null;

create index if not exists crm_leads_campaign_idx on public.crm_leads(campaign_id);
create index if not exists expense_requests_crm_campaign_idx on public.expense_requests(crm_campaign_id);

create or replace function private.crm_link_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.crm_ad_campaigns%rowtype;
begin
  if new.campaign_id is not null then
    select * into v_campaign from public.crm_ad_campaigns where id = new.campaign_id;
    if v_campaign.id is null then raise exception 'invalid campaign'; end if;
    if v_campaign.branch is not null and v_campaign.branch <> new.branch then raise exception 'campaign branch mismatch'; end if;
    new.campaign := v_campaign.name;
  elsif nullif(trim(coalesce(new.campaign, '')), '') is not null then
    select * into v_campaign
    from public.crm_ad_campaigns
    where lower(trim(name)) = lower(trim(new.campaign))
      and (branch is null or branch = new.branch)
    limit 1;
    if v_campaign.id is not null then
      new.campaign_id := v_campaign.id;
      new.campaign := v_campaign.name;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_leads_link_campaign on public.crm_leads;
create trigger crm_leads_link_campaign
before insert or update of campaign, campaign_id, branch on public.crm_leads
for each row execute function private.crm_link_campaign();

revoke all on function private.crm_link_campaign() from public, anon;

create or replace function public.crm_upsert_ad_campaign(
  p_name text,
  p_reach bigint,
  p_branch text default null,
  p_campaign_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_actor uuid := private.crm_actor_profile_id();
  v_id uuid;
begin
  if v_role not in ('owner','project_director','manager','marketer') then raise exception 'not authorized'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'campaign name required'; end if;
  if coalesce(p_reach, -1) < 0 then raise exception 'invalid campaign reach'; end if;
  if p_branch is not null and p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;

  if p_campaign_id is null then
    insert into public.crm_ad_campaigns (name, branch, reach, created_by)
    values (trim(p_name), p_branch, p_reach, v_actor)
    returning id into v_id;
  else
    update public.crm_ad_campaigns
    set name = trim(p_name), branch = p_branch, reach = p_reach, updated_at = now()
    where id = p_campaign_id
    returning id into v_id;
    if v_id is null then raise exception 'campaign not found'; end if;
    update public.crm_leads set campaign = trim(p_name) where campaign_id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.crm_record_campaign_expense(
  p_campaign_id uuid,
  p_amount numeric,
  p_expense_date date default current_date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
  v_actor uuid := private.crm_actor_profile_id();
  v_campaign public.crm_ad_campaigns%rowtype;
  v_branch_id uuid;
  v_category_id uuid;
  v_expense_id uuid;
  v_cashflow_id uuid;
  v_description text;
begin
  if v_role not in ('owner','project_director','manager','marketer') then raise exception 'not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid campaign budget'; end if;
  if p_expense_date is null then raise exception 'invalid expense date'; end if;
  select * into v_campaign from public.crm_ad_campaigns where id = p_campaign_id and is_active;
  if v_campaign.id is null then raise exception 'invalid campaign'; end if;
  if v_campaign.branch is not null then
    select id into v_branch_id from public.branches where name = v_campaign.branch and is_active limit 1;
    if v_branch_id is null then raise exception 'invalid branch'; end if;
  end if;
  select id into v_category_id from public.expense_categories where code = 'marketing' and is_active limit 1;
  if v_category_id is null then raise exception 'marketing category not found'; end if;
  v_description := 'Реклама · ' || v_campaign.name || case when nullif(trim(coalesce(p_description, '')), '') is null then '' else ' · ' || trim(p_description) end;

  insert into public.expense_requests (
    branch_id, category_id, amount, expense_date, description, status,
    requested_by_profile_id, reviewed_by_profile_id, reviewed_at,
    allocation_type, payment_method, crm_campaign_id
  ) values (
    v_branch_id, v_category_id, round(p_amount, 2), p_expense_date, v_description, 'approved',
    v_actor, v_actor, now(), case when v_branch_id is null then 'common' else 'branch' end, 'bank', p_campaign_id
  ) returning id into v_expense_id;

  insert into public.cashflow_transactions (
    transaction_date, direction, amount, category_id, branch_id, account_id,
    source_type, source_id, description, created_by_profile_id, approved_by_profile_id
  ) values (
    p_expense_date, 'expense', round(p_amount, 2), v_category_id, v_branch_id, null,
    'crm_campaign_expense', v_expense_id, v_description, v_actor, v_actor
  ) returning id into v_cashflow_id;

  update public.expense_requests set cashflow_transaction_id = v_cashflow_id where id = v_expense_id;
  insert into public.approval_log (entity_type, entity_id, action, actor_profile_id, metadata)
  values ('expense_request', v_expense_id, 'crm_campaign_expense_created', v_actor,
    jsonb_build_object('campaign_id', p_campaign_id, 'cashflow_transaction_id', v_cashflow_id));
  return v_expense_id;
end;
$$;

create or replace function public.crm_create_ad_campaign(
  p_name text,
  p_reach bigint,
  p_budget numeric,
  p_branch text default null,
  p_expense_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_budget is null or p_budget < 0 then raise exception 'invalid campaign budget'; end if;
  v_id := public.crm_upsert_ad_campaign(p_name, p_reach, p_branch, null);
  if p_budget > 0 then perform public.crm_record_campaign_expense(v_id, p_budget, p_expense_date, 'Первоначальный рекламный бюджет'); end if;
  return v_id;
end;
$$;

create or replace function public.crm_campaign_catalog(p_branch text default null)
returns table(id uuid, name text, branch text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
begin
  if v_role not in ('owner','project_director','manager','admin','sales','marketer') then raise exception 'not authorized'; end if;
  if v_role = 'admin' then p_branch := private.current_staff_branch(); end if;
  if p_branch is not null and p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;
  return query
  select c.id, c.name, c.branch
  from public.crm_ad_campaigns c
  where c.is_active and (p_branch is null or c.branch is null or c.branch = p_branch)
  order by c.name;
end;
$$;

create or replace function public.crm_marketing_campaign_summary(
  p_from date default (current_date - 30),
  p_to date default current_date,
  p_branch text default null
)
returns table(
  campaign_id uuid,
  campaign_name text,
  campaign_branch text,
  budget numeric,
  reach bigint,
  leads bigint,
  trials bigint,
  paid bigint,
  lost bigint,
  revenue numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
begin
  if v_role not in ('owner','project_director','manager','marketer') then raise exception 'not authorized'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'invalid date range'; end if;
  if p_branch is not null and p_branch not in ('Свердловский','НЛО','Октябрьский') then raise exception 'invalid branch'; end if;

  return query
  with filtered_leads as (
    select l.*
    from public.crm_leads l
    where l.created_at >= p_from::timestamptz
      and l.created_at < (p_to + 1)::timestamptz
      and (p_branch is null or l.branch = p_branch)
  ), receipt_totals as (
    select pr.child_id, sum(pr.amount)::numeric as amount
    from public.payment_receipts pr
    where pr.voided_at is null and pr.refunded_at is null
    group by pr.child_id
  ), campaign_spend as (
    select er.crm_campaign_id, sum(ct.amount)::numeric as amount
    from public.expense_requests er
    join public.cashflow_transactions ct on ct.id = er.cashflow_transaction_id
    left join public.branches b on b.id = er.branch_id
    where er.crm_campaign_id is not null
      and ct.direction = 'expense'
      and ct.transaction_date between p_from and p_to
      and (p_branch is null or b.name = p_branch)
    group by er.crm_campaign_id
  ), campaign_rows as (
    select
      c.id as campaign_id,
      c.name as campaign_name,
      c.branch as campaign_branch,
      coalesce(max(cs.amount), 0)::numeric as budget,
      c.reach,
      count(l.id)::bigint as leads,
      count(l.id) filter (where l.trial_at is not null or l.stage in ('trial_booked','trial_attended','thinking','awaiting_payment','paid','student'))::bigint as trials,
      count(l.id) filter (where l.stage in ('paid','student'))::bigint as paid,
      count(l.id) filter (where l.is_lost)::bigint as lost,
      coalesce(sum(rt.amount), 0)::numeric as revenue
    from public.crm_ad_campaigns c
    left join filtered_leads l on l.campaign_id = c.id
    left join receipt_totals rt on rt.child_id = l.converted_child_id
    left join campaign_spend cs on cs.crm_campaign_id = c.id
    where (p_branch is null or c.branch is null or c.branch = p_branch)
      and (c.created_at < (p_to + 1)::timestamptz or l.id is not null)
    group by c.id, c.name, c.branch, c.reach
  ), unattributed as (
    select
      null::uuid as campaign_id,
      'Без рекламной кампании'::text as campaign_name,
      null::text as campaign_branch,
      0::numeric as budget,
      0::bigint as reach,
      count(l.id)::bigint as leads,
      count(l.id) filter (where l.trial_at is not null or l.stage in ('trial_booked','trial_attended','thinking','awaiting_payment','paid','student'))::bigint as trials,
      count(l.id) filter (where l.stage in ('paid','student'))::bigint as paid,
      count(l.id) filter (where l.is_lost)::bigint as lost,
      coalesce(sum(rt.amount), 0)::numeric as revenue
    from filtered_leads l
    left join receipt_totals rt on rt.child_id = l.converted_child_id
    where l.campaign_id is null
  )
  select * from campaign_rows
  union all
  select * from unattributed where unattributed.leads > 0
  order by campaign_name;
end;
$$;

revoke all on function public.crm_upsert_ad_campaign(text,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.crm_record_campaign_expense(uuid,numeric,date,text) from public, anon, authenticated;
revoke all on function public.crm_create_ad_campaign(text,bigint,numeric,text,date) from public, anon, authenticated;
revoke all on function public.crm_campaign_catalog(text) from public, anon, authenticated;
revoke all on function public.crm_marketing_campaign_summary(date,date,text) from public, anon, authenticated;
grant execute on function public.crm_upsert_ad_campaign(text,bigint,text,uuid) to authenticated;
grant execute on function public.crm_record_campaign_expense(uuid,numeric,date,text) to authenticated;
grant execute on function public.crm_create_ad_campaign(text,bigint,numeric,text,date) to authenticated;
grant execute on function public.crm_campaign_catalog(text) to authenticated;
grant execute on function public.crm_marketing_campaign_summary(date,date,text) to authenticated;
