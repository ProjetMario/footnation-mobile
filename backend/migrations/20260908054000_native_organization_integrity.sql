CREATE FUNCTION public.guard_native_organization_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Créateur authentifié requis.' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  NEW.verified:=false;
  NEW.created_at:=now();
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.verified IS DISTINCT FROM OLD.verified THEN
   RAISE EXCEPTION 'Identité et vérification gérées par le serveur.' USING ERRCODE='42501';
  END IF;
  IF ROW(NEW.name,NEW.type,NEW.website,NEW.address,NEW.contact_email,NEW.department) IS DISTINCT FROM ROW(OLD.name,OLD.type,OLD.website,OLD.address,OLD.contact_email,OLD.department) THEN NEW.verified:=false; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_organization_integrity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER native_organization_integrity BEFORE INSERT OR UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.guard_native_organization_integrity();
