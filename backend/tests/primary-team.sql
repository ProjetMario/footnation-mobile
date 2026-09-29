\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,linked_club_id uuid,primary_role text,position text,target_position text);
CREATE TABLE teams(id uuid PRIMARY KEY,club_id uuid,is_active boolean);
CREATE TABLE team_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid REFERENCES teams(id),profile_id uuid REFERENCES profiles(id),role text,position text,is_active boolean,is_primary boolean,left_at timestamptz,jersey_number integer,UNIQUE(team_id,profile_id));
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Joueur','Gardien',null);
INSERT INTO teams SELECT ('20000000-0000-0000-0000-00000000000'||i)::uuid,'10000000-0000-0000-0000-000000000001',i<>3 FROM generate_series(1,3) i;
INSERT INTO team_members(team_id,profile_id,role,is_active,is_primary,jersey_number) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Captain',true,true,10),('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Reserve',true,false,20);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT ON team_members TO authenticated;
\ir ../migrations/20260908017000_native_primary_team.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',null,null); RAISE EXCEPTION 'Unauthorized'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
SELECT set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 IF (SELECT count(*) FROM team_members WHERE is_active)<>2 OR NOT EXISTS(SELECT 1 FROM team_members WHERE is_primary AND role='Reserve' AND jersey_number=20) THEN RAISE EXCEPTION 'Membership metadata lost'; END IF;
 BEGIN PERFORM set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',null,'20000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'Stale write'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'Inactive team'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',null,'20000000-0000-0000-0000-000000000002');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM team_members WHERE is_primary) OR (SELECT count(*) FROM team_members WHERE is_active)<>2 THEN RAISE EXCEPTION 'Removal deleted membership'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN IF has_function_privilege('anon','public.set_native_primary_team(uuid,uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous grant'; END IF; END $$;
UPDATE team_members SET is_active=false,left_at=now() WHERE team_id='20000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',null);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM team_members WHERE team_id='20000000-0000-0000-0000-000000000002' AND is_primary AND is_active AND left_at IS NULL AND jersey_number=20) THEN RAISE EXCEPTION 'Reactivation lost history'; END IF;
 BEGIN PERFORM set_native_primary_team('10000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000002',null,null); RAISE EXCEPTION 'Other club member'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
CREATE FUNCTION fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.is_primary THEN RAISE EXCEPTION 'Simulated write failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fail_assignment BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION fail_assignment();
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM set_native_primary_team('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'); EXCEPTION WHEN raise_exception THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM team_members WHERE team_id='20000000-0000-0000-0000-000000000002' AND is_primary) THEN RAISE EXCEPTION 'Partial update survived failure'; END IF;
END $$;
\echo Primary team: authorization, promotion, preservation, retry, conflict and inactive team checks passed.
