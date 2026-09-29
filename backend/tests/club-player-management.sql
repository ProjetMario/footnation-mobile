\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_fff_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND $1='00000000-0000-0000-0000-000000000100'::uuid $$;
CREATE FUNCTION public.is_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.is_fff_club_admin($1) $$;
CREATE TABLE club_players(id uuid PRIMARY KEY,club_id uuid NOT NULL,profile_id uuid,name text NOT NULL,category text NOT NULL,position text,jersey_number integer,is_active boolean DEFAULT true,joined_at date DEFAULT CURRENT_DATE,left_at date,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE history(player_id uuid REFERENCES club_players ON DELETE CASCADE);
ALTER TABLE club_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_players ON club_players FOR SELECT USING(true);
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT SELECT ON club_players TO authenticated;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908037000_native_club_player_management.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO club_players(id,club_id,name,category,jersey_number) VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000100','Joueur','U18',9);
RESET ROLE;
INSERT INTO history VALUES('00000000-0000-0000-0000-000000000011');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r uuid:='00000000-0000-0000-0000-000000000011'; c uuid:='00000000-0000-0000-0000-000000000100'; old jsonb; BEGIN
 SELECT to_jsonb(p) INTO old FROM club_players p WHERE id=r;
 PERFORM mutate_native_club_record_snapshot('players',c,r,'{"name":"Nom corrigé","jersey_number":10}',old,false);
 BEGIN PERFORM mutate_native_club_record_snapshot('players',c,r,'{"is_active":false}',old,false); RAISE EXCEPTION 'Stale archive'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT to_jsonb(p) INTO old FROM club_players p WHERE id=r;
 PERFORM mutate_native_club_record_snapshot('players',c,r,'{"is_active":false}',old,false);
 SELECT to_jsonb(p) INTO old FROM club_players p WHERE id=r;
 BEGIN PERFORM mutate_native_club_record_snapshot('players',c,r,'{}',old,true); RAISE EXCEPTION 'History deletion'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM mutate_native_club_record_snapshot('players',c,r,'{"is_active":true}',old,false);
 BEGIN UPDATE club_players SET profile_id='00000000-0000-0000-0000-000000000002' WHERE id=r; RAISE EXCEPTION 'Account relink'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_players SET jersey_number=100 WHERE id=r; RAISE EXCEPTION 'Bad jersey'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN INSERT INTO club_players(id,club_id,name,category,profile_id) VALUES('00000000-0000-0000-0000-000000000012',c,'Autre','U18','00000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'Forged association'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM mutate_native_club_record_snapshot('players',c,r,'{"name":"Interdit"}',old,false); RAISE EXCEPTION 'Foreign edit'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM history)<>1 OR (SELECT count(*) FROM club_players WHERE is_active=true AND jersey_number=10)<>1 THEN RAISE EXCEPTION 'History or restored player lost'; END IF; END $$;
\echo Club players: create/edit, stale archive, restoration, preserved history, jersey validation, immutable account and authorization passed.
