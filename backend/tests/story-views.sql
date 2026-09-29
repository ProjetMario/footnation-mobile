\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY);
CREATE TABLE stories(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id),expires_at timestamptz);
CREATE TABLE user_blocks(blocker_id uuid,blocked_id uuid);
GRANT SELECT ON stories,user_blocks TO authenticated;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_read ON stories FOR SELECT USING(true);
CREATE POLICY blocks_read ON user_blocks FOR SELECT USING(blocker_id=auth.uid() OR blocked_id=auth.uid());
INSERT INTO profiles SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,3) n;
INSERT INTO stories VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',now()+interval '1 hour');
\ir ../migrations/20260908050000_native_story_views.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
INSERT INTO story_views(story_id,viewer_id) VALUES('00000000-0000-0000-0000-000000000010',auth.uid());
INSERT INTO story_views(story_id,viewer_id) VALUES('00000000-0000-0000-0000-000000000010',auth.uid()) ON CONFLICT(story_id,viewer_id) DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM story_views)<>1 OR (SELECT created_at FROM story_views) IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Unique view and server date'; END IF;
 BEGIN INSERT INTO story_views(story_id,viewer_id,created_at) VALUES('00000000-0000-0000-0000-000000000010',auth.uid(),'2099-01-01'); RAISE EXCEPTION 'Forged timestamp'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO story_views(story_id,viewer_id) VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Forged viewer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE story_views SET created_at=now(); RAISE EXCEPTION 'View update'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM story_views)<>1 THEN RAISE EXCEPTION 'Author cannot see views'; END IF;
 BEGIN INSERT INTO story_views(story_id,viewer_id) VALUES('00000000-0000-0000-0000-000000000010',auth.uid()); RAISE EXCEPTION 'Own view counted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM story_views) THEN RAISE EXCEPTION 'Third party can see viewers'; END IF; END $$;
RESET ROLE;
INSERT INTO user_blocks VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
SET ROLE authenticated;
DO $$ BEGIN BEGIN INSERT INTO story_views(story_id,viewer_id) VALUES('00000000-0000-0000-0000-000000000010',auth.uid()); RAISE EXCEPTION 'Blocked view'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE; DELETE FROM user_blocks; UPDATE stories SET expires_at=now()-interval '1 hour';
SET ROLE authenticated;
DO $$ BEGIN BEGIN INSERT INTO story_views(story_id,viewer_id) VALUES('00000000-0000-0000-0000-000000000010',auth.uid()); RAISE EXCEPTION 'Expired view'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM story_views; RAISE EXCEPTION 'Anonymous read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE; DELETE FROM stories;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM story_views) THEN RAISE EXCEPTION 'Orphan view'; END IF; END $$;
\echo Story view ownership, uniqueness, expiry, block, server timestamp and cascade passed.
