CREATE OR REPLACE FUNCTION public.accept_club_membership_request(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.club_membership_requests;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO invitation FROM public.club_membership_requests WHERE id=request_id AND profile_id=auth.uid() FOR UPDATE;
 IF invitation.id IS NULL THEN RAISE EXCEPTION 'Invitation inaccessible' USING ERRCODE='42501'; END IF;
 IF invitation.status='accepted' THEN RETURN; END IF;
 IF invitation.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Cette invitation a déjà été traitée. Actualisez.' USING ERRCODE='40001'; END IF;
 UPDATE public.profiles SET linked_club_id=invitation.club_id,primary_role=invitation.requested_role WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profil inaccessible' USING ERRCODE='42501'; END IF;
 UPDATE public.club_membership_requests SET status='accepted',responded_at=now() WHERE id=invitation.id;
END $$;
REVOKE ALL ON FUNCTION public.accept_club_membership_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_club_membership_request(uuid) TO authenticated;
CREATE FUNCTION public.guard_native_membership_request() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT coalesce(public.is_club_admin(NEW.club_id),false) OR NEW.invited_by IS DISTINCT FROM auth.uid() OR NEW.status IS DISTINCT FROM 'pending' OR NEW.responded_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid invitation creation' USING ERRCODE='42501'; END IF;
 ELSE
  IF OLD.profile_id IS DISTINCT FROM auth.uid() OR OLD.status IS DISTINCT FROM 'pending' OR NEW.status IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'Use the acceptance action or reject a pending invitation' USING ERRCODE='42501'; END IF;
  IF (to_jsonb(NEW)-ARRAY['status','responded_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','responded_at','updated_at']) THEN RAISE EXCEPTION 'Invitation identity and proposed role are immutable' USING ERRCODE='42501'; END IF;
  NEW.responded_at:=now();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_membership_request() FROM PUBLIC,anon;
CREATE TRIGGER native_membership_request_integrity BEFORE INSERT OR UPDATE ON public.club_membership_requests FOR EACH ROW EXECUTE FUNCTION public.guard_native_membership_request();
