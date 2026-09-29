-- Restore the profile workflows expected by FootNation, without backfilling user data.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text,
 ADD COLUMN IF NOT EXISTS verification_status text,
 ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
 ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.verification_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 identity_document_url text NOT NULL,
 supporting_document_url text NOT NULL,
 transfermarkt_url text,
 notability_description text,
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 reviewer_notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_requests_profile_id_idx ON public.verification_requests(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS verification_requests_one_pending_idx ON public.verification_requests(profile_id) WHERE status='pending';
CREATE OR REPLACE FUNCTION public.fn_native_verification_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=true);
$$;
REVOKE ALL ON FUNCTION public.fn_native_verification_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_native_verification_admin() TO authenticated;
-- A profile owner may edit their identity, but may not grant their own admin or verification badge.
CREATE OR REPLACE FUNCTION public.fn_native_guard_profile_authority()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.fn_native_verification_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF coalesce(NEW.is_admin,false) OR coalesce(NEW.is_verified,false) OR NEW.verification_status='verified' THEN
   RAISE EXCEPTION 'Only site administrators can assign account authority' USING ERRCODE='42501';
  END IF;
 ELSE
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
   OR (NEW.verification_status='verified' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status) THEN
   RAISE EXCEPTION 'Only site administrators can assign account authority' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fn_native_guard_profile_authority ON public.profiles;
CREATE TRIGGER fn_native_guard_profile_authority BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_native_guard_profile_authority();
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.verification_requests TO authenticated;
REVOKE ALL ON public.verification_requests FROM anon;
DROP POLICY IF EXISTS verification_requests_user_select ON public.verification_requests;
CREATE POLICY verification_requests_user_select ON public.verification_requests FOR SELECT TO authenticated USING(profile_id=auth.uid() OR public.fn_native_verification_admin());
DROP POLICY IF EXISTS verification_requests_user_insert ON public.verification_requests;
CREATE POLICY verification_requests_user_insert ON public.verification_requests FOR INSERT TO authenticated WITH CHECK(
 profile_id=auth.uid() AND status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL AND reviewer_notes IS NULL
 AND split_part(identity_document_url,'/',1)=auth.uid()::text AND split_part(supporting_document_url,'/',1)=auth.uid()::text
);
DROP POLICY IF EXISTS verification_requests_admin_update ON public.verification_requests;
CREATE POLICY verification_requests_admin_update ON public.verification_requests FOR UPDATE TO authenticated USING(public.fn_native_verification_admin()) WITH CHECK(public.fn_native_verification_admin());
CREATE OR REPLACE FUNCTION public.review_profile_verification(p_request_id uuid,p_status text,p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF NOT public.fn_native_verification_admin() THEN RAISE EXCEPTION 'Site administrator required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('approved','rejected') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid review status' USING ERRCODE='22023'; END IF;
 SELECT profile_id INTO target FROM public.verification_requests WHERE id=p_request_id FOR UPDATE;
 IF target IS NULL THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='22023'; END IF;
 UPDATE public.verification_requests SET status=p_status,reviewer_notes=nullif(left(p_notes,3000),''),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() WHERE id=p_request_id;
 UPDATE public.profiles SET is_verified=(p_status='approved'),verification_status=CASE WHEN p_status='approved' THEN 'verified' ELSE 'rejected' END,verification_reviewed_at=now() WHERE id=target;
END;
$$;
REVOKE ALL ON FUNCTION public.review_profile_verification(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_profile_verification(uuid,text,text) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('verification-documents','verification-documents',false,5242880,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE OR REPLACE FUNCTION public.fn_native_verification_document_referenced(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.verification_requests WHERE identity_document_url=p_path OR supporting_document_url=p_path);
$$;
REVOKE ALL ON FUNCTION public.fn_native_verification_document_referenced(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_native_verification_document_referenced(text) TO authenticated;
DROP POLICY IF EXISTS verification_documents_select ON storage.objects;
CREATE POLICY verification_documents_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='verification-documents' AND (split_part(name,'/',1)=auth.uid()::text OR public.fn_native_verification_admin()));
DROP POLICY IF EXISTS verification_documents_insert ON storage.objects;
CREATE POLICY verification_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='verification-documents' AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name));
DROP POLICY IF EXISTS verification_documents_update ON storage.objects;
CREATE POLICY verification_documents_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='verification-documents' AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name)) WITH CHECK(bucket_id='verification-documents' AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name));
DROP POLICY IF EXISTS verification_documents_delete ON storage.objects;
CREATE POLICY verification_documents_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='verification-documents' AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name));
NOTIFY pgrst,'reload schema';
-- Restrictive boundaries also apply when older, broader storage policies exist.
GRANT EXECUTE ON FUNCTION public.fn_native_verification_admin() TO anon;
DROP POLICY IF EXISTS verification_documents_read_boundary ON storage.objects;
CREATE POLICY verification_documents_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING(bucket_id <> 'verification-documents' OR (auth.uid() IS NOT NULL AND (split_part(name,'/',1)=auth.uid()::text OR public.fn_native_verification_admin())));
DROP POLICY IF EXISTS verification_documents_insert_boundary ON storage.objects;
CREATE POLICY verification_documents_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(bucket_id <> 'verification-documents' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name)));
DROP POLICY IF EXISTS verification_documents_update_boundary ON storage.objects;
CREATE POLICY verification_documents_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id <> 'verification-documents' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name))) WITH CHECK(bucket_id <> 'verification-documents' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name)));
DROP POLICY IF EXISTS verification_documents_delete_boundary ON storage.objects;
CREATE POLICY verification_documents_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(bucket_id <> 'verification-documents' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text AND NOT public.fn_native_verification_document_referenced(name)));
