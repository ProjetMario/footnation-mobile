CREATE FUNCTION public.get_native_member_convocations(p_offset integer DEFAULT 0,p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid,status text,responded_at timestamptz,convocation jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>30 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT cp.id,cp.status,cp.responded_at,jsonb_build_object('id',c.id,'title',c.title,'meeting_date',c.meeting_date,'meeting_location',c.meeting_location,'description',c.description,'club_id',c.club_id)
 FROM public.club_convocation_players cp JOIN public.club_players p ON p.id=cp.player_id JOIN public.club_convocations c ON c.id=cp.convocation_id AND c.club_id=p.club_id
 WHERE p.profile_id=auth.uid()
 ORDER BY c.meeting_date DESC NULLS LAST,cp.created_at DESC NULLS LAST,cp.id
 LIMIT p_limit OFFSET p_offset;
END $$;
CREATE FUNCTION public.respond_native_member_convocation(p_id uuid,p_status text,p_expected_status text,p_expected_responded_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing public.club_convocation_players;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('accepted','declined') OR p_expected_status IS NULL THEN RAISE EXCEPTION 'Invalid response' USING ERRCODE='22023'; END IF;
 SELECT cp.* INTO existing FROM public.club_convocation_players cp JOIN public.club_players p ON p.id=cp.player_id JOIN public.club_convocations c ON c.id=cp.convocation_id AND c.club_id=p.club_id
 WHERE cp.id=p_id AND p.profile_id=auth.uid() FOR UPDATE OF cp;
 IF existing.id IS NULL THEN RAISE EXCEPTION 'Convocation inaccessible' USING ERRCODE='42501'; END IF;
 IF existing.status NOT IN ('pending','accepted','declined') THEN RAISE EXCEPTION 'Ce statut est géré par le club. Contactez un responsable.' USING ERRCODE='42501'; END IF;
 IF existing.status=p_status AND existing.responded_at IS NOT NULL THEN RETURN existing.id; END IF;
 IF existing.status IS DISTINCT FROM p_expected_status OR existing.responded_at IS DISTINCT FROM p_expected_responded_at THEN RAISE EXCEPTION 'Votre réponse a changé. Actualisez avant de réessayer.' USING ERRCODE='40001'; END IF;
 UPDATE public.club_convocation_players SET status=p_status,responded_at=now() WHERE id=existing.id;
 RETURN existing.id;
END $$;
REVOKE ALL ON FUNCTION public.get_native_member_convocations(integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.respond_native_member_convocation(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_native_member_convocations(integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_native_member_convocation(uuid,text,text,timestamptz) TO authenticated;
