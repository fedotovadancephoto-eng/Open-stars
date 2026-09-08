create function team_workspace.marketing_student_sources_api(p_branch text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_role text:=private.current_role(); v_branch text:=nullif(btrim(p_branch),''); v_result jsonb;
begin
 if auth.uid() is null or coalesce(v_role,'') not in ('owner','project_director','manager','admin','sales','marketer') then raise exception 'not authorized'; end if;
 if v_role='admin' then
  if v_branch is not null and v_branch is distinct from private.current_staff_branch() then raise exception 'not authorized'; end if;
  v_branch:=private.current_staff_branch();
  if v_branch is null then raise exception 'not authorized'; end if;
 end if;
 if v_branch is not null and not exists(select 1 from public.branches where name=v_branch) then raise exception 'invalid branch'; end if;
 with raw as (
  select c.id,c.branch,coalesce(nullif(btrim(cip.acquisition_source),''),nullif(btrim(l.source),'')) source
  from public.children c left join public.child_internal_profiles cip on cip.child_id=c.id
  left join lateral (select source from public.crm_leads where converted_child_id=c.id order by created_at,id limit 1) l on true
  where c.archived_at is null and (v_branch is null or c.branch=v_branch)
 ), normalized as (
  select id,branch,case lower(coalesce(source,''))
   when '' then 'Не указан'
   when '2гис' then '2ГИС' when '2gis' then '2ГИС' when '2 гис' then '2ГИС'
   when 'сайт' then 'Сайт'
   when 'vk' then 'VK' when 'вк' then 'VK' when 'вконтакте' then 'VK'
   when 'instagram' then 'Instagram' when 'инстаграм' then 'Instagram'
   when 'рекомендация' then 'От друзей / рекомендации' when 'от друзей' then 'От друзей / рекомендации'
   else source end source from raw
 ), catalog as (
  select unnest(array['2ГИС','Сайт','VK','Instagram','От друзей / рекомендации','Яндекс','Старая база','Наружная реклама','Партнёры','Мероприятие','Другое','Не указан']) source
  union select source from normalized
 )
 select jsonb_build_object('total',(select count(*) from normalized),'rows',
  (select jsonb_agg(jsonb_build_object('source',c.source,'count',(select count(*) from normalized n where n.source=c.source)) order by c.source) from catalog c))
 into v_result;
 return v_result;
end $$;
revoke all on function team_workspace.marketing_student_sources_api(text) from public,anon;
grant execute on function team_workspace.marketing_student_sources_api(text) to authenticated;
create function public.marketing_student_sources(p_branch text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select team_workspace.marketing_student_sources_api(p_branch) $$;
revoke all on function public.marketing_student_sources(text) from public,anon;
grant execute on function public.marketing_student_sources(text) to authenticated;
