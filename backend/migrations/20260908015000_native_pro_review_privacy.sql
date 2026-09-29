SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.pro_pages IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.pro_page_review_details (
 page_id uuid PRIMARY KEY REFERENCES public.pro_pages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 request_message text,
 verification_notes text
);
ALTER TABLE public.pro_page_review_details ENABLE ROW LEVEL SECURITY;
-- Anonymous selects return no rows, which also permits safe left joins on public pages.
REVOKE ALL ON public.pro_page_review_details FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pro_page_review_details TO anon,authenticated;
CREATE POLICY native_pro_review_private_read ON public.pro_page_review_details FOR SELECT USING(
 auth.uid() IS NOT NULL AND (public.fn_native_verification_admin() OR public.fn_native_pro_owner(page_id))
);
INSERT INTO public.pro_page_review_details(page_id,request_message,verification_notes)
 SELECT id,request_message,verification_notes FROM public.pro_pages WHERE request_message IS NOT NULL OR verification_notes IS NOT NULL;
UPDATE public.pro_pages SET request_message=NULL,verification_notes=NULL WHERE request_message IS NOT NULL OR verification_notes IS NOT NULL;
CREATE FUNCTION public.fn_native_capture_pro_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reset_identity boolean:=false;
BEGIN
 IF TG_OP='UPDATE' THEN reset_identity:=NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.page_type IS DISTINCT FROM OLD.page_type; END IF;
 IF NEW.request_message IS NOT NULL OR NEW.verification_notes IS NOT NULL OR reset_identity THEN
  INSERT INTO public.pro_page_review_details(page_id,request_message,verification_notes)
  VALUES(NEW.id,nullif(btrim(NEW.request_message),''),nullif(btrim(NEW.verification_notes),''))
  ON CONFLICT(page_id) DO UPDATE SET
   request_message=CASE WHEN NEW.request_message IS NOT NULL OR reset_identity THEN excluded.request_message ELSE pro_page_review_details.request_message END,
   verification_notes=CASE WHEN NEW.verification_notes IS NOT NULL OR reset_identity THEN excluded.verification_notes ELSE pro_page_review_details.verification_notes END;
 END IF;
 NEW.request_message:=NULL;NEW.verification_notes:=NULL;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_native_capture_pro_review() FROM PUBLIC,anon,authenticated;
-- Runs after the authority guard, so the submitted fields are checked before being hidden.
CREATE TRIGGER zz_native_capture_pro_review BEFORE INSERT OR UPDATE ON public.pro_pages FOR EACH ROW EXECUTE FUNCTION public.fn_native_capture_pro_review();
CREATE OR REPLACE FUNCTION public.review_pro_page(p_id uuid,p_decision text,p_notes text,p_expected_updated_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE page public.pro_pages%ROWTYPE;
BEGIN
 IF NOT public.fn_native_verification_admin() THEN RAISE EXCEPTION 'FootNation administrator required' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR length(coalesce(p_notes,''))>3000 THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='22023'; END IF;
 SELECT * INTO page FROM public.pro_pages WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Page not found' USING ERRCODE='P0002'; END IF;
 IF page.verification_status=p_decision THEN RETURN p_decision; END IF;
 IF page.verification_status<>'pending_review' OR p_expected_updated_at IS NULL OR page.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Page changed; reload before review' USING ERRCODE='40001'; END IF;
 IF p_decision='approved' AND (page.page_type<>'club_officiel' OR page.club_id IS NULL) THEN RAISE EXCEPTION 'Official linked club required' USING ERRCODE='23514'; END IF;
 UPDATE public.pro_pages SET verification_status=p_decision,verification_notes=coalesce(p_notes,''),reviewed_at=clock_timestamp(),reviewed_by=auth.uid() WHERE id=p_id;
 RETURN p_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.review_pro_page(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_pro_page(uuid,text,text,timestamptz) TO authenticated;
