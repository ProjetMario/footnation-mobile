\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY,linked_club_id uuid);
CREATE TABLE teams(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE team_members(id uuid PRIMARY KEY,team_id uuid,profile_id uuid,is_active boolean,is_primary boolean,status text,left_at timestamptz,updated_at timestamptz);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010');
INSERT INTO teams VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010');
INSERT INTO team_members SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',true,true,'approved',null,'2026-01-01' FROM generate_series(30,31)n;
\ir ../migrations/20260908052000_native_team_leave.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN BEGIN PERFORM leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-01-01'); RAISE EXCEPTION 'Other member leave'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN PERFORM leave_native_team('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000030','2026-01-01'); RAISE EXCEPTION 'Other club'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2025-01-01'); RAISE EXCEPTION 'Stale version'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-01-01');
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM team_members WHERE id='00000000-0000-0000-0000-000000000030' AND (is_active OR is_primary OR status<>'rejected' OR left_at IS NULL OR updated_at<='2026-01-01')) THEN RAISE EXCEPTION 'Incomplete departure'; END IF;
 IF NOT (SELECT is_active FROM team_members WHERE id='00000000-0000-0000-0000-000000000031') OR (SELECT linked_club_id FROM profiles LIMIT 1) IS NULL THEN RAISE EXCEPTION 'Unrelated membership changed'; END IF;
END $$;
CREATE TEMP TABLE departed AS SELECT updated_at,left_at FROM team_members WHERE id='00000000-0000-0000-0000-000000000030';
SET ROLE authenticated;
SELECT leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-01-01');
RESET ROLE;
DO $$ BEGIN IF (SELECT updated_at FROM departed) IS DISTINCT FROM (SELECT updated_at FROM team_members WHERE id='00000000-0000-0000-0000-000000000030') THEN RAISE EXCEPTION 'Retry wrote again'; END IF; END $$;
UPDATE team_members SET is_active=true,status='approved',left_at=null WHERE id='00000000-0000-0000-0000-000000000030';
SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-01-01'); RAISE EXCEPTION 'Reactivation erased by old request'; EXCEPTION WHEN serialization_failure THEN NULL; END; END $$;
SET request.jwt.claim.sub='';
DO $$ BEGIN BEGIN PERFORM leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-01-01'); RAISE EXCEPTION 'Missing auth'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM leave_native_team('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-01-01'); RAISE EXCEPTION 'Anonymous call'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
\echo Team departure ownership, snapshot, retry and reactivation passed.
