\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_admin boolean NOT NULL DEFAULT false);
INSERT INTO public.profiles VALUES('00000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-000000000002',false),('00000000-0000-0000-0000-000000000003',false);
CREATE FUNCTION public.fn_native_verification_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin) $$;
CREATE TABLE public.pro_pages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,name text,page_type text NOT NULL DEFAULT 'club_officiel',club_id uuid,verification_status text NOT NULL DEFAULT 'draft',verification_requested_at timestamptz,verification_notes text,reviewed_at timestamptz,reviewed_by uuid,featured boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.pro_pages ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE ON public.pro_pages TO authenticated,anon;
CREATE POLICY own_page ON public.pro_pages TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY legacy_anon_insert ON public.pro_pages FOR INSERT TO anon WITH CHECK(true);
CREATE FUNCTION public.test_timestamp() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at:=clock_timestamp();RETURN NEW;END $$;
CREATE TRIGGER timestamp BEFORE UPDATE ON public.pro_pages FOR EACH ROW EXECUTE FUNCTION public.test_timestamp();
\ir ../migrations/20260908014000_native_pro_authority.sql
SET ROLE anon;
DO $$ BEGIN
 BEGIN INSERT INTO public.pro_pages(owner_id,verification_status) VALUES('00000000-0000-0000-0000-000000000002','approved'); RAISE EXCEPTION 'Anonymous authority insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
INSERT INTO public.pro_pages(id,owner_id,club_id,name) VALUES('10000000-0000-0000-0000-000000000001',auth.uid(),'20000000-0000-0000-0000-000000000001','Original');
DO $$ BEGIN
 BEGIN INSERT INTO public.pro_pages(owner_id,verification_status) VALUES(auth.uid(),'approved'); RAISE EXCEPTION 'Self-certified insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.pro_pages SET verification_status='approved'; RAISE EXCEPTION 'Self-certified update'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.pro_pages SET featured=true; RAISE EXCEPTION 'Self-featured page'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.pro_pages SET verification_notes='Forged'; RAISE EXCEPTION 'Forged reviewer note'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.review_pro_page('10000000-0000-0000-0000-000000000001','approved',null,now()); RAISE EXCEPTION 'Owner RPC review'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.pro_pages SET name='Updated',verification_status='pending_review',verification_requested_at='2000-01-01';
 IF EXISTS(SELECT 1 FROM public.pro_pages WHERE verification_requested_at<'2026-01-01') THEN RAISE EXCEPTION 'Forged request date'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE version timestamptz; BEGIN
 SELECT updated_at INTO version FROM public.pro_pages WHERE id='10000000-0000-0000-0000-000000000001';
 IF version IS NULL THEN RAISE EXCEPTION 'Admin cannot read private request'; END IF;
 BEGIN PERFORM public.review_pro_page('10000000-0000-0000-0000-000000000001','approved',null,version-interval '1 second'); RAISE EXCEPTION 'Stale decision'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM public.review_pro_page('10000000-0000-0000-0000-000000000001','approved','Checked',version);
 PERFORM public.review_pro_page('10000000-0000-0000-0000-000000000001','approved','Do not replace',version);
 IF NOT EXISTS(SELECT 1 FROM public.pro_pages WHERE verification_status='approved' AND verification_notes='Checked' AND reviewed_by=auth.uid() AND reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'Incomplete admin decision'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
UPDATE public.pro_pages SET name='Normal edit';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pro_pages WHERE verification_status='approved') THEN RAISE EXCEPTION 'Normal edit revoked certification'; END IF;
 UPDATE public.pro_pages SET club_id='20000000-0000-0000-0000-000000000002';
 IF NOT EXISTS(SELECT 1 FROM public.pro_pages WHERE verification_status='draft' AND reviewed_by IS NULL AND verification_requested_at IS NULL) THEN RAISE EXCEPTION 'Certification transferred to another club'; END IF;
 UPDATE public.pro_pages SET verification_status='pending_review';
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 BEGIN PERFORM public.review_pro_page('10000000-0000-0000-0000-000000000001','rejected',null,now()); RAISE EXCEPTION 'Third-party review'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.pro_pages) THEN RAISE EXCEPTION 'Private page exposed'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.review_pro_page(id,'rejected','More evidence needed',updated_at) FROM public.pro_pages;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
UPDATE public.pro_pages SET verification_status='pending_review';
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pro_pages WHERE verification_status='pending_review') THEN RAISE EXCEPTION 'Resubmission failed'; END IF;
 IF has_function_privilege('anon','public.review_pro_page(uuid,text,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC grant'; END IF;
END $$;
CREATE ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public,auth TO service_role;
GRANT SELECT,UPDATE ON public.pro_pages TO service_role;
SET ROLE service_role;
SET request.jwt.claim.sub='';
UPDATE public.pro_pages SET featured=true;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.pro_pages WHERE featured) THEN RAISE EXCEPTION 'Trusted server update blocked'; END IF; END $$;
SELECT 'Pro authority: owner requests, admin decisions, retries, stale writes and identity reset passed' AS result;
