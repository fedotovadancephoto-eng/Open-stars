-- A manager has global school access. Do not require a single branch when issuing an invitation.
-- Admin and teacher invitations remain limited to a concrete branch.
do $migration$
declare
  v_def text;
  v_old text := 'if v_role in (''manager'',''admin'',''teacher'') then';
  v_new text := 'if v_role in (''admin'',''teacher'') then';
begin
  select pg_get_functiondef('public.staff_create_staff_invite(text,text,text,text,text,integer)'::regprocedure) into v_def;
  if v_def is null or position(v_old in v_def)=0 then
    raise exception 'Unexpected staff invite function; migration not applied';
  end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;