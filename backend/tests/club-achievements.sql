\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_club_admin(cid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND cid='10000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE fff_clubs(id uuid PRIMARY KEY,achievements jsonb);
INSERT INTO fff_clubs VALUES('10000000-0000-0000-0000-000000000001','{"titles":["Legacy title"]}'),('10000000-0000-0000-0000-000000000002','{}');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
\ir ../migrations/20260908020000_native_club_achievements.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO club_achievements(club_id,title,competition,year) VALUES('10000000-0000-0000-0000-000000000001','Champion','League',2026);
DO $$ BEGIN
 BEGIN UPDATE club_achievements SET club_id='10000000-0000-0000-0000-000000000002'; RAISE EXCEPTION 'Cross-club move'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_achievements(club_id,title,competition,year) VALUES('10000000-0000-0000-0000-000000000001',' ','League',2026); RAISE EXCEPTION 'Empty title'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE club_achievements SET year=10000; RAISE EXCEPTION 'Invalid year'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE club_achievements SET description='Preserved detail'; IF NOT FOUND THEN RAISE EXCEPTION 'Admin update'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN INSERT INTO club_achievements(club_id,title,competition,year) VALUES('10000000-0000-0000-0000-000000000001','Fake','Fake',2026); RAISE EXCEPTION 'Third-party insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM club_achievements; IF FOUND THEN RAISE EXCEPTION 'Third-party deletion'; END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM club_achievements)<>1 THEN RAISE EXCEPTION 'Public read'; END IF;
 BEGIN UPDATE club_achievements SET title='Fake'; RAISE EXCEPTION 'Anonymous update'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DELETE FROM club_achievements;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM fff_clubs WHERE achievements->'titles'='["Legacy title"]'::jsonb) THEN RAISE EXCEPTION 'Legacy data changed'; END IF; END $$;
\echo Club achievements: public read, admin CRUD, validation, club boundaries and legacy preservation passed.
