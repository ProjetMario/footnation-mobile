\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION is_fff_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND $1='00000000-0000-0000-0000-000000000100'::uuid $$;
CREATE TABLE club_matches(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE club_players(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE match_player_stats(id uuid PRIMARY KEY,match_id uuid REFERENCES club_matches,player_id uuid REFERENCES club_players,goals integer DEFAULT 0,assists integer DEFAULT 0,minutes_played integer DEFAULT 0,yellow_cards integer DEFAULT 0,red_cards integer DEFAULT 0,rating numeric(3,1),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(match_id,player_id));
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_stats ON match_player_stats FOR SELECT USING(true);
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908041000_native_match_player_stats.sql
INSERT INTO club_matches VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000100');
INSERT INTO club_players VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000100'),('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000101');
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r uuid:='00000000-0000-0000-0000-000000000030'; m uuid:='00000000-0000-0000-0000-000000000010'; p uuid:='00000000-0000-0000-0000-000000000020'; vals jsonb:='{"goals":1,"assists":2,"minutes_played":90,"yellow_cards":0,"red_cards":0}'; old jsonb; BEGIN
 PERFORM save_native_match_player_stats(r,m,p,vals,NULL);
 PERFORM save_native_match_player_stats(r,m,p,vals,NULL);
 IF (SELECT count(*) FROM match_player_stats)<>1 THEN RAISE EXCEPTION 'Duplicate retry'; END IF;
 SELECT to_jsonb(s) INTO old FROM match_player_stats s WHERE id=r;
 PERFORM save_native_match_player_stats(r,m,p,vals||'{"goals":3}',old);
 BEGIN PERFORM save_native_match_player_stats(r,m,p,vals,old); RAISE EXCEPTION 'Stale overwrite'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM save_native_match_player_stats(r,m,p,vals,NULL); RAISE EXCEPTION 'Conflicting creation retry'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT to_jsonb(s) INTO old FROM match_player_stats s WHERE id=r;
 BEGIN PERFORM save_native_match_player_stats(r,m,p,vals||'{"goals":-1}',old); RAISE EXCEPTION 'Negative goals'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM save_native_match_player_stats(r,m,p,vals,old-'rating'); RAISE EXCEPTION 'Incomplete snapshot'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN UPDATE match_player_stats SET player_id='00000000-0000-0000-0000-000000000021' WHERE id=r; RAISE EXCEPTION 'Foreign player'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE match_player_stats SET rating=9 WHERE id=r; RAISE EXCEPTION 'Rating overwritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM save_native_match_player_stats('00000000-0000-0000-0000-000000000031',m,'00000000-0000-0000-0000-000000000021',vals,NULL); RAISE EXCEPTION 'Cross-club creation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM match_player_stats WHERE id=r; RAISE EXCEPTION 'Physical deletion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM save_native_match_player_stats(r,m,p,vals,old); RAISE EXCEPTION 'Unauthorized administrator'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE match_player_stats SET rating=7.5;
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE old jsonb; BEGIN
 SELECT to_jsonb(s) INTO old FROM match_player_stats s LIMIT 1;
 PERFORM save_native_match_player_stats((old->>'id')::uuid,(old->>'match_id')::uuid,(old->>'player_id')::uuid,'{"goals":0,"assists":0,"minutes_played":0,"yellow_cards":0,"red_cards":0}',old);
 IF (SELECT count(*) FROM match_player_stats WHERE goals=0 AND rating=7.5)<>1 THEN RAISE EXCEPTION 'Reset lost rating/history'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF has_function_privilege('anon','public.save_native_match_player_stats(uuid,uuid,uuid,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous mutation'; END IF; END $$;
\echo Match stats: create/retry, snapshot correction, unchanged history/rating, ownership, validation and anonymous denial passed.
