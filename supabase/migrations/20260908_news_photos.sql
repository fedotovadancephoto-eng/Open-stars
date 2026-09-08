create schema news_media;
revoke all on schema news_media from public,anon;
grant usage on schema news_media to authenticated;
alter table public.school_news add column photo_paths text[] not null default '{}',add column publish_request uuid;
create unique index school_news_publish_request on public.school_news(publish_request) where publish_request is not null;
alter table public.school_news add constraint news_photo_limit check(cardinality(photo_paths)<=10);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('news-photos','news-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy news_photos_insert on storage.objects for insert to authenticated with check(bucket_id='news-photos' and (storage.foldername(name))[1]=auth.uid()::text and private.current_role() in ('owner','project_director','manager','admin'));
create policy news_photos_read on storage.objects for select to authenticated using(bucket_id='news-photos' and (
 ((storage.foldername(name))[1]=auth.uid()::text and private.current_role() in ('owner','project_director','manager','admin'))
 or exists(select 1 from public.school_news n where storage.objects.name=any(n.photo_paths))
));
-- Only unattached own drafts can be removed through Storage.
create function news_media.unattached(p_path text) returns boolean language sql security definer set search_path='' as $$
 select auth.uid() is not null and split_part(p_path,'/',1)=auth.uid()::text and private.current_role() in ('owner','project_director','manager','admin') and not exists(select 1 from public.school_news where p_path=any(photo_paths))
$$;
revoke all on function news_media.unattached(text) from public,anon;
grant execute on function news_media.unattached(text) to authenticated;
create policy news_photos_delete on storage.objects for delete to authenticated using(bucket_id='news-photos' and news_media.unattached(name));
create function news_media.validate_paths() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.photo_paths is not distinct from old.photo_paths then return new; end if;
 if cardinality(new.photo_paths)=0 then return new; end if;
 if auth.uid() is null or coalesce(private.current_role(),'') not in ('owner','project_director','manager','admin') then raise exception 'not authorized'; end if;
 if exists(select 1 from unnest(new.photo_paths) p where p is null or split_part(p,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='news-photos' and o.name=p)) then raise exception 'invalid news photos'; end if;
 if cardinality(new.photo_paths)<>(select count(distinct p) from unnest(new.photo_paths) p) then raise exception 'invalid news photos'; end if;
 return new;
end $$;
revoke all on function news_media.validate_paths() from public,anon,authenticated;
create trigger validate_news_photo_paths before insert or update of photo_paths on public.school_news for each row execute function news_media.validate_paths();
create function news_media.publish(p_title text,p_body text,p_category text,p_audience_scope text,p_branch text,p_group_name text,p_paths text[],p_request uuid)
returns table(news_id uuid,recipient_count integer) language plpgsql security definer set search_path='' as $$
declare existing public.school_news%rowtype; published record;
begin
 if auth.uid() is null or coalesce(private.current_role(),'') not in ('owner','project_director','manager','admin') then raise exception 'not authorized'; end if;
 if p_request is null then raise exception 'request required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into existing from public.school_news where publish_request=p_request;
 if found then
  if existing.created_by is distinct from auth.uid() then raise exception 'not authorized'; end if;
  return query select existing.id,(select count(*)::integer from public.notifications where target='news' and target_id=existing.id);return;
 end if;
 select * into published from public.staff_publish_news(p_title,p_body,p_category,p_audience_scope,p_branch,p_group_name);
 update public.school_news set photo_paths=coalesce(p_paths,'{}'),publish_request=p_request where id=published.news_id;
 return query select published.news_id::uuid,published.recipient_count::integer;
end $$;
revoke all on function news_media.publish(text,text,text,text,text,text,text[],uuid) from public,anon;
grant execute on function news_media.publish(text,text,text,text,text,text,text[],uuid) to authenticated;
create function public.staff_publish_news_photos(p_title text,p_body text,p_category text,p_audience_scope text,p_branch text,p_group_name text,p_paths text[],p_request uuid)
returns table(news_id uuid,recipient_count integer) language sql security invoker set search_path='' as $$select * from news_media.publish(p_title,p_body,p_category,p_audience_scope,p_branch,p_group_name,p_paths,p_request)$$;
revoke all on function public.staff_publish_news_photos(text,text,text,text,text,text,text[],uuid) from public,anon;
grant execute on function public.staff_publish_news_photos(text,text,text,text,text,text,text[],uuid) to authenticated;
create function public.staff_news_context_photos() returns jsonb language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;
begin
 ctx:=public.staff_news_context();
 return jsonb_set(ctx,'{news}',coalesce((select jsonb_agg(item||jsonb_build_object('photoPaths',coalesce(n.photo_paths,'{}')) order by ord) from jsonb_array_elements(ctx->'news') with ordinality a(item,ord) left join public.school_news n on n.id=(item->>'id')::uuid),'[]'));
end $$;
revoke all on function public.staff_news_context_photos() from public,anon;
grant execute on function public.staff_news_context_photos() to authenticated;
