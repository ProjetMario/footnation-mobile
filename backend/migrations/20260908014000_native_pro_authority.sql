SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.fn_native_guard_pro_authority() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.fn_native_verification_admin() OR (auth.uid() IS NULL AND
  (current_setting('role',true) IN ('postgres','service_role','supabase_admin') OR
   (current_setting('role',true)='none' AND session_user IN ('postgres','supabase_admin')))) THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.owner_id<>auth.uid() OR NEW.verification_status NOT IN ('draft','pending_review') OR NEW.featured
   OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.verification_notes IS NOT NULL THEN
   RAISE EXCEPTION 'Only FootNation can certify a page' USING ERRCODE='42501';
  END IF;
  IF NEW.verification_status='draft' THEN NEW.verification_requested_at:=NULL; END IF;
 ELSE
  IF OLD.owner_id<>auth.uid() OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
   OR NEW.featured IS DISTINCT FROM OLD.featured OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
   OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes THEN
   RAISE EXCEPTION 'Only FootNation can change review authority' USING ERRCODE='42501';
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status AND
   NOT (OLD.verification_status IN ('draft','rejected') AND NEW.verification_status='pending_review') THEN
   RAISE EXCEPTION 'Only FootNation can decide a review' USING ERRCODE='42501';
  END IF;
  IF NEW.verification_status=OLD.verification_status AND NEW.verification_requested_at IS DISTINCT FROM OLD.verification_requested_at THEN
   RAISE EXCEPTION 'Request date cannot be rewritten' USING ERRCODE='42501';
  END IF;
  IF (NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.page_type IS DISTINCT FROM OLD.page_type)
   AND OLD.verification_status IN ('approved','pending_review','rejected') THEN
   NEW.verification_status:='draft'; NEW.verification_requested_at:=NULL;
   NEW.reviewed_at:=NULL; NEW.reviewed_by:=NULL; NEW.verification_notes:=NULL;
  END IF;
 END IF;
 IF NEW.verification_status='pending_review' THEN
  IF NEW.page_type<>'club_officiel' OR NEW.club_id IS NULL THEN
   RAISE EXCEPTION 'An official linked club is required' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
   NEW.verification_requested_at:=clock_timestamp();
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_native_guard_pro_authority() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fn_native_guard_pro_authority BEFORE INSERT OR UPDATE ON public.pro_pages FOR EACH ROW EXECUTE FUNCTION public.fn_native_guard_pro_authority();
CREATE POLICY native_pro_review_admin_read ON public.pro_pages FOR SELECT TO authenticated USING(public.fn_native_verification_admin());
CREATE FUNCTION public.review_pro_page(p_id uuid,p_decision text,p_notes text,p_expected_updated_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE page public.pro_pages%ROWTYPE;
BEGIN
 IF NOT public.fn_native_verification_admin() THEN RAISE EXCEPTION 'FootNation administrator required' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR length(coalesce(p_notes,''))>3000 THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='22023'; END IF;
 SELECT * INTO page FROM public.pro_pages WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Page not found' USING ERRCODE='P0002'; END IF;
 IF page.verification_status=p_decision THEN RETURN p_decision; END IF;
 IF page.verification_status<>'pending_review' OR p_expected_updated_at IS NULL OR page.updated_at IS DISTINCT FROM p_expected_updated_at THEN
  RAISE EXCEPTION 'Page changed; reload before review' USING ERRCODE='40001';
 END IF;
 IF p_decision='approved' AND (page.page_type<>'club_officiel' OR page.club_id IS NULL) THEN RAISE EXCEPTION 'Official linked club required' USING ERRCODE='23514'; END IF;
 UPDATE public.pro_pages SET verification_status=p_decision,verification_notes=nullif(btrim(p_notes),''),reviewed_at=clock_timestamp(),reviewed_by=auth.uid() WHERE id=p_id;
 RETURN p_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.review_pro_page(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_pro_page(uuid,text,text,timestamptz) TO authenticated;
