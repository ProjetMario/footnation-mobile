\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY,linked_club_id uuid,full_name text,username text,avatar_url text);
CREATE TABLE teams(id uuid PRIMARY KEY,club_id uuid,name text);
CREATE TABLE team_members(id uuid PRIMARY KEY,team_id uuid,profile_id uuid,is_active boolean,status text,role text,jersey_number integer,position text);
GRANT SELECT ON profiles,teams,team_members TO authenticated;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON profiles FOR SELECT TO authenticated USING(id<>'00000000-0000-0000-0000-000000000003'::uuid);
INSERT INTO profiles VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','Alice','alice',null),
('00000000-0000-0000-0000-000000000002',null,'Nora 100%','nora_test',null),
('00000000-0000-0000-0000-000000000003',null,'Hidden','hidden',null);
INSERT INTO teams VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010','U18'),('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','Other club');
INSERT INTO team_members VALUES
('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',true,'approved','Joueur',7,'Attaquant'),
('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002',true,'approved','Coach',null,null),
('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000003',true,'approved','Joueur',null,null),
('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002',true,'approved','Coach',null,null),
('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002',true,'pending','Coach',null,null),
('00000000-0000-0000-0000-000000000035','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002',false,'approved','Coach',null,null);
\ir ../migrations/20260908053000_native_member_roster.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM get_native_member_roster('00000000-0000-0000-0000-000000000010'))<>3 THEN RAISE EXCEPTION 'Club/active/approved scope'; END IF;
 IF (SELECT id FROM get_native_member_roster('00000000-0000-0000-0000-000000000010',' COACH ',0,1))<>'00000000-0000-0000-0000-000000000031' THEN RAISE EXCEPTION 'Search before paging'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_member_roster('00000000-0000-0000-0000-000000000010','coach',1,1)) THEN RAISE EXCEPTION 'Filtered next page'; END IF;
 IF (SELECT count(*) FROM get_native_member_roster('00000000-0000-0000-0000-000000000010','%'))<>1 OR (SELECT count(*) FROM get_native_member_roster('00000000-0000-0000-0000-000000000010','_test'))<>1 THEN RAISE EXCEPTION 'Literal wildcards'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_member_roster('00000000-0000-0000-0000-000000000010','Hidden')) THEN RAISE EXCEPTION 'Hidden name searchable'; END IF;
 IF (SELECT profile FROM get_native_member_roster('00000000-0000-0000-0000-000000000010') WHERE id='00000000-0000-0000-0000-000000000032') IS NOT NULL THEN RAISE EXCEPTION 'RLS bypass'; END IF;
 BEGIN PERFORM * FROM get_native_member_roster('00000000-0000-0000-0000-000000000011'); RAISE EXCEPTION 'Nonmember access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM get_native_member_roster('00000000-0000-0000-0000-000000000010','',0,101); RAISE EXCEPTION 'Unbounded page'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SET request.jwt.claim.sub='';
DO $$ BEGIN BEGIN PERFORM * FROM get_native_member_roster('00000000-0000-0000-0000-000000000010'); RAISE EXCEPTION 'No session'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM get_native_member_roster('00000000-0000-0000-0000-000000000010'); RAISE EXCEPTION 'Anonymous'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
\echo Member roster search, pagination, scope and profile RLS passed.
