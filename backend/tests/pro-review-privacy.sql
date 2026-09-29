\set ON_ERROR_STOP on
\ir pro-authority.sql
CREATE FUNCTION public.fn_native_pro_owner(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.pro_pages WHERE id=p_id AND owner_id=auth.uid()) $$;
ALTER TABLE public.pro_pages ADD COLUMN published boolean NOT NULL DEFAULT true;
ALTER TABLE public.pro_pages ADD COLUMN request_message text;
CREATE POLICY page_public ON public.pro_pages FOR SELECT USING(published);
SET ROLE postgres;
SET request.jwt.claim.sub='';
UPDATE public.pro_pages SET request_message='Existing request',verification_notes='Existing note';
\ir ../migrations/20260908015000_native_pro_review_privacy.sql
SET ROLE anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pro_pages) THEN RAISE EXCEPTION 'Public page lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_pages WHERE request_message IS NOT NULL OR verification_notes IS NOT NULL) THEN RAISE EXCEPTION 'Public text leak'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_page_review_details) THEN RAISE EXCEPTION 'Anonymous private read'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.pro_page_review_details) THEN RAISE EXCEPTION 'Member private read'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pro_page_review_details WHERE request_message='Existing request' AND verification_notes='Existing note') THEN RAISE EXCEPTION 'Owner data not preserved'; END IF;
 UPDATE public.pro_pages SET request_message='Updated request';
 IF NOT EXISTS(SELECT 1 FROM public.pro_page_review_details WHERE request_message='Updated request' AND verification_notes='Existing note') THEN RAISE EXCEPTION 'Request update lost review'; END IF;
 UPDATE public.pro_pages SET request_message='';
 IF EXISTS(SELECT 1 FROM public.pro_page_review_details WHERE request_message IS NOT NULL) THEN RAISE EXCEPTION 'Explicit clear failed'; END IF;
 BEGIN UPDATE public.pro_pages SET verification_notes='Forged'; RAISE EXCEPTION 'Owner altered review'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.pro_page_review_details SET verification_notes='Forged'; RAISE EXCEPTION 'Direct private write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.pro_pages(id,owner_id,club_id,request_message) VALUES('10000000-0000-0000-0000-000000000002',auth.uid(),'20000000-0000-0000-0000-000000000002','New private request');
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.review_pro_page(id,'approved','Private approval',updated_at) FROM public.pro_pages WHERE id='10000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pro_page_review_details WHERE verification_notes='Private approval') THEN RAISE EXCEPTION 'Review note lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_pages WHERE request_message IS NOT NULL OR verification_notes IS NOT NULL) THEN RAISE EXCEPTION 'Approval exposed text'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
UPDATE public.pro_pages SET club_id='20000000-0000-0000-0000-000000000003' WHERE id='10000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.pro_page_review_details WHERE page_id='10000000-0000-0000-0000-000000000001' AND (verification_notes IS NOT NULL OR request_message IS NOT NULL)) THEN RAISE EXCEPTION 'Old identity retained review'; END IF; END $$;
RESET ROLE;
SELECT 'Pro review privacy: migration, public masking, owner/admin reads, private writes and identity reset passed' AS result;
