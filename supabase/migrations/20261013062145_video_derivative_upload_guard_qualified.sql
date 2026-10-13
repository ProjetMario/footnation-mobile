-- public.shorts also has a source_id column. Fully qualify record lookups and
-- prefix PL/pgSQL variables so production columns cannot shadow guard inputs.
create or replace function video_optimization_private.guard_derivative_upload() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_source_table text; v_source_record_id uuid; v_source_owner uuid; v_owner_after_lock uuid;
begin
  if new.bucket_id not in ('shorts','post-media') or new.name not like 'optimized/mobile-720-v1/%' then return new; end if;
  if new.name !~ '^optimized/mobile-720-v1/(posts|shorts)/[a-f0-9-]{36}/[a-f0-9]{64}/(video[.]mp4|poster[.]jpg)$' then
    raise exception 'Invalid video derivative path' using errcode='22023';
  end if;
  v_source_table:=split_part(new.name,'/',3);
  v_source_record_id:=split_part(new.name,'/',4)::uuid;
  if v_source_table='posts' then
    select p.user_id into v_source_owner from public.posts p where p.id=v_source_record_id;
  else
    select s.user_id into v_source_owner from public.shorts s where s.id=v_source_record_id;
  end if;
  if v_source_owner is null then raise exception 'Video source is unavailable' using errcode='55000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_source_owner::text,610));
  if v_source_table='posts' then
    select p.user_id into v_owner_after_lock from public.posts p where p.id=v_source_record_id;
  else
    select s.user_id into v_owner_after_lock from public.shorts s where s.id=v_source_record_id;
  end if;
  if v_owner_after_lock is distinct from v_source_owner
    or not exists(select 1 from auth.users u where u.id=v_source_owner)
    or exists(select 1 from public.native_account_deletion_jobs j where j.user_id=v_source_owner and j.state in ('working','finalizing')) then
    raise exception 'Account or media operation is in progress' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function video_optimization_private.guard_derivative_upload() from public,anon,authenticated;
