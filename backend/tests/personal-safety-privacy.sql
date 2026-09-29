\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_site_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE user_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),blocker_id uuid,blocked_id uuid);
CREATE TABLE user_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid,reported_id uuid,reason text,details text);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT,INSERT,DELETE ON user_blocks,user_reports TO anon,authenticated;
CREATE POLICY "Public read access" ON user_blocks FOR SELECT USING(true);
CREATE POLICY "Users can view their own blocks" ON user_blocks FOR SELECT USING(blocker_id=auth.uid());
CREATE POLICY "Users can create their own blocks" ON user_blocks FOR INSERT WITH CHECK(blocker_id=auth.uid());
CREATE POLICY "Users can delete their own blocks" ON user_blocks FOR DELETE USING(blocker_id=auth.uid());
CREATE POLICY "Public read access" ON user_reports FOR SELECT USING(true);
CREATE POLICY "Users can view their own reports" ON user_reports FOR SELECT USING(reporter_id=auth.uid());
CREATE POLICY "Users can create their own reports" ON user_reports FOR INSERT WITH CHECK(reporter_id=auth.uid());
CREATE POLICY "Users can delete their own reports" ON user_reports FOR DELETE USING(reporter_id=auth.uid());
INSERT INTO user_blocks(blocker_id,blocked_id) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
INSERT INTO user_reports(reporter_id,reported_id,reason,details) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','spam','Private report');
\ir ../migrations/20260908028000_native_personal_safety_privacy.sql
SET ROLE anon;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM user_blocks) OR EXISTS(SELECT 1 FROM user_reports) THEN RAISE EXCEPTION 'Anonymous privacy leak'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF (SELECT count(*) FROM user_blocks)<>1 OR (SELECT count(*) FROM user_reports)<>1 THEN RAISE EXCEPTION 'Owner access lost'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 IF (SELECT count(*) FROM user_blocks WHERE blocker_id=auth.uid() OR blocked_id=auth.uid())<>1 THEN RAISE EXCEPTION 'Reverse block detection lost'; END IF;
 IF EXISTS(SELECT 1 FROM user_reports) THEN RAISE EXCEPTION 'Reported account sees report'; END IF;
 DELETE FROM user_blocks; IF FOUND THEN RAISE EXCEPTION 'Blocked target removes block'; END IF;
 DELETE FROM user_reports; IF FOUND THEN RAISE EXCEPTION 'Reported target removes report'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM user_blocks) OR EXISTS(SELECT 1 FROM user_reports) THEN RAISE EXCEPTION 'Third-party read'; END IF;
 BEGIN INSERT INTO user_blocks(blocker_id,blocked_id) VALUES('00000000-0000-0000-0000-000000000002',auth.uid()); RAISE EXCEPTION 'Forged blocker'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO user_reports(reporter_id,reported_id) VALUES('00000000-0000-0000-0000-000000000002',auth.uid()); RAISE EXCEPTION 'Forged reporter'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM user_blocks)<>1 OR (SELECT count(*) FROM user_reports)<>1 THEN RAISE EXCEPTION 'Admin review lost'; END IF;
 DELETE FROM user_reports; IF NOT FOUND THEN RAISE EXCEPTION 'Admin deletion unavailable'; END IF;
 DELETE FROM user_blocks; IF FOUND THEN RAISE EXCEPTION 'Admin block deletion expanded'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DELETE FROM user_blocks;
INSERT INTO user_reports(reporter_id,reported_id,reason) VALUES(auth.uid(),'00000000-0000-0000-0000-000000000003','spam');
DELETE FROM user_reports WHERE reporter_id=auth.uid();
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM user_reports) OR EXISTS(SELECT 1 FROM user_blocks) THEN RAISE EXCEPTION 'Authorized deletion failed'; END IF; END $$;
\echo Personal safety: anonymous/third-party privacy, mutual-block visibility, ownership and admin report deletion passed.
