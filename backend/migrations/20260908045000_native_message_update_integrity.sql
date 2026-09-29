CREATE FUNCTION public.guard_native_message_update() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE allowed text[]:=ARRAY['read_at']; admin boolean;
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 admin:=coalesce(public.is_site_admin(),false);
 IF admin THEN allowed:=allowed||ARRAY['is_blocked','blocked_reason','blocked_at','blocked_by']; END IF;
 IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN
  RAISE EXCEPTION 'Message identity and content cannot be changed' USING ERRCODE='42501';
 END IF;
 IF NEW.read_at IS DISTINCT FROM OLD.read_at THEN
  IF OLD.receiver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the recipient can mark a message read' USING ERRCODE='42501'; END IF;
  IF NEW.read_at IS NOT NULL THEN NEW.read_at:=coalesce(OLD.read_at,now()); END IF;
 END IF;
 IF admin AND ROW(NEW.is_blocked,NEW.blocked_reason,NEW.blocked_at,NEW.blocked_by) IS DISTINCT FROM ROW(OLD.is_blocked,OLD.blocked_reason,OLD.blocked_at,OLD.blocked_by) THEN
  IF coalesce(NEW.is_blocked,false) THEN NEW.blocked_by:=auth.uid(); NEW.blocked_at:=now();
  ELSE NEW.blocked_by:=NULL; NEW.blocked_at:=NULL; NEW.blocked_reason:=NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_message_update() FROM PUBLIC,anon;
CREATE TRIGGER native_message_update_integrity BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_native_message_update();
