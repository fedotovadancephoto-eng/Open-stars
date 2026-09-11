create or replace function private.pp_worker(p_action text,p_secret text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c parent_push.config%rowtype; k text; kid uuid; result jsonb; ack_result record; affected integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Worker access required'; end if;
  select * into c from parent_push.config;
  if p_secret is null or encode(extensions.digest(p_secret,'sha256'),'hex')<>c.dispatch_hash then raise exception 'Invalid dispatch authentication'; end if;
  if p_action='keys' then
    if c.private_key_id is not null then select decrypted_secret into k from vault.decrypted_secrets where id=c.private_key_id; end if;
    return jsonb_build_object('publicKey',c.public_key,'privateKey',k);
  end if;
  if p_action='init' then
    select * into c from parent_push.config for update;
    if c.public_key is null then
      if coalesce(p_data->>'publicKey','') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_data->>'privateKey','') !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Invalid VAPID keys'; end if;
      kid:=vault.create_secret(p_data->>'privateKey','open_stars_push_vapid','Parent Web Push private signing key');
      update parent_push.config set public_key=p_data->>'publicKey',private_key_id=kid where singleton;
    end if;
    return '{"ok":true}';
  end if;
  if p_action='claim' then
    if not c.enabled then return '[]'; end if;
    update parent_push.deliveries set state='failed',finished_at=now() where state in ('pending','sending') and (attempts>=6 or created_at<now()-interval '1 day');
    -- Cancel obsolete audiences, deleted/edited lessons, paid debts and expired subscriptions.
    update parent_push.deliveries d set state='cancelled',finished_at=now()
    from parent_push.subscriptions s where s.id=d.subscription_id and d.state in ('pending','sending')
      and (not s.enabled or not private.pp_deliverable(d.notification_id,s.user_id));
    with candidates as (select id from parent_push.deliveries where state in ('pending','sending') and available_at<=now()
      order by available_at,id for update skip locked limit 25), claimed as (
      update parent_push.deliveries d set state='sending',attempts=d.attempts+1,lease=gen_random_uuid(),available_at=now()+interval '2 minutes'
      from candidates j where d.id=j.id returning d.*)
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'lease',d.lease,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_key,
      'notificationId',n.id,'target',n.target,'title',case n.target when 'news' then 'Новая новость' when 'coins' then 'Начислены Star Coin' else n.title end)), '[]') into result
    from claimed d join parent_push.subscriptions s on s.id=d.subscription_id join public.notifications n on n.id=d.notification_id;
    return result;
  end if;
  if p_action='ack' then
    for ack_result in select * from jsonb_to_recordset(p_data->'results') as x(id bigint,lease uuid,status integer) loop
      update parent_push.deliveries set last_status=ack_result.status,
        state=case when ack_result.status between 200 and 299 then 'sent' when ack_result.status in (404,410) or (ack_result.status between 400 and 499 and ack_result.status not in (408,429)) or attempts>=6 then 'failed' else 'pending' end,
        available_at=now()+make_interval(secs=>least(3600,(power(2,attempts)*30)::integer)),
        finished_at=case when ack_result.status between 200 and 299 or ack_result.status in (404,410) then now() else null end
        where id=ack_result.id and lease=ack_result.lease and state='sending';
      get diagnostics affected = row_count;
      if affected>0 and ack_result.status in (404,410) then
        update parent_push.subscriptions s set enabled=false,updated_at=now() from parent_push.deliveries j where j.id=ack_result.id and j.subscription_id=s.id;
      end if;
    end loop;
    return '{"ok":true}';
  end if;
  raise exception 'Unknown worker operation';
end $$;
