\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, bio text, is_admin boolean DEFAULT false, is_verified boolean DEFAULT false);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
CREATE POLICY own_profile ON public.profiles TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
CREATE POLICY legacy_broad_storage ON storage.objects USING(true) WITH CHECK(true);
INSERT INTO public.profiles(id,is_admin) VALUES ('00000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-000000000002',false),('00000000-0000-0000-0000-000000000003',false);
\ir ../migrations/20260908011000_native_profile_workflows.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 UPDATE public.profiles SET bio='Normal edit' WHERE id=auth.uid();
 BEGIN UPDATE public.profiles SET is_admin=true WHERE id=auth.uid(); RAISE EXCEPTION 'Self admin grant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.profiles SET is_verified=true WHERE id=auth.uid(); RAISE EXCEPTION 'Self verification grant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.profiles SET verification_status='verified' WHERE id=auth.uid(); RAISE EXCEPTION 'Self verified status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO storage.objects(bucket_id,name) VALUES ('verification-documents',auth.uid()::text||'/identities/id.pdf'),('verification-documents',auth.uid()::text||'/supporting/proof.pdf');
 BEGIN
 INSERT INTO public.verification_requests(profile_id,status,identity_document_url,supporting_document_url) VALUES(auth.uid(),'approved',auth.uid()::text||'/identities/id.pdf',auth.uid()::text||'/supporting/proof.pdf');
 RAISE EXCEPTION 'Self approved request'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.verification_requests(id,profile_id,identity_document_url,supporting_document_url) VALUES('30000000-0000-0000-0000-000000000001',auth.uid(),auth.uid()::text||'/identities/id.pdf',auth.uid()::text||'/supporting/proof.pdf');
 DELETE FROM storage.objects WHERE bucket_id='verification-documents';
 IF (SELECT count(*) FROM storage.objects) <> 2 THEN RAISE EXCEPTION 'Referenced evidence can be deleted'; END IF;
 UPDATE storage.objects SET name=auth.uid()::text||'/changed.pdf' WHERE name LIKE '%/identities/%';
 IF EXISTS(SELECT 1 FROM storage.objects WHERE name LIKE '%changed.pdf') THEN RAISE EXCEPTION 'Referenced evidence can be altered'; END IF;
 BEGIN PERFORM public.review_profile_verification('30000000-0000-0000-0000-000000000001','approved',null); RAISE EXCEPTION 'Self review permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.verification_requests) THEN RAISE EXCEPTION 'Stranger sees requests'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='verification-documents') THEN RAISE EXCEPTION 'Stranger sees documents'; END IF;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('verification-documents','00000000-0000-0000-0000-000000000002/forged.pdf'); RAISE EXCEPTION 'Stranger uploads for another user'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET ROLE anon;
SET request.jwt.claim.sub='';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='verification-documents') THEN RAISE EXCEPTION 'Anonymous evidence exposure'; END IF; END $$;
RESET ROLE;
CREATE FUNCTION public.fail_profile_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.is_verified THEN RAISE EXCEPTION 'Simulated profile write failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_failure BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fail_profile_review();
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN PERFORM public.review_profile_verification('30000000-0000-0000-0000-000000000001','approved','Reviewed'); EXCEPTION WHEN raise_exception THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.verification_requests WHERE status='pending') THEN RAISE EXCEPTION 'Review did not roll back atomically'; END IF;
 IF (SELECT count(*) FROM storage.objects) <> 2 THEN RAISE EXCEPTION 'Admin cannot read evidence'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER test_failure ON public.profiles;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.review_profile_verification('30000000-0000-0000-0000-000000000001','approved','Reviewed');
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000002' AND is_verified AND verification_status='verified') THEN RAISE EXCEPTION 'Profile review incomplete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.verification_requests WHERE status='approved' AND reviewed_by='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Review attribution incomplete'; END IF;
END $$;
DO $$ BEGIN IF has_function_privilege('anon','public.review_profile_verification(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous review grant'; END IF; END $$;
SELECT 'Profile verification and evidence privacy assertions passed' AS result;
