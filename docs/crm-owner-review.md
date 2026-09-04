# Owner review before CRM production merge

1. Open preview `/admin/crm`.
2. Check owner CRM view and mobile layout.
3. Open `Доступы CRM` from owner/admin CRM view.
4. Confirm Sales and Marketer role wording is clear.
5. Do not create real production leads in preview; preview frontend currently points to production Supabase until CRM schema is released, so use preview for visual review only.
6. Production merge and CRM production migrations remain separate explicit release steps.
