-- Worker-created derivatives have no end-user Storage owner. Keep their removal
-- service-only; SQL enumerates objects, the Storage API removes physical blobs.
create table public.video_optimization_cleanup (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name in ('posts', 'shorts')),
  record_id uuid not null,
  user_id uuid,
  source_url text,
  bucket text not null check (bucket in ('shorts', 'post-media')),
  path text not null,
  state text not null default 'queued' check (state in ('queued', 'processing')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  unique(bucket, path),
  check (path ~ ('^optimized/mobile-720-v1/' || table_name || '/' || record_id::text || '/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$'))
);
alter table public.video_optimization_cleanup enable row level security;
revoke all on public.video_optimization_cleanup from public, anon, authenticated;
grant select, insert, update, delete on public.video_optimization_cleanup to service_role;
create index video_optimization_cleanup_pending on public.video_optimization_cleanup(next_attempt_at, created_at);
create index video_optimization_cleanup_owner on public.video_optimization_cleanup(user_id) where user_id is not null;

create function video_optimization_private.queue_derivative_cleanup() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_op='UPDATE' and new.video_url is not distinct from old.video_url then return new; end if;
  -- Serializes the snapshot with server-owned uploads and account finalization.
  perform pg_advisory_xact_lock(hashtextextended(old.user_id::text,610));
  insert into public.video_optimization_cleanup(table_name,record_id,user_id,source_url,bucket,path)
    select tg_table_name,old.id,old.user_id,old.video_url,o.bucket_id,o.name
    from storage.objects o
    where o.bucket_id in ('shorts','post-media')
      and o.name ~ ('^optimized/mobile-720-v1/' || tg_table_name || '/' || old.id::text || '/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$')
    on conflict(bucket,path) do nothing;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function video_optimization_private.queue_derivative_cleanup() from public,anon,authenticated;
create trigger posts_queue_derivative_cleanup after update of video_url or delete on public.posts
  for each row execute function video_optimization_private.queue_derivative_cleanup();
create trigger shorts_queue_derivative_cleanup after update of video_url or delete on public.shorts
  for each row execute function video_optimization_private.queue_derivative_cleanup();

-- Server uploads have a null Storage owner and bypass the generic owner guard.
-- Resolve the source owner and use the same account-deletion advisory lock.
-- The source cleanup trigger also acquires it before enumerating objects, so an
-- upload already in-flight is either included by DELETE or rejected afterwards.
create function video_optimization_private.guard_derivative_upload() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_table text; source_id uuid; source_owner uuid; owner_after_lock uuid;
begin
  if new.bucket_id not in ('shorts','post-media') or new.name not like 'optimized/mobile-720-v1/%' then return new; end if;
  if new.name !~ '^optimized/mobile-720-v1/(posts|shorts)/[a-f0-9-]{36}/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$' then
    raise exception 'Invalid video derivative path' using errcode='22023';
  end if;
  source_table:=split_part(new.name,'/',3);
  source_id:=split_part(new.name,'/',4)::uuid;
  if source_table='posts' then select user_id into source_owner from public.posts where id=source_id;
  else select user_id into source_owner from public.shorts where id=source_id; end if;
  if source_owner is null then raise exception 'Video source is unavailable' using errcode='55000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(source_owner::text,610));
  if source_table='posts' then select user_id into owner_after_lock from public.posts where id=source_id;
  else select user_id into owner_after_lock from public.shorts where id=source_id; end if;
  if owner_after_lock is distinct from source_owner
    or not exists(select 1 from auth.users where id=source_owner)
    or exists(select 1 from public.native_account_deletion_jobs where user_id=source_owner and state in ('working','finalizing')) then
    raise exception 'Account or media operation is in progress' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function video_optimization_private.guard_derivative_upload() from public,anon,authenticated;
create trigger video_derivative_upload_guard before insert on storage.objects
  for each row execute function video_optimization_private.guard_derivative_upload();

-- A canceled worker may finish uploading after the DELETE trigger ran. It can
-- queue only unreferenced paths in that record's immutable output namespace.
create function public.enqueue_orphan_video_cleanup(p_table_name text,p_record_id uuid,p_bucket text,p_paths text[],p_source_url text default null)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item text; added integer;
begin
  if p_table_name is null or p_bucket is null or p_table_name not in ('posts','shorts') or p_bucket not in ('shorts','post-media')
    or p_record_id is null or p_paths is null or cardinality(p_paths) > 100 then
    raise exception 'Invalid derivative cleanup request' using errcode='22023';
  end if;
  foreach item in array p_paths loop
    if item is null or item !~ ('^optimized/mobile-720-v1/' || p_table_name || '/' || p_record_id::text || '/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$') then
      raise exception 'Invalid derivative object path' using errcode='22023';
    end if;
  end loop;
  insert into public.video_optimization_cleanup(table_name,record_id,user_id,source_url,bucket,path)
    select p_table_name,p_record_id,
      case when p_table_name='posts' then (select user_id from public.posts where id=p_record_id)
           else (select user_id from public.shorts where id=p_record_id) end,
      p_source_url,p_bucket,value from unnest(p_paths) value
    where not (p_table_name='posts' and exists(select 1 from public.posts p where p.id=p_record_id and (right(p.optimized_video_url,length(value))=value or right(p.optimized_thumbnail_url,length(value))=value)))
      and not (p_table_name='shorts' and exists(select 1 from public.shorts s where s.id=p_record_id and (right(s.optimized_video_url,length(value))=value or right(s.optimized_thumbnail_url,length(value))=value)))
    on conflict(bucket,path) do nothing;
  get diagnostics added=row_count;
  return added;
end $$;

create function public.claim_video_cleanup() returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.video_optimization_cleanup;
begin
  select c.* into job from public.video_optimization_cleanup c
    where ((c.state='queued' and c.next_attempt_at<=now()) or (c.state='processing' and c.lease_until<now()))
      and not (c.table_name='posts' and exists(select 1 from public.posts p where p.id=c.record_id and (right(p.optimized_video_url,length(c.path))=c.path or right(p.optimized_thumbnail_url,length(c.path))=c.path)))
      and not (c.table_name='shorts' and exists(select 1 from public.shorts s where s.id=c.record_id and (right(s.optimized_video_url,length(c.path))=c.path or right(s.optimized_thumbnail_url,length(c.path))=c.path)))
    order by c.created_at,c.id for update skip locked limit 1;
  if not found then return null; end if;
  update public.video_optimization_cleanup set state='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes'
    where id=job.id returning * into job;
  return to_jsonb(job);
end $$;

create function public.finish_video_cleanup(p_cleanup_id uuid,p_lease_token uuid,p_success boolean) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.video_optimization_cleanup;
begin
  select * into job from public.video_optimization_cleanup where id=p_cleanup_id
    and state='processing' and lease_token=p_lease_token and lease_until>now() for update;
  if not found then return false; end if;
  if p_success then
    delete from public.video_optimization_cleanup where id=job.id;
  else
    update public.video_optimization_cleanup set state='queued',lease_token=null,lease_until=null,
      next_attempt_at=now()+make_interval(secs=>least(3600,60*(2^least(attempts,6))::integer))
      where id=job.id;
  end if;
  return true;
end $$;
revoke all on function public.enqueue_orphan_video_cleanup(text,uuid,text,text[],text),public.claim_video_cleanup(),public.finish_video_cleanup(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_orphan_video_cleanup(text,uuid,text,text[],text),public.claim_video_cleanup(),public.finish_video_cleanup(uuid,uuid,boolean) to service_role;

-- If a source changes A -> B -> A during an in-flight Storage deletion, the
-- final attach waits for cleanup. A retry will upload again after that removal.
create function video_optimization_private.guard_cleanup_publication() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if (new.optimized_video_url is not null or new.optimized_thumbnail_url is not null) and exists(
    select 1 from public.video_optimization_cleanup c where c.table_name=tg_table_name and c.record_id=new.id
      and c.state='processing' and c.lease_until>now()
      and (right(new.optimized_video_url,length(c.path))=c.path or right(new.optimized_thumbnail_url,length(c.path))=c.path)
  ) then raise exception 'Derivative cleanup is in progress' using errcode='55000'; end if;
  return new;
end $$;
revoke all on function video_optimization_private.guard_cleanup_publication() from public,anon,authenticated;
create trigger posts_guard_cleanup_publication before update of optimized_video_url,optimized_thumbnail_url on public.posts
  for each row execute function video_optimization_private.guard_cleanup_publication();
create trigger shorts_guard_cleanup_publication before update of optimized_video_url,optimized_thumbnail_url on public.shorts
  for each row execute function video_optimization_private.guard_cleanup_publication();

-- Account deletion already repeatedly removes batches through Storage's API,
-- and its final Auth-deletion guard rechecks this function before row cascades.
-- Include all derivative generations, including posters not attached to a row.
create or replace function public.account_deletion_objects(p_user uuid)
returns table(bucket text,name text) language sql stable security definer set search_path=pg_catalog,public as $$
  select o.bucket_id,o.name from storage.objects o
  where lower(coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner'))=p_user::text
    or exists(select 1 from public.admin_console_media m where m.target_id=p_user and m.bucket=o.bucket_id and m.path=o.name)
    or (o.bucket_id in ('shorts','post-media') and (
      exists(select 1 from public.posts p where p.user_id=p_user
        and o.name ~ ('^optimized/mobile-720-v1/posts/' || p.id::text || '/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$'))
      or exists(select 1 from public.shorts s where s.user_id=p_user
        and o.name ~ ('^optimized/mobile-720-v1/shorts/' || s.id::text || '/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$'))
      or exists(select 1 from public.video_optimization_cleanup c where c.user_id=p_user and c.bucket=o.bucket_id and c.path=o.name)
    ))
  order by o.bucket_id,o.name limit 200
$$;
revoke all on function public.account_deletion_objects(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_objects(uuid) to service_role;
