\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage,auth TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
CREATE POLICY legacy_broad ON storage.objects USING(true) WITH CHECK(true);
\ir ../migrations/20260908013000_native_pro_media.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO storage.objects(bucket_id,name) VALUES('pro-pages',auth.uid()::text||'/content/photo.jpg');
DO $$ BEGIN
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('pro-pages','other/content/photo.jpg'); RAISE EXCEPTION 'Foreign upload allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE storage.objects SET name='other/content/photo.jpg' WHERE bucket_id='pro-pages'; RAISE EXCEPTION 'Foreign move allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE storage.objects SET name=auth.uid()::text||'/content/renamed.jpg' WHERE bucket_id='pro-pages';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name=auth.uid()::text||'/content/renamed.jpg') THEN RAISE EXCEPTION 'Owner cannot update upload'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
UPDATE storage.objects SET name=auth.uid()::text||'/stolen.jpg' WHERE bucket_id='pro-pages';
DELETE FROM storage.objects WHERE bucket_id='pro-pages';
DO $$ BEGIN IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Third party changed owner image'; END IF; END $$;
SET ROLE anon;
SET request.jwt.claim.sub='';
DO $$ BEGIN
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Public media unreadable'; END IF;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('pro-pages','anonymous/photo.jpg'); RAISE EXCEPTION 'Anonymous upload allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM storage.objects WHERE bucket_id='pro-pages';
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Anonymous delete allowed'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DELETE FROM storage.objects WHERE bucket_id='pro-pages';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.objects) THEN RAISE EXCEPTION 'Owner cannot remove upload'; END IF; END $$;
INSERT INTO storage.objects(bucket_id,name) VALUES('unrelated','legacy-object');
DELETE FROM storage.objects WHERE bucket_id='unrelated';
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='pro-pages' AND public AND file_size_limit=10485760 AND cardinality(allowed_mime_types)=5) THEN RAISE EXCEPTION 'Bucket configuration invalid'; END IF; END $$;
SELECT 'Pro media: public reads, owner writes, anonymous and cross-owner boundaries passed' AS result;
