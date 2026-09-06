-- Run after 20260906_crm_lost_reason_validation.sql.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.crm_update_lead(uuid,text,timestamptz,timestamptz,text,boolean,text,uuid)'::regprocedure
  ) into v_definition;

  if position('p_lost_reason is null' in v_definition) = 0
     or position('lost reason required' in v_definition) = 0 then
    raise exception 'explicit lost reason validation is missing';
  end if;
end;
$$;
