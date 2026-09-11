create or replace function private.pp_wake()
returns void language plpgsql security definer set search_path='' as $$
declare s text; begin
  if not exists(select 1 from parent_push.config where enabled
    and (last_wake_at is null or last_wake_at < now()-interval '3 seconds')) then return; end if;
  if not exists(select 1 from parent_push.config where public_key is null)
    and not exists(select 1 from parent_push.deliveries where state in ('pending','sending') and available_at<=now()) then return; end if;
  update parent_push.config set last_wake_at=now() where singleton;
  select v.decrypted_secret into s from vault.decrypted_secrets v join parent_push.config c on c.dispatch_key_id=v.id;
  perform net.http_post(
    url:='https://yiwiykbuaggyslfyhlfo.supabase.co/functions/v1/parent-push-worker',
    headers:=jsonb_build_object('Content-Type','application/json','X-Openstars-Push-Key',s),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
exception when others then
  -- Delivery retries via cron; teaching and payment writes must remain available.
  raise log 'Parent push wake deferred, SQLSTATE %',sqlstate;
end $$;
