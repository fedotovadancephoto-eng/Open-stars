-- One manually reported count per branch, weekday and time. No student-count backfill.
create table team_workspace.stream_counts (
 branch text not null,lesson_day text not null,lesson_time text not null,
 actual integer check(actual between 0 and 1000),age_from integer,age_to integer,
 updated_by uuid references public.users_profile(id),updated_at timestamptz,
 primary key(branch,lesson_day,lesson_time),
 check((age_from is null and age_to is null) or (age_from between 0 and 100 and age_to between age_from and 100))
);
create table team_workspace.stream_count_history (
 id uuid primary key default gen_random_uuid(),branch text not null,lesson_day text not null,
 actor_id uuid not null references public.users_profile(id),payload jsonb not null,created_at timestamptz not null default now()
);
alter table team_workspace.stream_counts enable row level security;
alter table team_workspace.stream_count_history enable row level security;
revoke all on team_workspace.stream_counts,team_workspace.stream_count_history from public,anon,authenticated;
insert into team_workspace.stream_counts(branch,lesson_day,lesson_time)
select distinct c.branch,c.lesson_day,t from public.children c cross join unnest(array['11:00','13:00','16:00']) t
where c.archived_at is null and c.branch is not null and c.lesson_day in ('Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье');
create or replace function team_workspace.group_occupancy(p_branch text default null) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('branch',branch,'day',lesson_day,'time',lesson_time,'group','','actual',actual,'target',22,
 'missing',case when actual is null then null else greatest(22-actual,0) end,'ageFrom',age_from,'ageTo',age_to,'updatedAt',updated_at,'manual',true)
 order by branch,array_position(array['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'],lesson_day),lesson_time),'[]')
 from team_workspace.stream_counts where p_branch is null or branch=p_branch
$$;
create function team_workspace.save_stream_day(p_branch text,p_day text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.crm_actor_profile_id(); r text:=private.current_role(); item jsonb; n integer; af integer; at integer; before_rows jsonb;
begin
 if auth.uid() is null or actor is null or coalesce(r,'') not in ('owner','manager','admin') then raise exception 'not authorized'; end if;
 if r='admin' and p_branch is distinct from private.current_staff_branch() then raise exception 'not authorized'; end if;
 if not exists(select 1 from public.branches where name=p_branch and is_active) then raise exception 'invalid branch'; end if;
 if p_day not in ('Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье') or p_day is null then raise exception 'invalid day'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<>3 then raise exception 'invalid stream counts'; end if;
 if (select count(distinct x->>'time') from jsonb_array_elements(p_rows) x where x->>'time' in ('11:00','13:00','16:00'))<>3 then raise exception 'invalid stream counts'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_branch||p_day,0));
 select jsonb_agg(to_jsonb(s)) into before_rows from team_workspace.stream_counts s where branch=p_branch and lesson_day=p_day;
 for item in select * from jsonb_array_elements(p_rows) loop
 n:=nullif(item->>'actual','')::integer;af:=nullif(item->>'ageFrom','')::integer;at:=nullif(item->>'ageTo','')::integer;
 if n<0 or n>1000 or (af is null)<>(at is null) or af<0 or at>100 or af>at then raise exception 'invalid stream counts'; end if;
 insert into team_workspace.stream_counts(branch,lesson_day,lesson_time,actual,age_from,age_to,updated_by,updated_at)
 values(p_branch,p_day,item->>'time',n,af,at,actor,now())
 on conflict(branch,lesson_day,lesson_time) do update set actual=excluded.actual,age_from=excluded.age_from,age_to=excluded.age_to,updated_by=actor,updated_at=now();
 end loop;
 insert into team_workspace.stream_count_history(branch,lesson_day,actor_id,payload) values(p_branch,p_day,actor,jsonb_build_object('before',before_rows,'after',p_rows));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function team_workspace.save_stream_day(text,text,jsonb) from public,anon;
grant execute on function team_workspace.save_stream_day(text,text,jsonb) to authenticated;
create function public.save_stream_day(p_branch text,p_day text,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$select team_workspace.save_stream_day(p_branch,p_day,p_rows)$$;
revoke all on function public.save_stream_day(text,text,jsonb) from public,anon;
grant execute on function public.save_stream_day(text,text,jsonb) to authenticated;
