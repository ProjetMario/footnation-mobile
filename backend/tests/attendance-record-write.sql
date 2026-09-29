\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=auth.uid() $$;
CREATE TABLE club_attendance_sessions(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE club_players(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE club_attendance_records(id uuid PRIMARY KEY,session_id uuid REFERENCES club_attendance_sessions,player_id uuid REFERENCES club_players,status text,notes text,created_at timestamptz DEFAULT now(),UNIQUE(session_id,player_id));
CREATE FUNCTION public.is_fff_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=auth.uid() $$;
INSERT INTO club_attendance_sessions VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001');
INSERT INTO club_players VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002');
ALTER TABLE club_attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_records ON club_attendance_records USING(EXISTS(SELECT 1 FROM club_attendance_sessions s WHERE s.id=session_id AND s.club_id=auth.uid()));
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT SELECT ON club_players,club_attendance_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON club_attendance_records TO authenticated;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908030000_native_attendance_record_write.sql
DO $$ BEGIN IF has_function_privilege('anon','save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r uuid:='00000000-0000-0000-0000-000000000030'; s uuid:='00000000-0000-0000-0000-000000000010'; p uuid:='00000000-0000-0000-0000-000000000020'; old jsonb; BEGIN
 PERFORM save_native_attendance_record(r,s,p,'present',NULL);
 PERFORM save_native_attendance_record(r,s,p,'present',NULL);
 IF (SELECT count(*) FROM club_attendance_records)<>1 THEN RAISE EXCEPTION 'Duplicate'; END IF;
 SELECT to_jsonb(x)-'created_at' INTO old FROM club_attendance_records x;
 PERFORM save_native_attendance_record(r,s,p,'late',repeat('é',3000),old);
 PERFORM save_native_attendance_record(r,s,p,'late',repeat('é',3000),old);
 BEGIN PERFORM save_native_attendance_record(r,s,p,'absent',NULL,old); RAISE EXCEPTION 'Stale update'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM save_native_attendance_record(r,s,p,'late',NULL,'{}'); RAISE EXCEPTION 'Incomplete snapshot'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM save_native_attendance_record(r,s,p,'bogus',NULL); RAISE EXCEPTION 'Bad status'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM save_native_attendance_record(r,s,p,'present',repeat('é',3001)); RAISE EXCEPTION 'Oversize notes'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM save_native_attendance_record(r,s,'00000000-0000-0000-0000-000000000021','present',NULL); RAISE EXCEPTION 'Other club player'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN INSERT INTO club_attendance_records VALUES('00000000-0000-0000-0000-000000000031',s,'00000000-0000-0000-0000-000000000021','present',NULL,now()); RAISE EXCEPTION 'Direct cross club insert'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN UPDATE club_attendance_records SET created_at=now()+interval '1 day' WHERE id=r; RAISE EXCEPTION 'Immutable identity'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM save_native_attendance_record(r,s,p,'present',NULL); RAISE EXCEPTION 'Non admin'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
\echo Attendance: creation/retry, edit/retry, conflicts, Unicode, status validation, other-club players, direct insert guard and authorization passed.
