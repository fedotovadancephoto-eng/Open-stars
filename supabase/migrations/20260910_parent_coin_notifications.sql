create or replace function private.notify_parent_coin_credit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.amount <= 0 or new.transaction_type <> 'credit' then return new; end if;
  insert into public.notifications(recipient_user_id,title,body,target,target_id,is_read,dedupe_key)
  select distinct u.auth_user_id, 'Начислены Star Coin',
    concat_ws(' ',c.first_name,c.last_name)||': +'||new.amount::text||' Star Coin. '||coalesce(new.reason,''),
    'coins',c.id,false,'coin:'||new.id::text||':'||u.auth_user_id::text
  from public.children c
  join public.family_members fm on fm.family_id=c.family_id
  join public.users_profile u on u.id=fm.user_id
  where c.id=new.child_id and c.archived_at is null and u.auth_user_id is not null
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  return new;
end $$;
revoke all on function private.notify_parent_coin_credit() from public,anon,authenticated;
create trigger parent_coin_credit_notification after insert on public.coin_transactions
for each row execute function private.notify_parent_coin_credit();
