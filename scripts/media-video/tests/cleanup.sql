\set ON_ERROR_STOP on
select current_database() like 'video_test_%' and not exists(select 1 from pg_tables where schemaname='public') as disposable \gset
\if :disposable
\else
  \echo 'Refusing a nonempty or non-test database'
  \quit 1
\endif
-- Roles may already exist in a shared disposable cluster used by backend.sql.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema storage;
create schema auth;
create table auth.users(id uuid primary key);
create table public.native_account_deletion_jobs(user_id uuid,state text);
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
create table storage.objects(bucket_id text,name text,owner_id text,primary key(bucket_id,name));
grant usage on schema storage,public to service_role,authenticated,anon;
grant all on storage.objects to service_role;
create table public.posts(id uuid primary key,user_id uuid,video_url text,image_url text,created_at timestamptz default now());
create table public.shorts(id uuid primary key,user_id uuid,source_id text,video_url text,thumbnail_url text,created_at timestamptz default now());
create table public.admin_console_media(target_id uuid,bucket text,path text);
grant select,insert,update,delete on public.posts,public.shorts to service_role,authenticated;
\ir ../../../supabase/migrations/20261013060248_video_mobile_optimization.sql
\ir ../../../supabase/migrations/20261013061119_video_derivative_cleanup.sql
\ir ../../../supabase/migrations/20261013062145_video_derivative_upload_guard_qualified.sql
insert into public.posts(id,user_id,video_url) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','https://example/a.mp4');
insert into public.shorts(id,user_id,video_url) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','https://example/b.mp4');
insert into storage.objects values
('post-media','user/original.mp4','11111111-1111-4111-8111-111111111111'),
('post-media','optimized/mobile-720-v1/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/'||repeat('a',64)||'/video.mp4',null),
('post-media','optimized/mobile-720-v1/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/'||repeat('a',64)||'/poster.jpg',null),
('post-media','optimized/mobile-720-v1/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/'||repeat('b',64)||'/poster.jpg',null),
('shorts','optimized/mobile-720-v1/shorts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/'||repeat('b',64)||'/video.mp4',null),
('avatars','admin/target.png',null);
insert into public.admin_console_media values('11111111-1111-4111-8111-111111111111','avatars','admin/target.png');
set role service_role;
do $$ begin
  if (select count(*) from public.account_deletion_objects('11111111-1111-4111-8111-111111111111'))<>5 then raise exception 'account cleanup missed worker files or existing ownership'; end if;
  if exists(select 1 from public.account_deletion_objects('11111111-1111-4111-8111-111111111111') where bucket='shorts') then raise exception 'other account derivative selected'; end if;
end $$;
reset role;
set role authenticated;
delete from public.posts where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ begin
  begin perform 1 from public.video_optimization_cleanup; raise exception 'cleanup queue readable'; exception when insufficient_privilege then null; end;
  begin perform public.claim_video_cleanup(); raise exception 'cleanup claim callable'; exception when insufficient_privilege then null; end;
  begin perform public.enqueue_orphan_video_cleanup('posts',gen_random_uuid(),'shorts',array[]::text[]); raise exception 'orphan RPC callable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ declare job jsonb; begin
  if (select count(*) from public.video_optimization_cleanup)<>3 then raise exception 'deletion missed namespace files'; end if;
  if (select count(*) from public.account_deletion_objects('11111111-1111-4111-8111-111111111111'))<>5 then raise exception 'queued files lost from account cleanup'; end if;
  job:=public.claim_video_cleanup();
  if job is null then raise exception 'nothing claimed'; end if;
  if public.finish_video_cleanup((job->>'id')::uuid,gen_random_uuid(),true) then raise exception 'wrong lease accepted'; end if;
  if not public.finish_video_cleanup((job->>'id')::uuid,(job->>'lease_token')::uuid,false) then raise exception 'retry rejected'; end if;
  if (select state from public.video_optimization_cleanup where id=(job->>'id')::uuid)<>'queued' then raise exception 'retry lost'; end if;
  update public.video_optimization_cleanup set next_attempt_at=now()-interval '1 second';
  job:=public.claim_video_cleanup();
  if not public.finish_video_cleanup((job->>'id')::uuid,(job->>'lease_token')::uuid,true) then raise exception 'ack rejected'; end if;
  if public.finish_video_cleanup((job->>'id')::uuid,(job->>'lease_token')::uuid,true) then raise exception 'stale ack accepted'; end if;
  update public.shorts set optimized_video_url='https://example/storage/v1/object/public/shorts/optimized/mobile-720-v1/shorts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/'||repeat('b',64)||'/video.mp4' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if public.enqueue_orphan_video_cleanup('shorts','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','shorts',array['optimized/mobile-720-v1/shorts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/'||repeat('b',64)||'/video.mp4'])<>0 then raise exception 'live object queued'; end if;
  begin
    perform public.enqueue_orphan_video_cleanup('posts','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','post-media',array['user/original.mp4']);
    raise exception 'original queued for removal';
  exception when invalid_parameter_value then null; end;
  if public.enqueue_orphan_video_cleanup('posts','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','post-media',array['optimized/mobile-720-v1/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/'||repeat('c',64)||'/video.mp4'])<>1 then raise exception 'late upload not queued'; end if;
  if not exists(select 1 from storage.objects where name='user/original.mp4') then raise exception 'SQL deleted physical storage metadata'; end if;
end $$;
-- Source replacement cleans only the old attached derivative. The worker hashes
-- the lease into output paths, and a currently referenced object is never claimed.
delete from public.video_optimization_cleanup;
update public.shorts set video_url='https://example/b-new.mp4' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$ declare job jsonb; original text:='https://example/storage/v1/object/public/shorts/optimized/mobile-720-v1/shorts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/'||repeat('b',64)||'/video.mp4'; begin
  if (select count(*) from public.video_optimization_cleanup)<>1 then raise exception 'replaced source not queued'; end if;
  update public.shorts set optimized_video_url=original where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if public.claim_video_cleanup() is not null then raise exception 'currently referenced object claimed'; end if;
  update public.shorts set optimized_video_url=null where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  job:=public.claim_video_cleanup();
  if job is null then raise exception 'unreferenced object not claimed'; end if;
  begin
    update public.shorts set optimized_video_url=original where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'object reattached during storage cleanup';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.finish_video_cleanup((job->>'id')::uuid,(job->>'lease_token')::uuid,true);
  update public.shorts set optimized_video_url=original where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
end $$;
reset role;
insert into public.native_account_deletion_jobs values('22222222-2222-4222-8222-222222222222','working');
set role service_role;
do $$ begin
  begin
    insert into storage.objects values('shorts','optimized/mobile-720-v1/shorts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/'||repeat('d',64)||'/video.mp4',null);
    raise exception 'worker uploaded during account deletion';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    insert into storage.objects values('post-media','optimized/mobile-720-v1/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/'||repeat('d',64)||'/video.mp4',null);
    raise exception 'worker uploaded after source deletion';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform 1 from public.video_optimization_cleanup; raise exception 'anonymous queue readable'; exception when insufficient_privilege then null; end;
  begin perform public.account_deletion_objects(gen_random_uuid()); raise exception 'anonymous account media readable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'derivative cleanup tests passed' as result;
