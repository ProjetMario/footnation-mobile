CREATE FUNCTION public.set_native_club_status(p_club_id uuid, p_key text, p_value boolean, p_expected boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_metadata jsonb; old_value jsonb; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_site_admin(),false) THEN
  RAISE EXCEPTION 'Seule l’administration FootNation peut modifier ces statuts.' USING ERRCODE='42501';
 END IF;
 IF p_key IS NULL OR p_key NOT IN ('is_verified','is_suspended') OR p_value IS NULL THEN
  RAISE EXCEPTION 'Statut invalide.' USING ERRCODE='22023';
 END IF;
 SELECT metadata INTO current_metadata FROM public.fff_clubs WHERE id=p_club_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Club introuvable.' USING ERRCODE='P0002'; END IF;
 current_metadata := coalesce(current_metadata,'{}'::jsonb);
 IF jsonb_typeof(current_metadata) <> 'object' THEN RAISE EXCEPTION 'Métadonnées du club invalides.' USING ERRCODE='22023'; END IF;
 old_value := current_metadata->p_key;
 -- A repeated decision is harmless and never replaces other metadata.
 IF old_value = to_jsonb(p_value) THEN RETURN current_metadata; END IF;
 IF coalesce(old_value,'null'::jsonb) IS DISTINCT FROM coalesce(to_jsonb(p_expected),'null'::jsonb) THEN
  RAISE EXCEPTION 'Ce statut a changé. Actualisez avant de réessayer.' USING ERRCODE='40001';
 END IF;
 result := jsonb_set(current_metadata,ARRAY[p_key],to_jsonb(p_value),true);
 UPDATE public.fff_clubs SET metadata=result WHERE id=p_club_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_native_club_status(uuid,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_native_club_status(uuid,text,boolean,boolean) TO authenticated;
