begin;

do $t$ declare a record; owner_auth uuid; j jsonb; denied boolean; begin
select u.id,u.auth_user_id,u.staff_branch into a from public.users_profile u join public.roles r on r.id=u.role_id where r.name='admin' and u.auth_user_id is not null limit 1;
perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
perform public.save_stream_day(a.staff_branch,'Суббота','[{"time":"11:00","actual":17},{"time":"13:00","actual":22},{"time":"16:00","actual":0}]');
j:=public.team_work('context','{}');
assert (select sum((x->>'missing')::int) from jsonb_array_elements(j->'groups') x where x->>'branch'=a.staff_branch and x->>'day'='Суббота')=27,'17/22/0 has shortage27';
assert (select count(*) from jsonb_array_elements(j->'groups') x where x->>'branch'=a.staff_branch and x->>'day'='Суббота')=3,'one row per time';
perform public.save_stream_day(a.staff_branch,'Воскресенье','[{"time":"11:00","actual":25},{"time":"13:00","actual":null},{"time":"16:00","actual":21}]');
j:=public.team_work('context','{}');
assert exists(select 1 from jsonb_array_elements(j->'groups') x where x->>'branch'=a.staff_branch and x->>'day'='Воскресенье' and x->>'time'='13:00' and x->>'actual' is null and x->>'missing' is null),'unknown not zero';
assert (select sum((x->>'missing')::int) from jsonb_array_elements(j->'groups') x where x->>'branch'=a.staff_branch and x->>'day'='Воскресенье')=1,'overcapacity no negative shortage';
denied:=false;begin perform public.save_stream_day(case when a.staff_branch='НЛО' then 'Октябрьский' else 'НЛО' end,'Суббота','[]');exception when others then denied:=sqlerrm='not authorized';end;assert denied,'branch authorization';
denied:=false;begin perform public.save_stream_day(a.staff_branch,'Суббота','[{"time":"11:00","actual":1},{"time":"11:00","actual":2},{"time":"16:00","actual":3}]');exception when others then denied:=sqlerrm='invalid stream counts';end;assert denied,'duplicate times rejected';
for a in select u.auth_user_id,r.name from public.users_profile u join public.roles r on r.id=u.role_id where r.name in ('sales','marketer') and u.auth_user_id is not null loop
perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true); j:=public.team_work('context','{}');assert jsonb_array_length(j->'groups')>0,'shared reading';
denied:=false;begin perform public.save_stream_day('НЛО','Суббота','[]');exception when others then denied:=sqlerrm='not authorized';end;assert denied,'read only';
end loop;
select u.auth_user_id into owner_auth from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
perform set_config('request.jwt.claim.sub',owner_auth::text,true);
end $t$;
set local role authenticated;
select jsonb_array_length(public.team_work('context','{}')->'groups') as slots_visible;
reset role;

rollback;

