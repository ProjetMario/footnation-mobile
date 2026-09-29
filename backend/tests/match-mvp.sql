\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE club_matches(id uuid PRIMARY KEY,club_id uuid,status text);
CREATE TABLE club_players(id uuid PRIMARY KEY,club_id uuid,name text,category text,position text,jersey_number integer,is_active boolean);
CREATE TABLE match_player_stats(match_id uuid REFERENCES club_matches,player_id uuid REFERENCES club_players);
CREATE TABLE match_mvp_votes(id uuid PRIMARY KEY,match_id uuid REFERENCES club_matches,voter_id uuid,player_id uuid REFERENCES club_players,created_at timestamptz DEFAULT now(),UNIQUE(match_id,voter_id));
ALTER TABLE match_mvp_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read ON match_mvp_votes FOR SELECT USING(true);
CREATE POLICY own_vote ON match_mvp_votes FOR INSERT WITH CHECK(voter_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated;
GRANT INSERT ON match_mvp_votes TO authenticated;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908042000_native_match_mvp.sql
INSERT INTO club_matches VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000100','finished');
INSERT INTO club_players VALUES
('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000100','Actif','Senior',NULL,9,true),
('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000100','Ancien','Senior',NULL,10,false),
('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000101','Autre club','Senior',NULL,11,true);
SET ROLE anon;
DO $$ DECLARE m uuid:='00000000-0000-0000-0000-000000000010'; c uuid:='00000000-0000-0000-0000-000000000100'; BEGIN
 IF (SELECT count(*) FROM get_native_match_mvp_candidates(m,c,0))<>1 THEN RAISE EXCEPTION 'Active fallback'; END IF;
 IF EXISTS(SELECT 1 FROM get_native_match_mvp_candidates(m,c,1)) THEN RAISE EXCEPTION 'Pagination'; END IF;
 BEGIN PERFORM get_native_match_mvp_candidates(m,c,-1); RAISE EXCEPTION 'Negative offset'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF native_match_mvp_eligible(m,'00000000-0000-0000-0000-000000000022') THEN RAISE EXCEPTION 'Foreign candidate'; END IF;
 BEGIN PERFORM get_native_match_mvp_candidates(m,'00000000-0000-0000-0000-000000000101',0); RAISE EXCEPTION 'Wrong club'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_function_privilege('anon','public.cast_native_match_mvp_vote(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous vote'; END IF;
END $$;
RESET ROLE;
INSERT INTO match_player_stats VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000021');
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE m uuid:='00000000-0000-0000-0000-000000000010'; p uuid:='00000000-0000-0000-0000-000000000021'; r uuid:='00000000-0000-0000-0000-000000000030'; BEGIN
 IF (SELECT id FROM get_native_match_mvp_candidates(m,'00000000-0000-0000-0000-000000000100',0))<>p THEN RAISE EXCEPTION 'Historical participant'; END IF;
 BEGIN INSERT INTO match_mvp_votes(id,match_id,voter_id,player_id) VALUES(r,m,auth.uid(),'00000000-0000-0000-0000-000000000020'); RAISE EXCEPTION 'Non participant direct vote'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM cast_native_match_mvp_vote(r,m,p);
 PERFORM cast_native_match_mvp_vote(r,m,p);
 IF (SELECT count(*) FROM match_mvp_votes)<>1 THEN RAISE EXCEPTION 'Duplicate retry'; END IF;
 IF (SELECT vote_count FROM get_native_match_mvp_candidates(m,'00000000-0000-0000-0000-000000000100',0))<>1 THEN RAISE EXCEPTION 'Wrong count'; END IF;
 BEGIN PERFORM cast_native_match_mvp_vote(r,m,'00000000-0000-0000-0000-000000000020'); RAISE EXCEPTION 'Changed ballot'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET ROLE; UPDATE club_matches SET status='scheduled';
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM cast_native_match_mvp_vote('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000021'); RAISE EXCEPTION 'Unfinished match'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
\echo MVP: published match status, eligible club players, historical participation, counts, one vote and retry passed.
