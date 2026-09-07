-- Normalize case before ё/е, and collapse whitespace before trimming.
create or replace function private.crm_child_name_key(p_name text)
returns text language sql immutable strict set search_path = ''
as $$ select replace(lower(btrim(regexp_replace(p_name,'\s+',' ','g'))),'ё','е') $$;
-- An immutable indexed expression changed; refresh existing index keys atomically.
reindex index public.crm_leads_active_child_phone_unique;
