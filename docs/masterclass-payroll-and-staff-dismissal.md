# Masterclass payments and staff dismissal

## Payroll

In **Зарплата педагогам → Новая выплата**, choose **За неделю** or
**Мастер-класс**. For a masterclass, select the branch and an existing teacher,
or enter the invited teacher's name. Enter the class title, class date, payout
date, amount and payment method. An invited teacher does not need an app account.

Both kinds appear in payroll history and the existing expense/DDS registers.
Masterclass payouts use the same payroll source, expense category, branch
allocation, correction, cancellation and audit lifecycle. They do not consume
the teacher's weekly payroll slot. Existing weekly duplicate protection remains.
Masterclass request IDs protect retries while the form is open; reopening a
form starts a new request, so staff should consult history before re-entering
an uncertain payment. Name/title/date are included in the DDS description.

Only the owner, manager and branch administrator may record payouts. A branch
administrator is limited to their branch. Guest details are snapshots on the
payout; no fake staff profile or login is created.

## Dismissal

The owner can use **Сотрудники → Активные сотрудники → Уволить** and enter a
reason. The profile switches to the non-working `dismissed` role, teaching
assignments are removed, and staff invitations for the same normalized phone
are revoked. Existing tokens immediately lose their staff authorization via
the database role checks; the app's identity lookup rejects this role.

The profile/auth identity, financial attribution and previous operations are
preserved. The audit contains the old role, branch, assignments, actor, time and
reason. The owner can expand **Уволенные** to see the dismissal record. The
action cannot dismiss the owner or be invoked by another employee role. The
workflow changes access; it does not make a final salary payment or create HR
documents. No automated rehire or task reassignment is included.

## Verification

- `supabase/tests/masterclass_payroll.sql`: owner/manager/admin, guest and staff,
  one DDS entry per request, correction/cancellation synchronization, weekly
  coexistence and duplicate protection, branch isolation and parent denial.
- `supabase/tests/staff_dismissal.sql`: owner-only action, active/archive lists,
  role/assignment/invitation revocation, retry and unchanged financial totals.
- Both SQL scripts roll back all their fixtures, including financial rows.
- TypeScript validation; exact-commit Vercel preview before production merge.

Apply the two dated migrations before the frontend release. Existing clients
retain the weekly payroll API. New functions use checked private implementations
with explicit grants and public SECURITY INVOKER wrappers.
