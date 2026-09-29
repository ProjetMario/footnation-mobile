-- The actual historical remote profiles schema has no updated_at column.
DO $$ BEGIN
 IF current_setting('footnation.experience_test_disposable',true) IS DISTINCT FROM '1' OR to_regclass('public.profiles') IS NOT NULL THEN RAISE EXCEPTION 'Fresh disposable database required';END IF;
END $$;
CREATE ROLE anon;CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY,experience_history jsonb,is_suspended boolean,suspended_until timestamptz,is_admin boolean);
CREATE TABLE fff_clubs(id uuid PRIMARY KEY);
CREATE TABLE user_blocks(blocker_id uuid,blocked_id uuid);
CREATE FUNCTION fn_native_profile_visible(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp();RETURN NEW;END $$;
\ir ../../../supabase/migrations/20260506_create_club_experience_members.sql
\ir ../../../supabase/migrations/20260911068000_native_experience_projection.sql
INSERT INTO profiles(id) VALUES('00000000-0000-4000-8000-000000000001');
INSERT INTO fff_clubs VALUES('10000000-0000-4000-8000-000000000001');
SET ROLE authenticated;SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$ DECLARE result jsonb; desired jsonb := '[{"native_experience_id":"20000000-0000-4000-8000-000000000001","club_id":"10000000-0000-4000-8000-000000000001","club":"Exact","ageCategory":"Seniors","level":"Régional","position":"Gardien","startYear":"2020","endYear":""}]'; BEGIN
 result:=public.save_native_experience_history(NULL,desired);
 IF result->'experience_history' IS DISTINCT FROM desired OR result->'updated_at' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'No-timestamp profile save failed';END IF;
 result:=public.save_native_experience_history(NULL,desired);
 IF result->'experience_history' IS DISTINCT FROM desired THEN RAISE EXCEPTION 'No-timestamp replay failed';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM club_experience_members WHERE native_source='profile-history-v1')<>1 THEN RAISE EXCEPTION 'No-timestamp projection missing or duplicated';END IF;
END $$;
