begin;
do $$
declare actor uuid; lead_id uuid; v public.crm_leads%rowtype; converted jsonb; v_child public.children%rowtype;
begin
 select up.auth_user_id into actor from public.users_profile up join public.roles r on r.id=up.role_id
 where r.name='sales' and up.auth_user_id is not null limit 1;
 if actor is null then raise exception 'sales fixture missing'; end if;
 if exists(select 1 from public.crm_leads where phone_normalized='+79990000093')
   or exists(select 1 from public.users_profile where phone_normalized='+79990000093') then raise exception 'fixture phone in use'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 lead_id:=(public.crm_create_lead('НЛО','Тест Планирование',null,'Тест мама','+79990000093','Другое','test',null,null,now(),null,null)->>'id')::uuid;
 perform public.crm_update_lead_with_enrollment(lead_id,'new',null,now(),'test',false,null,null,'2018-05-01','Продвинутый','Воскресенье','11:00');
 select * into v from public.crm_leads where id=lead_id;
 if v.child_birth_date is distinct from date '2018-05-01' or v.planned_group_name is distinct from 'Продвинутый'
   or v.planned_lesson_day is distinct from 'Воскресенье' or v.planned_lesson_time is distinct from time '11:00' then
   raise exception 'enrollment details not saved';
 end if;
 begin
   perform public.crm_update_lead_with_enrollment(lead_id,'bad_stage',null,now(),null,false,null,null,'2019-01-01','Базовый','Суббота','13:00');
   raise exception 'invalid stage accepted';
 exception when raise_exception then if sqlerrm<>'invalid stage' then raise; end if; end;
 if (select child_birth_date from public.crm_leads where id=lead_id)<>date '2018-05-01' then raise exception 'partial save'; end if;
 perform public.crm_update_lead_with_enrollment(lead_id,'paid',null,now(),'test',false,null,null,v.child_birth_date,v.planned_group_name,v.planned_lesson_day,v.planned_lesson_time);
 converted:=public.crm_convert_lead_to_student(lead_id,'Тест','Планирование',v.planned_group_name,v.child_birth_date,v.planned_lesson_day,v.planned_lesson_time::text);
 select * into v_child from public.children where id=(converted->>'childId')::uuid;
 if v_child.birth_date is distinct from v.child_birth_date or v_child.group_name is distinct from v.planned_group_name
   or v_child.lesson_day is distinct from v.planned_lesson_day or v_child.lesson_time::time is distinct from v.planned_lesson_time then
   raise exception 'conversion lost saved choices';
 end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.crm_update_lead_with_enrollment(lead_id,'new',null,now(),null,false,null,null,null,null,null,null);
   raise exception 'anonymous edit allowed';
 exception when raise_exception then if sqlerrm<>'not authorized' then raise; end if; end;
end $$;
rollback;
