\set ON_ERROR_STOP on
\ir message-insert-integrity.sql
CREATE TABLE connections(id uuid,user_id uuid,connected_user_id uuid,status text);
CREATE TABLE user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE profiles(id uuid PRIMARY KEY,is_admin boolean DEFAULT false);
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY connections_read ON connections FOR SELECT USING(true);
CREATE POLICY block_participants ON user_blocks FOR SELECT USING(blocker_id=auth.uid() OR blocked_id=auth.uid());
CREATE POLICY profiles_read ON profiles FOR SELECT USING(true);
GRANT SELECT ON connections,user_blocks,profiles TO authenticated;
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000003',false),('00000000-0000-0000-0000-000000000004',true);
\ir ../migrations/20260908047000_native_message_send_permission.sql
CREATE FUNCTION try_message(target uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO messages(id,sender_id,receiver_id,content) VALUES(gen_random_uuid(),auth.uid(),target,'Fixture') $$;
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Unconnected allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
INSERT INTO connections VALUES(gen_random_uuid(),'00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','pending');
SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Pending allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE; UPDATE connections SET status='accepted';
SET ROLE authenticated;
SELECT try_message('00000000-0000-0000-0000-000000000003');
SELECT try_message('00000000-0000-0000-0000-000000000004');
RESET ROLE; INSERT INTO user_blocks VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Reverse block allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE; DELETE FROM user_blocks;
INSERT INTO user_blocks VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004');
SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000004'); RAISE EXCEPTION 'Admin bypasses block'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE; DELETE FROM connections;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM try_message('00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Removed relationship allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM messages WHERE receiver_id='00000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'Existing history disappeared'; END IF;
END $$;
RESET ROLE;
\echo Server message permission: accepted connection, admin recipient, mutual blocks and historical reads passed.
