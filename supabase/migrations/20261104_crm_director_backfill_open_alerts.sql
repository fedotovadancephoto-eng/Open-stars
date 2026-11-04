-- Restore an alert to the project director for any still-open inbound request.
-- Only project_director; never parents, owner, administrators or teachers.
insert into public.notifications(recipient_user_id,title,body,target,target_id,dedupe_key,push_context)
select u.auth_user_id,
  case i.source when 'site' then 'Новая заявка с сайта'
    when 'vk' then 'Новое обращение ВКонтакте'
    else 'Новое обращение OPEN STARS' end,
  'Откройте CRM → Входящие обращения',
  'crm_inbound',i.id,
  'crm-inbound:' || i.id::text || ':' || u.auth_user_id::text,
  jsonb_build_object('source',i.source)
from public.crm_inbound_items i
cross join public.users_profile u
join public.roles r on r.id=u.role_id
where i.status='new' and r.name='project_director'
  and u.auth_user_id is not null
on conflict do nothing;
