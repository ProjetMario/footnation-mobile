\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,username text,avatar_url text,visible boolean DEFAULT true);
CREATE TABLE messages(id uuid PRIMARY KEY,sender_id uuid,receiver_id uuid,content text,created_at timestamptz,read_at timestamptz,is_blocked boolean);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_messages ON messages FOR SELECT USING(sender_id=auth.uid() OR receiver_id=auth.uid());
CREATE POLICY visible_profiles ON profiles FOR SELECT USING(visible OR id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON profiles,messages TO authenticated;
\ir ../migrations/20260908043000_native_conversation_list.sql
INSERT INTO profiles SELECT lpad(n::text,32,'0')::uuid,'Person '||n,'user'||n,NULL,true FROM generate_series(1,33)n;
INSERT INTO messages SELECT lpad(n::text,32,'0')::uuid,lpad(n::text,32,'0')::uuid,lpad('1',32,'0')::uuid,'hello','2026-01-01'::timestamptz+n*interval '1 minute',NULL,false FROM generate_series(2,33)n;
-- More than 100 messages with one peer must not crowd out the other conversations.
INSERT INTO messages SELECT lpad((100+n)::text,32,'0')::uuid,lpad('1',32,'0')::uuid,lpad('2',32,'0')::uuid,'sent','2026-02-01'::timestamptz+n*interval '1 minute',now(),false FROM generate_series(1,120)n;
INSERT INTO messages VALUES(lpad('999',32,'0')::uuid,lpad('3',32,'0')::uuid,lpad('4',32,'0')::uuid,'foreign','2026-03-01',NULL,false);
UPDATE profiles SET visible=false WHERE id=lpad('3',32,'0')::uuid;
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM get_native_conversations('',0))<>30 OR (SELECT count(*) FROM get_native_conversations('',30))<>2 THEN RAISE EXCEPTION 'Conversation pagination'; END IF;
 IF (SELECT receiver_id FROM get_native_conversations('',0) LIMIT 1)<>lpad('2',32,'0')::uuid THEN RAISE EXCEPTION 'Latest conversation'; END IF;
 IF (SELECT unread_count FROM get_native_conversations('user2',0) WHERE receiver_id=lpad('2',32,'0')::uuid)<>1 THEN RAISE EXCEPTION 'Older incoming unread lost after outgoing message'; END IF;
 IF (SELECT count(*) FROM get_native_conversations('Person 10',0))<>1 THEN RAISE EXCEPTION 'Search beyond loaded messages'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_conversations('%',0)) THEN RAISE EXCEPTION 'Search must be literal'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_conversations('Person 3',0) WHERE sender_id=lpad('3',32,'0')::uuid) THEN RAISE EXCEPTION 'Private name leak'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_conversations('',30) WHERE sender_id=lpad('3',32,'0')::uuid AND sender IS NOT NULL) THEN RAISE EXCEPTION 'Private profile leak'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_conversations('',0) WHERE content='foreign') THEN RAISE EXCEPTION 'Foreign message'; END IF;
 BEGIN PERFORM get_native_conversations('',-1); RAISE EXCEPTION 'Negative offset accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
UPDATE messages SET is_blocked=true WHERE id=lpad('2',32,'0')::uuid;
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT unread_count FROM get_native_conversations('user2',0) WHERE receiver_id=lpad('2',32,'0')::uuid)<>0 THEN RAISE EXCEPTION 'Blocked unread counted'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN IF has_function_privilege('anon','get_native_conversations(text,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execute'; END IF; END $$;
\echo Conversation pagination, complete search, unread counts, RLS and private profile tests passed.
