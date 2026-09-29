\set ON_ERROR_STOP on
-- Run only against a fresh disposable local PostgreSQL database. Synthetic IDs only.
DO $$ BEGIN
 IF current_database() NOT LIKE 'footnation_import_clubs_test_%' OR to_regclass('public.profiles') IS NOT NULL THEN
  RAISE EXCEPTION 'Fresh disposable database required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.test_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.fff_clubs(id uuid PRIMARY KEY,name text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,linked_club_id uuid REFERENCES public.fff_clubs,is_admin boolean DEFAULT false,is_suspended boolean DEFAULT false,suspended_until timestamptz,primary_role text,position text,target_position text);
CREATE TABLE public.club_admins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid REFERENCES public.fff_clubs,profile_id uuid REFERENCES public.profiles);
CREATE TABLE public.club_staff(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid REFERENCES public.fff_clubs,profile_id uuid REFERENCES public.profiles,is_active boolean,role text);
CREATE TABLE public.fff_teams(id uuid PRIMARY KEY,club_id uuid REFERENCES public.fff_clubs,name text,category text,age_range text,division text,level text,updated_at timestamptz DEFAULT now());
CREATE TABLE public.teams(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid REFERENCES public.fff_clubs,name text NOT NULL,category text NOT NULL,age_group text,season text NOT NULL,is_active boolean DEFAULT true,is_from_fff boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
-- Existing native set_native_primary_team contract needs this unique key.
CREATE TABLE public.team_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid REFERENCES public.teams ON DELETE CASCADE,profile_id uuid REFERENCES public.profiles ON DELETE CASCADE,role text,position text,is_active boolean DEFAULT true,is_primary boolean DEFAULT false,left_at timestamptz,UNIQUE(team_id,profile_id));
CREATE FUNCTION public.is_club_admin(club uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
  EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin) OR
  EXISTS(SELECT 1 FROM public.club_admins WHERE club_id=club AND profile_id=auth.uid()) OR
  EXISTS(SELECT 1 FROM public.club_staff WHERE club_id=club AND profile_id=auth.uid() AND is_active AND lower(role) IN ('dirigeant','president','admin','coach','entraineur','secretaire','tresorier')));
$$;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_admin ON public.teams TO authenticated USING(public.is_club_admin(club_id)) WITH CHECK(public.is_club_admin(club_id));
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
GRANT SELECT ON public.profiles,public.fff_teams,public.team_members TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.teams TO authenticated;
\ir ../../../supabase/migrations/20260908017000_native_primary_team.sql
\ir ../../../supabase/migrations/20260911065000_native_import_club_teams.sql

CREATE FUNCTION public.test_assert(value boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION public.test_error(command text,expected text) RETURNS void LANGUAGE plpgsql AS $$
 DECLARE actual text;
 BEGIN BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
  IF actual=expected THEN RETURN; END IF; RAISE EXCEPTION 'Expected %, got %',expected,actual; END;
 RAISE EXCEPTION 'Expected error %, operation succeeded',expected; END $$;
CREATE FUNCTION public.test_source(n integer,target integer) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('source',jsonb_build_object('id',id,'club_id',club_id,'name',name,'category',category,'age_range',age_range,'division',division,'level',level,'updated_at',updated_at),'target_id',test_id(target)) FROM public.fff_teams WHERE id=test_id(n);
$$;
INSERT INTO public.fff_clubs VALUES(test_id(101),'Same synthetic club name'),(test_id(102),'Same synthetic club name');
INSERT INTO auth.users SELECT test_id(n) FROM generate_series(1,8) n;
INSERT INTO public.profiles(id,linked_club_id,is_admin,is_suspended,primary_role) SELECT test_id(n),test_id(CASE WHEN n=8 THEN 102 ELSE 101 END),n=6,n=5,'Joueur' FROM generate_series(1,8) n;
INSERT INTO public.club_admins(club_id,profile_id) VALUES(test_id(101),test_id(1));
INSERT INTO public.club_staff(club_id,profile_id,is_active,role) VALUES(test_id(101),test_id(7),true,'coach');
INSERT INTO public.fff_teams(id,club_id,name,category,age_range,division) VALUES
 (test_id(201),test_id(101),'Équipe réelle A','Seniors','18+','Régional'),
 (test_id(202),test_id(101),'Équipe réelle B','Seniors','18+','District'),
 (test_id(203),test_id(101),'Source incomplète',NULL,NULL,NULL),
 (test_id(204),test_id(102),'Équipe réelle A','Seniors','18+','Régional'),
 (test_id(205),test_id(101),'Équipe concurrente','U19','17-19','District'),
 (test_id(206),test_id(101),'Équipe à conserver','U17','15-17','District');
INSERT INTO public.teams(id,club_id,name,category,season) VALUES
 (test_id(311),test_id(101),'Manuelle A','Seniors','2026-2027'),
 (test_id(312),test_id(101),'Manuelle B','U19','2026-2027'),
 (test_id(313),test_id(102),'Autre club','Seniors','2026-2027');
SELECT test_assert(NOT has_function_privilege('anon','import_native_club_teams(uuid,uuid,text,jsonb)','EXECUTE'),'Anon cannot import');
SELECT test_assert(NOT has_function_privilege('authenticated','native_club_import_authorize(uuid,uuid)','EXECUTE'),'Helper inaccessible');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT test_error($q$SELECT native_club_import_available(test_id(101),test_id(2))$q$,'42501');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,301)))$q$,'42501');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_error($q$SELECT native_club_import_available(test_id(102),test_id(1))$q$,'42501');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(2),'2026-2027',jsonb_build_array(test_source(201,301)))$q$,'42501');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2028',jsonb_build_array(test_source(201,301)))$q$,'22023');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(204,301)))$q$,'22023');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(203,301)))$q$,'22023');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(jsonb_set(test_source(201,301),'{source,name}','"Old name"')))$q$,'40001');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,301)||'{"overwrite":true}'))$q$,'22023');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,301),test_source(201,302)))$q$,'22023');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,301),test_source(202,301)))$q$,'22023');
-- The first row is valid, but the entire transaction must roll back on the second.
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,301),test_source(203,303)))$q$,'22023');
SELECT test_assert(NOT EXISTS(SELECT 1 FROM teams WHERE native_fff_team_id IS NOT NULL),'Failed batch created nothing');
SELECT test_assert(import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,301)))->0->>'status'='created','Selected source created');
SELECT test_assert((SELECT count(*) FROM teams WHERE native_fff_team_id IS NOT NULL)=1,'No fabricated or unselected teams');
SELECT test_assert(import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,399)))->0->>'team_id'=test_id(301)::text,'Retry returns existing team');
UPDATE teams SET name='Renamed by administrator',is_active=false WHERE id=test_id(301);
SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(201,399)));
SELECT test_assert((SELECT name='Renamed by administrator' AND NOT is_active FROM teams WHERE id=test_id(301)),'Replay preserves administrator edits');
SELECT test_error($q$UPDATE teams SET native_fff_team_id=NULL WHERE id=test_id(301)$q$,'22023');
SELECT test_error($q$UPDATE teams SET native_fff_team_id=test_id(202) WHERE id=test_id(301)$q$,'22023');
SELECT test_error($q$INSERT INTO teams(club_id,name,category,age_group,season) VALUES(test_id(101),' renamed by administrator ',' seniors ','18+','2026-2027')$q$,'23505');
INSERT INTO teams(id,club_id,name,category,age_group,season) VALUES(test_id(302),test_id(101),'Équipe réelle B','Seniors','18+','2026-2027');
SELECT test_error($q$SELECT import_native_club_teams(test_id(101),test_id(1),'2026-2027',jsonb_build_array(test_source(202,398)))$q$,'23505');
SELECT test_assert((SELECT native_fff_team_id IS NULL FROM teams WHERE id=test_id(302)),'Manual matching team not attached or overwritten');
RESET ROLE;
SELECT test_assert((SELECT name='Autre club' FROM teams WHERE id=test_id(313)),'Other club untouched');
INSERT INTO team_members(team_id,profile_id,role,is_primary) VALUES(test_id(311),test_id(4),'Coach',true),(test_id(312),test_id(3),'Analyste',false);
SET ROLE authenticated;
SELECT test_error($q$SELECT assign_native_club_primary_teams(test_id(101),test_id(1),test_id(312),jsonb_build_array(jsonb_build_object('profile_id',test_id(3),'expected_team_id',NULL),jsonb_build_object('profile_id',test_id(4),'expected_team_id',NULL)))$q$,'40001');
SELECT test_assert(NOT EXISTS(SELECT 1 FROM team_members WHERE profile_id=test_id(3) AND is_primary),'Assignment batch rollback');
SELECT test_assert(assign_native_club_primary_teams(test_id(101),test_id(1),test_id(312),jsonb_build_array(jsonb_build_object('profile_id',test_id(3),'expected_team_id',NULL),jsonb_build_object('profile_id',test_id(4),'expected_team_id',test_id(311))))=2,'Two assignments committed');
SELECT test_assert((SELECT role='Analyste' AND is_primary FROM team_members WHERE profile_id=test_id(3) AND team_id=test_id(312)),'Existing membership role preserved');
SELECT test_assert((SELECT role='Coach' AND NOT is_primary AND is_active FROM team_members WHERE profile_id=test_id(4) AND team_id=test_id(311)),'Other membership preserved');
SELECT test_assert(assign_native_club_primary_teams(test_id(101),test_id(1),test_id(312),jsonb_build_array(jsonb_build_object('profile_id',test_id(3),'expected_team_id',NULL)))=1,'Assignment replay is idempotent');
SELECT test_error($q$SELECT assign_native_club_primary_teams(test_id(101),test_id(1),test_id(312),jsonb_build_array(jsonb_build_object('profile_id',test_id(8),'expected_team_id',NULL)))$q$,'22023');
SELECT test_error($q$SELECT assign_native_club_primary_teams(test_id(101),test_id(1),test_id(312),jsonb_build_array(jsonb_build_object('profile_id',test_id(5),'expected_team_id',NULL)))$q$,'22023');
SELECT test_error($q$SELECT assign_native_club_primary_teams(test_id(101),test_id(1),test_id(313),jsonb_build_array(jsonb_build_object('profile_id',test_id(3),'expected_team_id',test_id(312))))$q$,'22023');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000006';
SELECT test_assert(native_club_import_available(test_id(101),test_id(6)),'Existing site admin authority');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000007';
SELECT test_assert(native_club_import_available(test_id(101),test_id(7)),'Existing active staff authority');
RESET ROLE;
UPDATE profiles SET is_suspended=true WHERE id=test_id(1);
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_error($q$SELECT native_club_import_available(test_id(101),test_id(1))$q$,'42501');
RESET ROLE;
UPDATE profiles SET is_suspended=false WHERE id=test_id(1);
-- Include real deletion guard to prove the new upstream FFF FK does not block
-- an ordinary member or erase teams, sources, or another member's membership.
CREATE TABLE public.posts(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles);
CREATE TABLE public.stories(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles);
CREATE TABLE public.messages(id uuid PRIMARY KEY,sender_id uuid REFERENCES public.profiles,receiver_id uuid REFERENCES public.profiles);
CREATE TABLE public.connections(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles,connected_user_id uuid REFERENCES public.profiles);
CREATE TABLE public.post_comments(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles);
CREATE TABLE public.post_reactions(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles);
CREATE TABLE public.subscriptions(user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
CREATE TABLE storage.objects(bucket_id text,name text,owner_id text,owner uuid);
\ir ../../../supabase/migrations/20260910061000_account_deletion.sql
SELECT account_deletion_check(test_id(3));
SELECT account_deletion_lease(test_id(3),account_deletion_claim(test_id(3),test_id(901)),true);
DELETE FROM auth.users WHERE id=test_id(3);
SELECT test_assert(NOT EXISTS(SELECT 1 FROM team_members WHERE profile_id=test_id(3)),'Deleted member membership removed');
SELECT test_assert(EXISTS(SELECT 1 FROM teams WHERE id=test_id(301)) AND EXISTS(SELECT 1 FROM fff_teams WHERE id=test_id(201)) AND (SELECT count(*) FROM team_members WHERE profile_id=test_id(4))=2,'Deletion preserves club, source and other member');
-- Removing canonical source may clear provenance, never erase its managed team.
DELETE FROM fff_teams WHERE id=test_id(201);
SELECT test_assert((SELECT native_fff_team_id IS NULL AND name='Renamed by administrator' FROM teams WHERE id=test_id(301)),'Source deletion preserves managed team');
\echo Import clubs: authorization, spoofing, scope, snapshots, additive import, conflicts, retries, atomic assignments, role preservation, suspension, and deletion isolation passed.
