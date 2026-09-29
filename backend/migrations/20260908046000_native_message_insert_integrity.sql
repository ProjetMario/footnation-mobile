CREATE FUNCTION public.guard_native_message_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NEW.sender_id IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION 'The authenticated sender is required' USING ERRCODE='42501';
 END IF;
 NEW.created_at:=now();
 NEW.read_at:=NULL;
 NEW.is_blocked:=false;
 NEW.blocked_reason:=NULL;
 NEW.blocked_at:=NULL;
 NEW.blocked_by:=NULL;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_message_insert() FROM PUBLIC,anon;
CREATE TRIGGER native_message_insert_integrity BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_native_message_insert();
