\set ON_ERROR_STOP on
\ir message-send-permission.sql
ALTER TABLE connections ADD COLUMN created_at timestamptz DEFAULT now();
GRANT INSERT,UPDATE,DELETE ON connections TO authenticated;
CREATE POLICY own_invitation ON connections FOR INSERT WITH CHECK(user_id=auth.uid());
CREATE POLICY participant_update ON connections FOR UPDATE USING(user_id=auth.uid() OR connected_user_id=auth.uid()) WITH CHECK(user_id=auth.uid() OR connected_user_id=auth.uid());
CREATE POLICY participant_delete ON connections FOR DELETE USING(user_id=auth.uid() OR connected_user_id=auth.uid());
\ir ../migrations/20260908048000_native_connection_consent.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN INSERT INTO connections VALUES(gen_random_uuid(),auth.uid(),'00000000-0000-0000-0000-000000000003','accepted',now()); RAISE EXCEPTION 'Direct accepted invitation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO connections VALUES(gen_random_uuid(),auth.uid(),auth.uid(),'pending',now()); RAISE EXCEPTION 'Self invitation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO connections VALUES('00000000-0000-0000-0000-000000000020',auth.uid(),'00000000-0000-0000-0000-000000000003','pending','2099-01-01');
DO $$ BEGIN
 IF (SELECT created_at FROM connections LIMIT 1) IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Invitation timestamp'; END IF;
 BEGIN UPDATE connections SET status='accepted'; RAISE EXCEPTION 'Sender accepts'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE connections SET status=NULL; RAISE EXCEPTION 'Null transition accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE connections SET connected_user_id=auth.uid(); RAISE EXCEPTION 'Participant changed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Pending invitation grants messaging'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
UPDATE connections SET status='accepted';
UPDATE connections SET status='accepted';
DO $$ BEGIN BEGIN UPDATE connections SET status='pending'; RAISE EXCEPTION 'Accepted reset'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT try_message('00000000-0000-0000-0000-000000000003');
DELETE FROM connections;
INSERT INTO connections VALUES(gen_random_uuid(),auth.uid(),'00000000-0000-0000-0000-000000000003','pending',now());
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
UPDATE connections SET status='rejected';
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Rejected invitation grants messaging'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
\echo Recipient consent, immutable invitation identity, server date and messaging integration passed.
