begin;

do $t$
declare own uuid; parent_auth uuid; b text; p1 text; p2 text; request uuid:=gen_random_uuid(); nid uuid; again uuid; n integer; denied boolean; ctx jsonb;
begin
select u.auth_user_id into own from public.users_profile u join public.roles r on r.id=u.role_id where r.name='owner' and u.auth_user_id is not null limit 1;
select u.auth_user_id,c.branch into parent_auth,b from public.children c join public.family_members fm on fm.family_id=c.family_id join public.users_profile u on u.id=fm.user_id join public.roles r on r.id=u.role_id where c.archived_at is null and u.auth_user_id is not null and r.name='parent' and c.branch in ('НЛО','Свердловский','Октябрьский') limit 1;
assert parent_auth is not null,'parent fixture';
p1:=own::text||'/'||gen_random_uuid()::text||'.jpg';p2:=own::text||'/'||gen_random_uuid()::text||'.png';
insert into storage.objects(bucket_id,name) values('news-photos',p1),('news-photos',p2);
perform set_config('request.jwt.claim.sub',own::text,true);
select news_id into nid from public.staff_publish_news_photos('Photo regression','Project description','Проект','branch',b,null,array[p1,p2],request);
select news_id into again from public.staff_publish_news_photos('Photo regression','Project description','Проект','branch',b,null,array[p1,p2],request);
assert nid=again,'idempotent publication';
assert (select photo_paths from public.school_news where id=nid)=array[p1,p2],'photo order';
ctx:=public.staff_news_context_photos();
assert exists(select 1 from jsonb_array_elements(ctx->'news') x where x->>'id'=nid::text and jsonb_array_length(x->'photoPaths')=2),'staff photo context';
select count(*) into n from public.school_news;
denied:=false;begin perform public.staff_publish_news_photos('Invalid','Body','Test','branch',b,null,array[parent_auth::text||'/missing.jpg'],gen_random_uuid());exception when others then denied:=sqlerrm='invalid news photos';end;assert denied,'foreign photo blocked';
assert (select count(*) from public.school_news)=n,'failed attachment rolls back news';
perform set_config('request.jwt.claim.sub',parent_auth::text,true);
execute 'set local role authenticated';
assert (select count(*) from storage.objects where bucket_id='news-photos' and name in (p1,p2))=2,'parent can read targeted photos';
denied:=false;begin perform public.staff_publish_news_photos('No','No','No','all_school',null,null,'{}',gen_random_uuid());exception when others then denied:=sqlerrm='not authorized';end;assert denied,'parent cannot publish';
execute 'reset role';
perform set_config('request.jwt.claim.sub',own::text,true);
perform public.staff_set_news_active(nid,false);
perform set_config('request.jwt.claim.sub',parent_auth::text,true);
execute 'set local role authenticated';
assert (select count(*) from storage.objects where bucket_id='news-photos' and name in (p1,p2))=0,'hidden photos denied to parent';
execute 'reset role';
perform set_config('request.jwt.claim.sub',own::text,true);
perform public.staff_delete_news(nid);
assert news_media.unattached(p1),'deleted news draft eligible for storage deletion';
end $t$;

rollback;

