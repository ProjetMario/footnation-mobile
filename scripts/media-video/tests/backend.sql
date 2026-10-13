\set ON_ERROR_STOP on
select current_database() like 'video_test_%' and not exists(select 1 from pg_tables where schemaname='public') as disposable \gset
\if :disposable
\else
  \echo 'Refusing a nonempty or non-test database'
  \quit 1
\endif
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema storage;
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select,insert,update,delete on storage.objects to authenticated, service_role;
create policy existing_bucket_access on storage.objects to authenticated using(true) with check(true);
create table public.posts(id uuid primary key default gen_random_uuid(), video_url text, image_url text, created_at timestamptz default now());
create table public.shorts(id uuid primary key default gen_random_uuid(), video_url text not null, thumbnail_url text, created_at timestamptz default now());
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.posts, public.shorts to authenticated, service_role;
\ir ../../../supabase/migrations/20261013060248_video_mobile_optimization.sql

set role authenticated;
insert into storage.objects(bucket_id,name) values('shorts','user/original.mp4');
do $$ begin
  begin insert into storage.objects(bucket_id,name) values('shorts','optimized/forged.mp4'); raise exception 'forged object allowed';
  exception when insufficient_privilege then null; end;
  begin update storage.objects set name='optimized/forged.mp4'; raise exception 'object rename allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.shorts(id,video_url) values('00000000-0000-0000-0000-000000000001','https://example/source1.mp4');
insert into public.posts(id,video_url) values('00000000-0000-0000-0000-000000000002','https://example/post1.mp4');
do $$ begin
  begin
    update public.shorts set optimized_video_url='forged';
    raise exception 'forged derivative was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.posts(video_url,optimized_video_source_url) values('x','forged');
    raise exception 'forged source was allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.video_optimization_jobs; raise exception 'queue readable';
  exception when insufficient_privilege then null; end;
  begin perform public.claim_video_optimization(); raise exception 'claim callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform 1 from public.video_optimization_jobs; raise exception 'queue readable by anon';
  exception when insufficient_privilege then null; end;
  begin perform public.finish_video_optimization(gen_random_uuid(),gen_random_uuid(),'complete'); raise exception 'finish callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
insert into storage.objects(bucket_id,name) values('shorts','optimized/service.mp4');
do $$ declare job jsonb; stale uuid; begin
  if (select count(*) from public.video_optimization_jobs) <> 2 then raise exception 'missing queued posts'; end if;
  job := public.claim_video_optimization();
  stale := (job->>'lease_token')::uuid;
  if public.finish_video_optimization((job->>'id')::uuid, gen_random_uuid(), 'complete', 'wrong') then raise exception 'wrong lease accepted'; end if;
  if not public.finish_video_optimization((job->>'id')::uuid, stale, 'complete', 'optimized', 'poster') then raise exception 'completion failed'; end if;
  if public.finish_video_optimization((job->>'id')::uuid, stale, 'complete', 'duplicate') then raise exception 'duplicate completion accepted'; end if;
  if job->>'table_name' = 'posts' then
    if (select optimized_video_source_url from public.posts where id=(job->>'record_id')::uuid) <> job->>'source_url' then raise exception 'source binding failed'; end if;
  else
    if (select optimized_video_source_url from public.shorts where id=(job->>'record_id')::uuid) <> job->>'source_url' then raise exception 'source binding failed'; end if;
  end if;
end $$;
-- Test an in-flight source replacement and a later completion with the old lease.
select public.claim_video_optimization() as job \gset
reset role;
set role authenticated;
update public.shorts set video_url='https://example/replaced-short.mp4';
do $$ declare changed integer; begin
  update storage.objects set name='new' where name='optimized/service.mp4';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'client modified service derivative'; end if;
  delete from storage.objects where name='optimized/service.mp4';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'client deleted service derivative'; end if;
end $$;
update public.posts set video_url='https://example/replaced-post.mp4';
reset role;
set role service_role;
select public.finish_video_optimization((:'job'::jsonb->>'id')::uuid,(:'job'::jsonb->>'lease_token')::uuid,'complete','stale-video') = false as stale_rejected \gset
\if :stale_rejected
\else
  \quit 1
\endif
do $$ declare job jsonb; begin
  if exists(select 1 from public.shorts where optimized_video_url is not null or optimized_video_source_url is not null)
     or exists(select 1 from public.posts where optimized_video_url is not null or optimized_video_source_url is not null) then raise exception 'source update kept stale derivative'; end if;
  if exists(select 1 from public.video_optimization_jobs where state <> 'queued' or attempts <> 0) then raise exception 'source update did not reset queue'; end if;
  job := public.claim_video_optimization();
  update public.video_optimization_jobs set lease_until=now()-interval '1 second' where id=(job->>'id')::uuid;
  if public.finish_video_optimization((job->>'id')::uuid,(job->>'lease_token')::uuid,'complete','expired') then raise exception 'expired lease accepted'; end if;
  perform public.claim_video_optimization();
  if (select attempts from public.video_optimization_jobs where id=(job->>'id')::uuid) <> 2 then raise exception 'expired lease was not recovered'; end if;
end $$;
reset role;
set role authenticated;
delete from public.posts;
reset role;
do $$ begin
  if exists(select 1 from public.video_optimization_jobs where table_name='posts') then raise exception 'deleted post job survived'; end if;
end $$;
\echo 'Video optimization SQL contract passed'
