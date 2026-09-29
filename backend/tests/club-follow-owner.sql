\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION is_site_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000003'::uuid $$;
CREATE TABLE club_followers(id uuid PRIMARY KEY,profile_id uuid,club_id uuid,UNIQUE(profile_id,club_id));
ALTER TABLE club_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissive_insert ON club_followers FOR INSERT WITH CHECK(true);
CREATE POLICY public_read ON club_followers FOR SELECT USING(true);
CREATE POLICY own_delete ON club_followers FOR DELETE USING(auth.uid()=profile_id);
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT,INSERT,DELETE ON club_followers TO anon,authenticated;
\ir ../migrations/20260908040000_native_club_follow_owner.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO club_followers VALUES('00000000-0000-0000-0000-000000000011',auth.uid(),'00000000-0000-0000-0000-000000000100');
DO $$ BEGIN
 BEGIN INSERT INTO club_followers VALUES('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000100'); RAISE EXCEPTION 'Foreign identity'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_followers VALUES('00000000-0000-0000-0000-000000000012',auth.uid(),'00000000-0000-0000-0000-000000000100'); RAISE EXCEPTION 'Duplicate'; EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 DELETE FROM club_followers;
 IF (SELECT count(*) FROM club_followers)<>1 THEN RAISE EXCEPTION 'Foreign removal'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
INSERT INTO club_followers VALUES('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000100');
RESET ROLE; SET ROLE anon; SET request.jwt.claim.sub='';
DO $$ BEGIN
 BEGIN INSERT INTO club_followers VALUES('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000100'); RAISE EXCEPTION 'Anonymous insertion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM club_followers)<>2 THEN RAISE EXCEPTION 'Public count'; END IF;
END $$;
RESET ROLE;
\echo Follow ownership: own creation, site admin retained, anonymous/foreign denied, duplicate and foreign deletion protected.
