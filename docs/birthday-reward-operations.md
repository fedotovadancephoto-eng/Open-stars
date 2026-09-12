# Birthday Star Coin operations

The birthday programme awards **10 Star Coin once per child per calendar year**, starting on **2026-09-01**. Only children with a birth date and `archived_at is null` are eligible.

## Daily execution

- Job: `open-stars-birthday-rewards`.
- Schedule: `0 1 * * *` in the project's GMT pg_cron timezone, corresponding to **09:00 Asia/Irkutsk**.
- Function: `private.award_due_birthday_rewards()`, SECURITY INVOKER, executed by the postgres-owned cron job. Browser roles and service_role have no EXECUTE grant.
- The job scans birthdays from the start of the current calendar year (never before 2026-09-01) through today. This recovers missed runs and late entry of a birth date.
- Birthday matching uses the exact calendar month and day. No replacement date is introduced for 29 February in non-leap years.
- The coin ledger date is the birthday at 09:00 school time, capped at the current time. `birthday_rewards.created_at` retains the actual processing time for audit.
- Existing coin balance and notification triggers apply. A restored gift creates a notification now for linked parent accounts; it cannot deliver a historical push in the past.

The portal's existing `parent_claim_birthday_reward` remains a fallback on the birthday. Both paths insert into `birthday_rewards` using the same unique `(child_id, reward_year)` constraint. The marker, coin transaction and link are written in one transaction, so a retry or concurrent portal visit does not issue another gift.

## Inspect and recover

Run as an authorized database operator:

```sql
select jobid, jobname, schedule, active, username
from cron.job
where jobname = 'open-stars-birthday-rewards';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'open-stars-birthday-rewards'
)
order by start_time desc
limit 10;

-- Recover missing current-year gifts. Returns the number newly awarded.
-- Safe to repeat: existing annual gifts are preserved.
select private.award_due_birthday_rewards();
```

If a gift is missing, check the pupil's birth date, archive state and `birthday_rewards` row before making a manual correction. Do not delete the annual marker to retry a gift or increment `children.coins` directly. Fix the cause and repeat the function; coin_transactions and the existing balance trigger remain the ledger.

To pause automatic awards without modifying existing balances:
```sql
select cron.alter_job(jobid := (
  select jobid from cron.job where jobname = 'open-stars-birthday-rewards'
), active := false);
```

## Verification

`supabase/tests/birthday_rewards_automation.sql` runs in a transaction and rolls back all fixture data, real catch-up writes and queued notifications. It covers the birthday date, the 1 September start boundary, missing/future birth dates, archived pupils, ledger and balance linkage, an existing portal award, idempotent repeats and function privileges.
