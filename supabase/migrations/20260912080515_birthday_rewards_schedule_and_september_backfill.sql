-- pg_cron uses GMT on this project: 01:00 UTC is 09:00 Asia/Irkutsk.
select cron.schedule(
  'open-stars-birthday-rewards',
  '0 1 * * *',
  'select private.award_due_birthday_rewards();'
);

-- Restore missing gifts from the programme start (2026-09-01) through
-- today, then let the same idempotent function handle daily awards.
-- Existing gifts are retained. Notifications follow the normal coin trigger.
select private.award_due_birthday_rewards();
