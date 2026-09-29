-- Synthetic-only prerequisites. Refuse any existing application schema.
DO $$ BEGIN
 IF current_setting('footnation.experience_test_disposable',true) IS DISTINCT FROM '1' OR to_regclass('public.profiles') IS NOT NULL THEN
  RAISE EXCEPTION 'Fresh disposable experience database required';
 END IF;
END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE TABLE profiles(id uuid PRIMARY KEY,experience_history jsonb,updated_at timestamptz DEFAULT now(),is_suspended boolean,suspended_until timestamptz,is_admin boolean DEFAULT false);
CREATE TABLE fff_clubs(id uuid PRIMARY KEY,name text);
CREATE TABLE user_preferences(user_id uuid PRIMARY KEY,profile_visibility boolean);
CREATE TABLE user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE club_members(id uuid PRIMARY KEY,profile_id uuid,role text);
CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp();RETURN NEW;END $$;
CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE FUNCTION fn_native_profile_visible(p_profile_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(p_profile_id=auth.uid(),false) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin IS TRUE) OR coalesce((SELECT profile_visibility FROM public.user_preferences WHERE user_id=p_profile_id),true);
$$;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON profiles TO authenticated,anon,service_role;
CREATE POLICY legacy_profiles ON profiles FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
INSERT INTO profiles(id) VALUES('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
INSERT INTO fff_clubs VALUES('10000000-0000-4000-8000-000000000001','Exact A'),('10000000-0000-4000-8000-000000000002','Exact B');
\ir ../../../supabase/migrations/20260506_create_club_experience_members.sql
GRANT SELECT,INSERT,UPDATE,DELETE ON club_experience_members TO authenticated,anon,service_role;
-- Deliberately broad old permissions must not bypass the new boundaries.
CREATE POLICY legacy_all_projection ON club_experience_members FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
INSERT INTO club_experience_members(club_id,profile_id,start_year,position) VALUES('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1990,'manual'),('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',2000,'B legacy');
\ir ../../../supabase/migrations/20260911068000_native_experience_projection.sql
CREATE FUNCTION assert_experience(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Experience assertion: %',label;END IF;END $$;
CREATE FUNCTION expect_experience_error(command text,code text) RETURNS void LANGUAGE plpgsql AS $$ DECLARE actual text;
BEGIN BEGIN EXECUTE command;EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
 IF actual=code THEN RETURN;END IF;RAISE EXCEPTION 'Expected %, got %: %',code,actual,SQLERRM;END;RAISE EXCEPTION 'Forbidden operation succeeded: %',command;END $$;
CREATE FUNCTION fixture_experience(p_patch jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_array(jsonb_build_object('native_experience_id','20000000-0000-4000-8000-000000000001','club_id','10000000-0000-4000-8000-000000000001','club','Exact A','ageCategory','Seniors','level','Régional','position','Gardien','startYear','2020','endYear','') || p_patch);
$$;
SET ROLE authenticated;SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT assert_experience(native_experience_sync_available(),'capability');
SELECT save_native_experience_history(NULL,fixture_experience());
SELECT assert_experience((SELECT count(*)=1 FROM club_experience_members WHERE native_source='profile-history-v1'),'one projection');
SELECT assert_experience((SELECT experience_history=fixture_experience() FROM profiles WHERE id=auth.uid()),'complete profile');
SELECT assert_experience((SELECT start_year=2020 AND is_current AND position='Gardien' FROM club_experience_members WHERE native_experience_id IS NOT NULL),'actual fields and current status');
SELECT set_config('fixture.projection_id',(SELECT id::text FROM club_experience_members WHERE native_experience_id IS NOT NULL),false);
SELECT set_config('fixture.updated',(SELECT updated_at::text FROM profiles WHERE id=auth.uid()),false);
SELECT save_native_experience_history('[]',fixture_experience());
SELECT assert_experience((SELECT updated_at::text=current_setting('fixture.updated') FROM profiles WHERE id=auth.uid()),'lost response replay leaves timestamp');
SELECT expect_experience_error($q$SELECT save_native_experience_history('[]',fixture_experience('{"position":"Milieu"}'))$q$,'40001');
SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"endYear":"2024","position":"Milieu","club_id":"10000000-0000-4000-8000-000000000002"}'));
SELECT assert_experience((SELECT id::text=current_setting('fixture.projection_id') AND club_id='10000000-0000-4000-8000-000000000002' AND end_year=2024 AND NOT is_current FROM club_experience_members WHERE native_experience_id IS NOT NULL),'edit retains ID and updates exact club');
-- Reset using expected full payload. Manual uniqueness collision must roll back both sides.
SELECT save_native_experience_history(fixture_experience('{"endYear":"2024","position":"Milieu","club_id":"10000000-0000-4000-8000-000000000002"}'),fixture_experience());
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"startYear":"1990"}'))$q$,'23505');
SELECT assert_experience((SELECT experience_history=fixture_experience() FROM profiles WHERE id=auth.uid()),'legacy collision rolls back profile');
SELECT assert_experience((SELECT count(*)=1 FROM club_experience_members WHERE start_year=1990 AND native_source IS NULL AND position='manual'),'legacy row unclaimed');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"club_id":"10000000-0000-4000-8000-000000000099"}'))$q$,'23503');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"club_id":"Club exact"}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"startYear":""}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"startYear":null}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"startYear":"0000"}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"endYear":"2019"}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"native_experience_id":null}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience('{"level":null}'))$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),fixture_experience()||fixture_experience())$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),'null')$q$,'22023');
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),jsonb_build_array(jsonb_build_object('x',repeat('a',131073))))$q$,'22023');
-- Direct legacy/profile writes also keep a native projection in the transaction.
UPDATE profiles SET experience_history=fixture_experience('{"endYear":"Présent"}') WHERE id=auth.uid();
SELECT assert_experience((SELECT end_year IS NULL AND is_current FROM club_experience_members WHERE native_experience_id IS NOT NULL),'web Présent compatibility');
UPDATE profiles SET experience_history=fixture_experience() WHERE id=auth.uid();
WITH changes AS (UPDATE club_experience_members SET position='forged' WHERE native_experience_id IS NOT NULL RETURNING *) SELECT assert_experience((SELECT count(*)=0 FROM changes),'managed update blocked');
WITH changes AS (DELETE FROM club_experience_members WHERE native_experience_id IS NOT NULL RETURNING *) SELECT assert_experience((SELECT count(*)=0 FROM changes),'managed delete blocked');
SELECT expect_experience_error($q$INSERT INTO club_experience_members(club_id,profile_id,start_year,native_experience_id,native_source) VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),2001,'20000000-0000-4000-8000-000000000099','profile-history-v1')$q$,'42501');
SELECT expect_experience_error($q$UPDATE club_experience_members SET native_experience_id='20000000-0000-4000-8000-000000000099',native_source='profile-history-v1' WHERE start_year=1990$q$,'42501');
INSERT INTO club_experience_members(club_id,profile_id,start_year) VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),1980);
DELETE FROM club_experience_members WHERE profile_id=auth.uid() AND start_year=1980;
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE start_year=1980),'legacy owner workflow preserved');
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SELECT expect_experience_error($q$UPDATE profiles SET experience_history='[]' WHERE id='00000000-0000-4000-8000-000000000001'$q$,'42501');
SELECT save_native_experience_history(NULL,fixture_experience());
SELECT assert_experience((SELECT count(*)=2 FROM club_experience_members WHERE native_source IS NOT NULL),'same experience UUID belongs to independent profile');
-- Visibility changes affect existing native projections immediately; legacy is unchanged.
RESET ROLE;
INSERT INTO user_preferences VALUES('00000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000001' AND native_source IS NOT NULL),'private history hidden from stranger');
SELECT assert_experience((SELECT count(*)=1 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000001' AND native_source IS NULL),'legacy read preserved');
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT assert_experience((SELECT count(*)=1 FROM club_experience_members WHERE profile_id=auth.uid() AND native_source IS NOT NULL),'owner sees private projection');
RESET ROLE;UPDATE user_preferences SET profile_visibility=true;
INSERT INTO user_blocks VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
SET ROLE authenticated;SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000001' AND native_source IS NOT NULL),'reverse block hides projection');
RESET ROLE;DELETE FROM user_blocks;INSERT INTO user_blocks VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001');
SET ROLE authenticated;
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000001' AND native_source IS NOT NULL),'forward block hides projection');
RESET ROLE;DELETE FROM user_blocks;UPDATE profiles SET is_suspended=true WHERE id='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000001' AND native_source IS NOT NULL),'suspended profile hidden');
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT expect_experience_error($q$SELECT save_native_experience_history(fixture_experience(),'[]')$q$,'42501');
SELECT expect_experience_error($q$UPDATE profiles SET experience_history='[]' WHERE id=auth.uid()$q$,'42501');
-- An already-authorized admin update remains allowed, including suspended targets.
RESET ROLE;UPDATE profiles SET is_admin=true WHERE id='00000000-0000-4000-8000-000000000003';
SET ROLE authenticated;SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
UPDATE profiles SET experience_history=fixture_experience('{"position":"Attaquant"}') WHERE id='00000000-0000-4000-8000-000000000001';
RESET ROLE;UPDATE profiles SET is_suspended=true WHERE id='00000000-0000-4000-8000-000000000003';
SET ROLE authenticated;
SELECT expect_experience_error($q$UPDATE profiles SET experience_history='[]' WHERE id='00000000-0000-4000-8000-000000000001'$q$,'42501');
RESET ROLE;UPDATE profiles SET suspended_until=now()-interval '1 second' WHERE id='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT save_native_experience_history(fixture_experience('{"position":"Attaquant"}'),fixture_experience('{"club_id":null,"startYear":""}'));
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id=auth.uid() AND native_source IS NOT NULL),'unlink removes only attributed row');
SELECT save_native_experience_history(fixture_experience('{"club_id":null,"startYear":""}'),fixture_experience()||'[{"old":"opaque"}]');
SELECT save_native_experience_history(fixture_experience()||'[{"old":"opaque"}]','[{"old":"opaque"}]');
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id=auth.uid() AND native_source IS NOT NULL),'remove deletes only attributed row');
SELECT assert_experience((SELECT count(*)=1 FROM club_experience_members WHERE profile_id=auth.uid() AND native_source IS NULL),'manual row remains after remove');
SELECT save_native_experience_history('[{"old":"opaque"}]',fixture_experience());
SET ROLE anon;SET request.jwt.claim.sub='';
SELECT expect_experience_error($q$SELECT save_native_experience_history(NULL,'[]')$q$,'42501');
SELECT expect_experience_error($q$SELECT native_experience_sync_available()$q$,'42501');
SELECT expect_experience_error($q$UPDATE profiles SET experience_history='[]' WHERE id='00000000-0000-4000-8000-000000000001'$q$,'42501');
RESET ROLE;
SELECT assert_experience((SELECT count(*)=0 FROM club_members),'projection never creates memberships or roles');
DELETE FROM profiles WHERE id='00000000-0000-4000-8000-000000000001';
SELECT assert_experience((SELECT count(*)=0 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000001'),'deleted account FK cascade');
SELECT assert_experience((SELECT count(*)=2 FROM club_experience_members WHERE profile_id='00000000-0000-4000-8000-000000000002'),'other account preserved');
SELECT assert_experience((SELECT count(*)=0 FROM information_schema.columns WHERE table_name='club_experience_members' AND column_name='start_year' AND is_nullable='YES'),'historical start year remains mandatory');
