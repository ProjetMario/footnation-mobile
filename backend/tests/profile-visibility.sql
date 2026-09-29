\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,username text,avatar_url text,primary_role text,position text,club text,city text,department text,favorite_pro_club text,is_admin boolean DEFAULT false);
CREATE TABLE user_preferences(user_id uuid PRIMARY KEY,profile_visibility boolean);
CREATE TABLE connections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,connected_user_id uuid,status text,created_at timestamptz DEFAULT now());
CREATE FUNCTION is_site_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT is_admin FROM public.profiles WHERE id=auth.uid()),false) $$;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_profiles ON profiles FOR SELECT USING(true);
CREATE POLICY own_profile ON profiles FOR UPDATE USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY own_preferences ON user_preferences USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON profiles,connections TO anon,authenticated;
GRANT UPDATE ON profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE ON user_preferences TO authenticated;
INSERT INTO profiles(id,full_name,username,is_admin) VALUES
('00000000-0000-0000-0000-000000000001','Administrator','admin',true),
('00000000-0000-0000-0000-000000000002','Private member','private',false),
('00000000-0000-0000-0000-000000000003','Public member','public',false),
('00000000-0000-0000-0000-000000000004','Public viewer','viewer',false);
INSERT INTO user_preferences VALUES('00000000-0000-0000-0000-000000000002',false),('00000000-0000-0000-0000-000000000003',NULL);
\ir profile-visibility-original-functions.sql
\ir ../migrations/20260908027000_native_profile_visibility.sql
SET ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM profiles WHERE username='private') THEN RAISE EXCEPTION 'Anonymous private profile access'; END IF;
 IF (SELECT count(*) FROM profiles)<>3 THEN RAISE EXCEPTION 'Public defaults changed'; END IF;
 IF EXISTS(SELECT 1 FROM get_connection_suggestions('00000000-0000-0000-0000-000000000004')) OR EXISTS(SELECT 1 FROM get_ranked_connection_suggestions('00000000-0000-0000-0000-000000000004')) THEN RAISE EXCEPTION 'Anonymous recommendations'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM profiles WHERE username='private') THEN RAISE EXCEPTION 'Member private access'; END IF;
 IF (SELECT count(*) FROM get_connection_suggestions(auth.uid()))<>2 OR (SELECT count(*) FROM get_ranked_connection_suggestions(auth.uid()))<>2 THEN RAISE EXCEPTION 'Public recommendations lost'; END IF;
 IF EXISTS(SELECT 1 FROM get_connection_suggestions(auth.uid()) WHERE username='private') OR EXISTS(SELECT 1 FROM get_ranked_connection_suggestions(auth.uid()) WHERE username='private') THEN RAISE EXCEPTION 'Suggestion leak'; END IF;
 IF EXISTS(SELECT 1 FROM get_connection_suggestions('00000000-0000-0000-0000-000000000002')) THEN RAISE EXCEPTION 'Third-party recommendation context'; END IF;
END $$;
RESET ROLE;
INSERT INTO connections(user_id,connected_user_id,status) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','accepted'),('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','pending');
SET ROLE anon;
SET request.jwt.claim.sub='';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM get_profile_connections('00000000-0000-0000-0000-000000000002','connections')) THEN RAISE EXCEPTION 'Anonymous private network'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM get_profile_connections('00000000-0000-0000-0000-000000000003','connections') WHERE other_username='private') THEN RAISE EXCEPTION 'Network peer leak'; END IF;
 IF EXISTS(SELECT 1 FROM get_profile_connections('00000000-0000-0000-0000-000000000002','connections')) THEN RAISE EXCEPTION 'Private network leak'; END IF;
 IF EXISTS(SELECT 1 FROM get_profile_connections('00000000-0000-0000-0000-000000000003','pending')) THEN RAISE EXCEPTION 'Third-party pending requests'; END IF;
 IF (SELECT count(*) FROM get_profile_connections(auth.uid(),'sent'))<>1 THEN RAISE EXCEPTION 'Own pending unavailable'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Owner cannot read'; END IF; END $$;
UPDATE profiles SET full_name='Private edited' WHERE id=auth.uid();
UPDATE user_preferences SET profile_visibility=true WHERE user_id=auth.uid();
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM profiles WHERE username='private') THEN RAISE EXCEPTION 'Public toggle failed'; END IF; END $$;
RESET ROLE;
UPDATE user_preferences SET profile_visibility=false;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT count(*) FROM profiles)<>4 THEN RAISE EXCEPTION 'Administrator access lost'; END IF; END $$;
\echo Profile visibility: direct reads, recommendations, network, owner/admin access, pending requests and public toggle passed.
