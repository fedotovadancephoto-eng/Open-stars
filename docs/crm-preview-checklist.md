# OPEN STARS CRM · preview checklist

Preview review before production merge:

- Owner/admin opens CRM from staff menu.
- New lead requires child, parent, phone, source, branch and next contact.
- Duplicate active phone is blocked.
- Admin is limited to staff_branch.
- Lost lead keeps history and closes open follow-up tasks.
- Paid lead can be converted with “Оформить ученика”.
- Student conversion reuses parent/family data and transfers acquisition source.
- Sales uses standalone /admin/crm and has no financial/admin sections.
- Marketer receives aggregate analytics only, no raw lead phones.
- Owner/project director can create Sales/Marketer activation codes.
- Direct authenticated INSERT/UPDATE/DELETE to CRM tables is blocked.
- Anonymous CRM read/execute is blocked.
- CRM FK covering indexes are present.

Production merge only after visual owner review and final production-schema conflict check.
