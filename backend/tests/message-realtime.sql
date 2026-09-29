\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE messages(id uuid PRIMARY KEY,sender_id uuid,receiver_id uuid,content text);
CREATE TABLE unrelated(id int PRIMARY KEY);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_messages ON messages FOR SELECT USING(sender_id=auth.uid() OR receiver_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON messages TO anon,authenticated;
CREATE PUBLICATION supabase_realtime FOR TABLE unrelated;
\ir ../migrations/20260908044000_native_message_realtime.sql
\ir ../migrations/20260908044000_native_message_realtime.sql
INSERT INTO messages VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','fixture');
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime')<>2 THEN RAISE EXCEPTION 'Publication membership'; END IF;
 IF (SELECT relreplident FROM pg_class WHERE oid='messages'::regclass)<>'d' THEN RAISE EXCEPTION 'Replica identity changed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE tablename='messages')<>1 THEN RAISE EXCEPTION 'Policies changed'; END IF;
END $$;
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF (SELECT count(*) FROM messages)<>1 THEN RAISE EXCEPTION 'Sender denied'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN IF (SELECT count(*) FROM messages)<>1 THEN RAISE EXCEPTION 'Receiver denied'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM messages) THEN RAISE EXCEPTION 'Foreign access'; END IF; END $$;
RESET ROLE; SET ROLE anon; SET request.jwt.claim.sub='';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM messages) THEN RAISE EXCEPTION 'Anonymous access'; END IF; END $$;
RESET ROLE;
\echo Realtime publication added idempotently, existing table membership and participant RLS preserved.
