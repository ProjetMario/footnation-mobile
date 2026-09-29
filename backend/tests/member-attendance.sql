\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY,linked_club_id uuid);
CREATE TABLE teams(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE team_members(id uuid PRIMARY KEY,team_id uuid,profile_id uuid,is_active boolean,status text);
CREATE TABLE club_attendance_sessions(id uuid PRIMARY KEY,club_id uuid,category text,session_type text,session_date timestamptz,notes text,created_by uuid);
ALTER TABLE club_attendance_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON club_attendance_sessions TO authenticated;
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000002',null);
INSERT INTO teams VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010');
INSERT INTO team_members VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002',true,'approved');
INSERT INTO club_attendance_sessions VALUES
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000010','U18','training','2026-01-01','private',null),
('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000010','U18','match','2026-02-01','private',null),
('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000011','U18','training','2026-03-01','other club',null);
\ir ../migrations/20260908051000_native_member_attendance.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE result jsonb; BEGIN
 IF EXISTS(SELECT 1 FROM club_attendance_sessions) THEN RAISE EXCEPTION 'Direct session access opened'; END IF;
 SELECT to_jsonb(r) INTO result FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010',0,1) r;
 IF result->>'id'<>'00000000-0000-0000-0000-000000000042' OR result ? 'notes' OR result ? 'created_by' THEN RAISE EXCEPTION 'Ordering or private fields'; END IF;
 IF (SELECT id FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010',1,1))<>'00000000-0000-0000-0000-000000000041' THEN RAISE EXCEPTION 'Pagination failed'; END IF;
 IF (SELECT count(*) FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010'))<>2 THEN RAISE EXCEPTION 'Club scope'; END IF;
 BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000011'); RAISE EXCEPTION 'Other club accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010',-1); RAISE EXCEPTION 'Negative offset'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010',0,101); RAISE EXCEPTION 'Unbounded limit'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF (SELECT count(*) FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010'))<>2 THEN RAISE EXCEPTION 'Approved member denied'; END IF; END $$;
RESET ROLE; UPDATE team_members SET status='pending'; SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010'); RAISE EXCEPTION 'Pending member accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE; UPDATE team_members SET status='approved',is_active=false; SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010'); RAISE EXCEPTION 'Inactive member accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET request.jwt.claim.sub='';
DO $$ BEGIN BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010'); RAISE EXCEPTION 'Missing session accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM get_native_member_attendance('00000000-0000-0000-0000-000000000010'); RAISE EXCEPTION 'Anonymous execution'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
\echo Member attendance scope, privacy, pagination and access checks passed.
