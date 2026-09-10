begin;
do $test$ declare cid uuid; tx uuid; expected integer; actual integer; begin
select c.id into cid from public.children c where c.archived_at is null and exists(select 1 from public.family_members fm join public.users_profile u on u.id=fm.user_id where fm.family_id=c.family_id and u.auth_user_id is not null) limit 1;
assert cid is not null,'test family exists';
select count(distinct u.auth_user_id) into expected from public.children c join public.family_members fm on fm.family_id=c.family_id join public.users_profile u on u.id=fm.user_id where c.id=cid and u.auth_user_id is not null;
insert into public.coin_transactions(child_id,amount,transaction_type,reason,source) values(cid,1,'credit','Notification test','manual') returning id into tx;
select count(*) into actual from public.notifications where dedupe_key like 'coin:'||tx::text||':%';
assert actual=expected,'one notification per family account';
assert not exists(select 1 from public.notifications n where n.dedupe_key like 'coin:'||tx::text||':%' and (n.target<>'coins' or n.target_id<>cid or n.is_read)),'correct unread child destination';
insert into public.coin_transactions(child_id,amount,transaction_type,reason,source) values(cid,-1,'debit','Notification test reversal','manual') returning id into tx;
assert not exists(select 1 from public.notifications where dedupe_key like 'coin:'||tx::text||':%'),'debit does not notify';
end $test$;
rollback;
