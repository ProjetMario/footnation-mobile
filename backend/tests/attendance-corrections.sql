\ir attendance-record-write.sql
RESET ROLE;
ALTER TABLE club_attendance_sessions ADD COLUMN category text, ADD COLUMN notes text, ADD COLUMN session_type text DEFAULT 'training', ADD COLUMN session_date timestamptz DEFAULT '2026-09-08T18:00:00Z', ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN created_by uuid;
ALTER TABLE club_attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_admin ON club_attendance_sessions USING(club_id=auth.uid());
GRANT UPDATE ON club_attendance_sessions TO authenticated;
\ir ../migrations/20260908031000_native_attendance_corrections.sql
DO $$ BEGIN
 IF has_function_privilege('anon','update_native_attendance_session(uuid,uuid,jsonb,jsonb)','EXECUTE') OR has_function_privilege('anon','delete_native_attendance_record(uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE s uuid:='00000000-0000-0000-0000-000000000010'; c uuid:='00000000-0000-0000-0000-000000000001'; r uuid:='00000000-0000-0000-0000-000000000030'; old jsonb; values jsonb; record_old jsonb; BEGIN
 SELECT to_jsonb(x) INTO old FROM club_attendance_sessions x WHERE id=s;
 old:=jsonb_set(old,'{session_date}','"2026-09-08T18:00:00.000Z"');
 values:=jsonb_build_object('category','U18','notes',repeat('é',3000),'session_type','match','session_date','2026-09-09T16:00:00+02:00');
 PERFORM update_native_attendance_session(s,c,values,old);
 IF NOT EXISTS(SELECT 1 FROM club_attendance_records WHERE id=r) THEN RAISE EXCEPTION 'Records lost on session edit'; END IF;
 BEGIN PERFORM update_native_attendance_session(s,c,values,old); RAISE EXCEPTION 'Stale session'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM update_native_attendance_session(s,c,values,old-'created_by'); RAISE EXCEPTION 'Missing snapshot'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_attendance_session(s,c,values||'{"created_by":null}',old); RAISE EXCEPTION 'Protected field'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT to_jsonb(x)-'created_at' INTO record_old FROM club_attendance_records x WHERE id=r;
 UPDATE club_attendance_records SET status='injured' WHERE id=r;
 BEGIN PERFORM delete_native_attendance_record(r,s,record_old); RAISE EXCEPTION 'Stale delete'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT to_jsonb(x)-'created_at' INTO record_old FROM club_attendance_records x WHERE id=r;
 BEGIN PERFORM delete_native_attendance_record(r,s,record_old-'notes'); RAISE EXCEPTION 'Incomplete delete'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM delete_native_attendance_record(r,s,record_old); RAISE EXCEPTION 'Other admin'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM delete_native_attendance_record(r,s,record_old);
 IF EXISTS(SELECT 1 FROM club_attendance_records WHERE id=r) THEN RAISE EXCEPTION 'Delete failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM club_attendance_sessions WHERE id=s) THEN RAISE EXCEPTION 'Session removed'; END IF;
END $$;
\echo Attendance corrections: session update preserves records, normalized date/Unicode, immutable fields, stale and incomplete update/delete and authorization passed.
