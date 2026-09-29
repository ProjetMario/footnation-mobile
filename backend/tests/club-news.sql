\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE club_admins(club_id uuid,profile_id uuid);
CREATE FUNCTION public.is_club_admin(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000009'::uuid OR EXISTS(SELECT 1 FROM public.club_admins WHERE club_id=cid AND profile_id=auth.uid()) $$;
INSERT INTO club_admins VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
CREATE TABLE club_news(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid NOT NULL,author_id uuid,content text,is_published boolean DEFAULT true);
INSERT INTO club_news(id,club_id,content,is_published) VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Existing public content',true),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Draft',false);
ALTER TABLE club_news ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON club_news TO anon,authenticated;
CREATE POLICY published_read ON club_news FOR SELECT USING(is_published=true);
\ir ../migrations/20260908018000_native_club_news.sql
SET ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM club_news)<>1 THEN RAISE EXCEPTION 'Draft exposed'; END IF;
 BEGIN INSERT INTO club_news(club_id) VALUES('10000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'Anonymous insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE club_news SET content='Anonymous overwrite'; IF FOUND THEN RAISE EXCEPTION 'Anonymous update'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM club_news)<>1 THEN RAISE EXCEPTION 'Third-party draft'; END IF;
 BEGIN INSERT INTO club_news(club_id) VALUES('10000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'Third-party insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM club_news; IF FOUND THEN RAISE EXCEPTION 'Third-party delete'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM club_news)<>2 THEN RAISE EXCEPTION 'Admin draft unavailable'; END IF;
 INSERT INTO club_news(club_id,title,excerpt,content,is_published) VALUES('10000000-0000-0000-0000-000000000001','Title','Summary','Article',false);
 UPDATE club_news SET title='Updated title',is_published=true,published_at=now() WHERE content='Article'; IF NOT FOUND THEN RAISE EXCEPTION 'Admin update failed'; END IF;
 BEGIN UPDATE club_news SET club_id='10000000-0000-0000-0000-000000000002'; RAISE EXCEPTION 'Move to another club'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM club_news WHERE content='Article'; IF NOT FOUND THEN RAISE EXCEPTION 'Admin delete failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM club_news WHERE content='Existing public content' AND title IS NULL AND excerpt IS NULL AND published_at IS NULL) THEN RAISE EXCEPTION 'Existing content changed'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000009';
INSERT INTO club_news(club_id,title) VALUES('10000000-0000-0000-0000-000000000002','Site admin article');
\echo Club news: original content, drafts, admin CRUD, third-party denial and club boundaries passed.
