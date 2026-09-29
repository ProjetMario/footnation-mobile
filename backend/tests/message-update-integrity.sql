\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION is_site_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000004'::uuid $$;
CREATE TABLE messages(id uuid PRIMARY KEY,sender_id uuid,receiver_id uuid,content text,created_at timestamptz DEFAULT now(),read_at timestamptz,is_blocked boolean DEFAULT false,blocked_reason text,blocked_at timestamptz,blocked_by uuid);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON messages FOR SELECT USING(sender_id=auth.uid() OR receiver_id=auth.uid());
CREATE POLICY own_update ON messages FOR UPDATE USING(receiver_id=auth.uid()) WITH CHECK(receiver_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT,UPDATE ON messages TO anon,authenticated;
\ir ../migrations/20260908045000_native_message_update_integrity.sql
INSERT INTO messages(id,sender_id,receiver_id,content) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Original');
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
UPDATE messages SET read_at='2099-01-01';
DO $$ BEGIN
 IF (SELECT read_at FROM messages) IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Server read timestamp'; END IF;
 BEGIN UPDATE messages SET content='Forged'; RAISE EXCEPTION 'Content editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE messages SET sender_id=auth.uid(); RAISE EXCEPTION 'Author editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE messages SET created_at='2099-01-01'; RAISE EXCEPTION 'Date editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE messages SET is_blocked=true; RAISE EXCEPTION 'Moderation editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE messages SET read_at='2100-01-01';
DO $$ BEGIN IF (SELECT read_at FROM messages) IS DISTINCT FROM now() THEN RAISE EXCEPTION 'First read changed'; END IF; END $$;
UPDATE messages SET read_at=NULL;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ DECLARE n int; BEGIN UPDATE messages SET read_at=now(); GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Sender can mark read'; END IF; END $$;
RESET ROLE;
-- Preserve privileged server maintenance and existing admin-recipient moderation.
UPDATE messages SET receiver_id='00000000-0000-0000-0000-000000000004';
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
UPDATE messages SET is_blocked=true,blocked_reason='Fixture',blocked_by='00000000-0000-0000-0000-000000000002',blocked_at='2099-01-01';
DO $$ BEGIN IF (SELECT blocked_by FROM messages) IS DISTINCT FROM auth.uid() OR (SELECT blocked_at FROM messages) IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Moderation attribution'; END IF;
 BEGIN UPDATE messages SET content='Admin rewrite'; RAISE EXCEPTION 'Admin rewrites content'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE messages SET is_blocked=false;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM messages WHERE blocked_reason IS NOT NULL OR blocked_by IS NOT NULL OR blocked_at IS NOT NULL) THEN RAISE EXCEPTION 'Unblock cleanup'; END IF; END $$;
RESET ROLE;
\echo Message update boundaries, recipient reads, immutable content and admin moderation passed.
