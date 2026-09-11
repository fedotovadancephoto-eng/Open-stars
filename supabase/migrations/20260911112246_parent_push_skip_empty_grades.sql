create or replace function private.pp_academic_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=to_jsonb(new); fp text; tab text; ttl text; begin
  if tg_table_name='grades' and j->>'grade' is null then return new; end if;
  fp:=private.pp_fingerprint(tg_table_name,j);
  if tg_op='UPDATE' and fp=private.pp_fingerprint(tg_table_name,to_jsonb(old)) then return new; end if;
  tab:=case tg_table_name when 'grades' then 'progress' when 'homework' then 'homework'
    when 'homework_teacher_comments' then 'homework' else 'comments' end;
  ttl:=case tg_table_name when 'grades' then 'Новая оценка' when 'homework' then 'Новое домашнее задание' else 'Комментарий педагога' end;
  insert into public.notifications(recipient_user_id,title,body,target,target_id,child_id,dedupe_key,push_context)
  select distinct u.auth_user_id,ttl,'Откройте кабинет, чтобы посмотреть подробности.',tab,new.id,new.child_id,
    'academic:'||tg_table_name||':'||new.id::text||':'||fp||':'||txid_current()::text||':'||u.auth_user_id::text,
    jsonb_build_object('source',tg_table_name,'source_id',new.id,'fingerprint',fp)
  from public.children c join public.family_members f on f.family_id=c.family_id
  join public.users_profile u on u.id=f.user_id
  where c.id=new.child_id and c.archived_at is null and u.auth_user_id is not null
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  return new;
end $$;
