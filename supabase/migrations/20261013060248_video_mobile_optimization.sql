-- Additive: originals stay in video_url. Clients can adopt derivatives gradually.
alter table public.posts
  add column if not exists optimized_video_url text,
  add column if not exists optimized_video_source_url text,
  add column if not exists optimized_thumbnail_url text;
alter table public.shorts
  add column if not exists optimized_video_url text,
  add column if not exists optimized_video_source_url text,
  add column if not exists optimized_thumbnail_url text;

create schema if not exists video_optimization_private;
revoke all on schema video_optimization_private from public, anon, authenticated;

create table public.video_optimization_jobs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name in ('posts', 'shorts')),
  record_id uuid not null,
  source_url text not null,
  source_created_at timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued','processing','complete','failed','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  error_code text,
  result jsonb,
  updated_at timestamptz not null default now(),
  unique (table_name, record_id)
);
alter table public.video_optimization_jobs enable row level security;
revoke all on public.video_optimization_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.video_optimization_jobs to service_role;
create index video_optimization_pending on public.video_optimization_jobs (next_attempt_at, source_created_at desc)
  where state in ('queued', 'processing');

-- INVOKER is intentional: inspect the actual database role before a protected write.
create function video_optimization_private.guard_derivatives() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if (tg_op = 'INSERT' and (new.optimized_video_url is not null or new.optimized_video_source_url is not null or new.optimized_thumbnail_url is not null))
       or (tg_op = 'UPDATE' and (new.optimized_video_url is distinct from old.optimized_video_url
          or new.optimized_video_source_url is distinct from old.optimized_video_source_url
          or new.optimized_thumbnail_url is distinct from old.optimized_thumbnail_url)) then
      raise exception 'Video derivatives are managed by the media worker' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.video_url is distinct from old.video_url then
    new.optimized_video_url := null;
    new.optimized_video_source_url := null;
    new.optimized_thumbnail_url := null;
  end if;
  return new;
end $$;

-- Trigger only. It needs to enqueue after ordinary authenticated publications.
create function video_optimization_private.enqueue() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.video_optimization_jobs where table_name = tg_table_name and record_id = old.id;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.video_url is not distinct from old.video_url then return new; end if;
  if nullif(btrim(new.video_url), '') is null then
    delete from public.video_optimization_jobs where table_name = tg_table_name and record_id = new.id;
    return new;
  end if;
  insert into public.video_optimization_jobs(table_name, record_id, source_url, source_created_at)
    values(tg_table_name, new.id, new.video_url, coalesce(new.created_at, now()))
  on conflict (table_name, record_id) do update set
    source_url = excluded.source_url, source_created_at = excluded.source_created_at,
    state = 'queued', attempts = 0, next_attempt_at = now(), lease_token = null,
    lease_until = null, error_code = null, result = null, updated_at = now();
  return new;
end $$;
revoke all on function video_optimization_private.guard_derivatives() from public, anon, authenticated;
revoke all on function video_optimization_private.enqueue() from public, anon, authenticated;

create trigger posts_guard_video_derivatives before insert or update on public.posts
  for each row execute function video_optimization_private.guard_derivatives();
create trigger shorts_guard_video_derivatives before insert or update on public.shorts
  for each row execute function video_optimization_private.guard_derivatives();
create trigger posts_queue_video_optimization after insert or update of video_url or delete on public.posts
  for each row execute function video_optimization_private.enqueue();
create trigger shorts_queue_video_optimization after insert or update of video_url or delete on public.shorts
  for each row execute function video_optimization_private.enqueue();

-- Service-only RPCs: invoker security plus explicit EXECUTE grants, no user endpoint.
create function public.claim_video_optimization() returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare job public.video_optimization_jobs;
begin
  update public.video_optimization_jobs set state = 'failed', error_code = 'attempts_exhausted',
    lease_token = null, lease_until = null, updated_at = now()
    where state = 'processing' and lease_until < now() and attempts >= 5;
  select * into job from public.video_optimization_jobs
    where attempts < 5 and ((state = 'queued' and next_attempt_at <= now())
      or (state = 'processing' and lease_until < now()))
    order by source_created_at desc, id for update skip locked limit 1;
  if not found then return null; end if;
  update public.video_optimization_jobs set state = 'processing', attempts = attempts + 1,
    lease_token = gen_random_uuid(), lease_until = now() + interval '15 minutes', updated_at = now()
    where id = job.id returning * into job;
  return to_jsonb(job) || jsonb_build_object('needs_thumbnail', case when job.table_name = 'shorts'
    then coalesce((select nullif(btrim(thumbnail_url), '') is null from public.shorts where id = job.record_id), false)
    else coalesce((select nullif(btrim(image_url), '') is null from public.posts where id = job.record_id), false) end);
end $$;

create function public.finish_video_optimization(
  p_job_id uuid, p_lease_token uuid, p_outcome text,
  p_video_url text default null, p_thumbnail_url text default null,
  p_result jsonb default null, p_error_code text default null
) returns boolean
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare job public.video_optimization_jobs; changed integer;
begin
  if p_outcome not in ('complete', 'skipped', 'retry') then
    raise exception 'Invalid media outcome' using errcode = '22023';
  end if;
  -- Source updates lock the source row before their enqueue trigger locks the job.
  -- Follow that order here as well, then recheck the lease under the job lock.
  select * into job from public.video_optimization_jobs where id = p_job_id;
  if not found then return false; end if;
  if job.table_name = 'shorts' then
    perform 1 from public.shorts where id = job.record_id and video_url = job.source_url for update;
  else
    perform 1 from public.posts where id = job.record_id and video_url = job.source_url for update;
  end if;
  if not found then return false; end if;
  select * into job from public.video_optimization_jobs
    where id = p_job_id and state = 'processing' and lease_token = p_lease_token
      and lease_until > now() for update;
  if not found then return false; end if;
  if p_outcome in ('complete', 'skipped') then
    if job.table_name = 'shorts' then
      update public.shorts set optimized_video_url = p_video_url,
        optimized_video_source_url = job.source_url,
        optimized_thumbnail_url = case when nullif(btrim(thumbnail_url), '') is null then p_thumbnail_url else null end
        where id = job.record_id and video_url = job.source_url;
    else
      update public.posts set optimized_video_url = p_video_url,
        optimized_video_source_url = job.source_url,
        optimized_thumbnail_url = case when nullif(btrim(image_url), '') is null then p_thumbnail_url else null end
        where id = job.record_id and video_url = job.source_url;
    end if;
    get diagnostics changed = row_count;
    if changed = 0 then return false; end if;
  end if;
  update public.video_optimization_jobs set
    state = case when p_outcome = 'retry' then case when attempts >= 5 then 'failed' else 'queued' end else p_outcome end,
    next_attempt_at = now() + make_interval(secs => least(3600, 60 * (2 ^ attempts)::integer)),
    lease_token = null, lease_until = null, result = p_result,
    error_code = left(p_error_code, 80), updated_at = now()
    where id = job.id;
  return true;
end $$;
revoke all on function public.claim_video_optimization() from public, anon, authenticated;
revoke all on function public.finish_video_optimization(uuid,uuid,text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_video_optimization() to service_role;
grant execute on function public.finish_video_optimization(uuid,uuid,text,text,text,jsonb,text) to service_role;

-- Existing buckets permit authenticated uploads; reserve generated object names.
-- Restrictive policies combine with those existing policies, service_role bypasses RLS.
create policy video_derivatives_service_insert on storage.objects as restrictive for insert to public
  with check (not (bucket_id in ('shorts','post-media') and name like 'optimized/%'));
create policy video_derivatives_service_update on storage.objects as restrictive for update to public
  using (not (bucket_id in ('shorts','post-media') and name like 'optimized/%'))
  with check (not (bucket_id in ('shorts','post-media') and name like 'optimized/%'));
create policy video_derivatives_service_delete on storage.objects as restrictive for delete to public
  using (not (bucket_id in ('shorts','post-media') and name like 'optimized/%'));

insert into public.video_optimization_jobs(table_name, record_id, source_url, source_created_at)
  select 'posts', id, video_url, created_at from public.posts where nullif(btrim(video_url), '') is not null
  union all
  select 'shorts', id, video_url, created_at from public.shorts where nullif(btrim(video_url), '') is not null
  on conflict (table_name, record_id) do nothing;
