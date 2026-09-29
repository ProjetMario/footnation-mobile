\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE club_players(id uuid PRIMARY KEY,profile_id uuid,club_id uuid);
CREATE TABLE club_convocations(id uuid PRIMARY KEY,club_id uuid,title text,meeting_date timestamptz,meeting_location text,description text);
CREATE TABLE club_convocation_players(id uuid PRIMARY KEY,convocation_id uuid,player_id uuid,status text,responded_at timestamptz,notes text,created_at timestamptz DEFAULT now());
ALTER TABLE club_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_convocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_convocation_players ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
INSERT INTO club_players VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100'),('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000100');
INSERT INTO club_convocations VALUES('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000100','Match','2026-09-10T16:00:00Z','Stade','Consignes'),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000200','Autre club',now(),'Autre stade','Autres consignes');
INSERT INTO club_convocation_players(id,convocation_id,player_id,status,notes) VALUES
('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','pending','Note interne'),
('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000012','pending','Autre note'),
('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011','pending','Mauvais club');
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908035000_native_member_convocations.sql
DO $$ BEGIN IF has_function_privilege('anon','get_native_member_convocations(integer,integer)','EXECUTE') OR has_function_privilege('anon','respond_native_member_convocation(uuid,text,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous access'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE row jsonb; stamp timestamptz; BEGIN
 IF (SELECT count(*) FROM get_native_member_convocations())<>1 THEN RAISE EXCEPTION 'Wrong member mapping'; END IF;
 SELECT to_jsonb(x) INTO row FROM get_native_member_convocations() x;
 IF row ? 'notes' OR row->'convocation'->>'description'<>'Consignes' THEN RAISE EXCEPTION 'Wrong detail scope'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_member_convocations(1,1)) THEN RAISE EXCEPTION 'Pagination ignored'; END IF;
 BEGIN PERFORM get_native_member_convocations(0,31); RAISE EXCEPTION 'Unbounded page'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000031','accepted','pending',NULL);
 PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000031','accepted','pending',NULL);
 BEGIN PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000031','declined','pending',NULL); RAISE EXCEPTION 'Stale response'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT responded_at INTO stamp FROM get_native_member_convocations();
 PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000031','declined','accepted',stamp);
 BEGIN PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000032','accepted','pending',NULL); RAISE EXCEPTION 'Other member response'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000033','accepted','pending',NULL); RAISE EXCEPTION 'Cross-club response'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE club_convocation_players SET status='injured' WHERE id='00000000-0000-0000-0000-000000000031';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN BEGIN PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000031','accepted','injured',NULL); RAISE EXCEPTION 'Club status overwritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM club_convocation_players WHERE id='00000000-0000-0000-0000-000000000031' AND notes='Note interne') THEN RAISE EXCEPTION 'Notes overwritten'; END IF; END $$;
\echo Member convocations: distinct profile/player ids, private scope, pagination, reply/retry/conflict, cross-club denial and club-managed status passed.
