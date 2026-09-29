CREATE FUNCTION public.guard_native_connection_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.connected_user_id=NEW.user_id OR NEW.status IS DISTINCT FROM 'pending' THEN
   RAISE EXCEPTION 'Only pending invitations from the current user are allowed' USING ERRCODE='42501';
  END IF;
  NEW.created_at:=now();
 ELSE
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Invitation identity is immutable' USING ERRCODE='42501'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (
   OLD.status='pending' AND NEW.status IN ('accepted','rejected') AND OLD.connected_user_id=auth.uid()
  ) IS NOT TRUE THEN RAISE EXCEPTION 'Only the recipient can answer a pending invitation' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_connection_consent() FROM PUBLIC,anon;
CREATE TRIGGER native_connection_consent BEFORE INSERT OR UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.guard_native_connection_consent();
