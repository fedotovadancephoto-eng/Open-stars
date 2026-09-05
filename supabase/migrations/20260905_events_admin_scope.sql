-- OPEN STARS · Events admin branch scope

drop policy if exists events_read on public.events;
create policy events_read on public.events
for select to authenticated
using (
  private.current_role() in ('owner', 'manager', 'project_director')
  or (
    private.current_role() = 'admin'
    and (branch_id is null or private.business_can_access_branch(branch_id))
  )
  or (
    status in ('open', 'completed')
    and private.event_parent_can_see(id)
  )
);
