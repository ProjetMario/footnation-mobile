\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE club_news(id uuid PRIMARY KEY,club_id uuid,is_published boolean);
CREATE TABLE club_news_comments(id uuid PRIMARY KEY,news_id uuid REFERENCES club_news,author_id uuid,content text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE club_news_likes(id uuid PRIMARY KEY,news_id uuid REFERENCES club_news,user_id uuid,created_at timestamptz DEFAULT now());
ALTER TABLE club_news ENABLE ROW LEVEL SECURITY; ALTER TABLE club_news_comments ENABLE ROW LEVEL SECURITY; ALTER TABLE club_news_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_read ON club_news FOR SELECT USING(true);
CREATE POLICY comments_read ON club_news_comments FOR SELECT USING(true);
CREATE POLICY comments_insert ON club_news_comments FOR INSERT WITH CHECK(auth.uid()=author_id);
CREATE POLICY likes_read ON club_news_likes FOR SELECT USING(true);
CREATE POLICY likes_delete ON club_news_likes FOR DELETE USING(auth.uid()=user_id);
CREATE POLICY likes_insert ON club_news_likes FOR INSERT WITH CHECK(auth.uid()=user_id);
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated;
GRANT INSERT ON club_news_comments,club_news_likes TO authenticated;
GRANT DELETE ON club_news_likes TO authenticated;
ALTER TABLE club_news_likes ADD UNIQUE(news_id,user_id);
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908039000_native_club_news_comments.sql
INSERT INTO club_news VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000100',true),('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000100',false);
INSERT INTO club_news_comments(id,news_id,author_id,content) VALUES('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','Draft hidden');
INSERT INTO club_news_likes(id,news_id,user_id) VALUES('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001');
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r uuid:='00000000-0000-0000-0000-000000000020'; n uuid:='00000000-0000-0000-0000-000000000010'; c uuid:='00000000-0000-0000-0000-000000000100'; BEGIN
 PERFORM create_native_club_news_comment(r,n,c,'Bonjour');
 PERFORM create_native_club_news_comment(r,n,c,'Bonjour');
 IF (SELECT count(*) FROM club_news_comments)<>1 OR EXISTS(SELECT 1 FROM club_news_likes) THEN RAISE EXCEPTION 'Draft exposure or duplicate'; END IF;
 BEGIN PERFORM create_native_club_news_comment(r,n,c,'Different'); RAISE EXCEPTION 'Retry overwritten'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN PERFORM create_native_club_news_comment(r,n,'00000000-0000-0000-0000-000000000101','Bonjour'); RAISE EXCEPTION 'Wrong club'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM create_native_club_news_comment(r,n,c,' '); RAISE EXCEPTION 'Empty'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM create_native_club_news_comment(r,'00000000-0000-0000-0000-000000000011',c,'Bonjour'); RAISE EXCEPTION 'Draft write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_news_comments(id,news_id,author_id,content) VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000011',auth.uid(),'Direct'); RAISE EXCEPTION 'Direct draft comment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_news_likes(id,news_id,user_id) VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000011',auth.uid()); RAISE EXCEPTION 'Draft like'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM create_native_club_news_comment(r,n,c,'Bonjour'); RAISE EXCEPTION 'Another author'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET ROLE; SET ROLE anon;
DO $$ BEGIN IF has_function_privilege('anon','public.create_native_club_news_comment(uuid,uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution'; END IF; IF (SELECT count(*) FROM club_news_comments)<>1 THEN RAISE EXCEPTION 'Anonymous draft leak'; END IF; END $$;
RESET ROLE;
\echo Club comments: publication restriction, author identity, idempotent retry, conflicts and anonymous denial passed.

SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO club_news_likes(id,news_id,user_id) VALUES('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000010',auth.uid());
DO $$ BEGIN
 BEGIN INSERT INTO club_news_likes(id,news_id,user_id) VALUES('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000010',auth.uid()); RAISE EXCEPTION 'Duplicate reaction'; EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 DELETE FROM club_news_likes WHERE id='00000000-0000-0000-0000-000000000040';
 IF NOT EXISTS(SELECT 1 FROM club_news_likes WHERE id='00000000-0000-0000-0000-000000000040') THEN RAISE EXCEPTION 'Foreign removal'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 DELETE FROM club_news_likes WHERE id='00000000-0000-0000-0000-000000000040';
 IF EXISTS(SELECT 1 FROM club_news_likes WHERE id='00000000-0000-0000-0000-000000000040') THEN RAISE EXCEPTION 'Own removal failed'; END IF;
END $$;
RESET ROLE;
\echo Likes: uniqueness, own removal and other-user protection passed.
