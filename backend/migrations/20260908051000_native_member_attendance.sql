CREATE FUNCTION public.get_native_member_attendance(p_club_id uuid,p_offset integer DEFAULT 0,p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid,category text,session_type text,session_date timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_club_id IS NULL OR NOT (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.linked_club_id=p_club_id)
  OR EXISTS(SELECT 1 FROM public.team_members tm JOIN public.teams t ON t.id=tm.team_id WHERE tm.profile_id=auth.uid() AND tm.is_active=true AND tm.status='approved' AND t.club_id=p_club_id)
 ) THEN RAISE EXCEPTION 'Accès réservé aux membres du club.' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Pagination invalide.' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT s.id,s.category,s.session_type,s.session_date FROM public.club_attendance_sessions s
 WHERE s.club_id=p_club_id ORDER BY s.session_date DESC NULLS LAST,s.id LIMIT p_limit OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.get_native_member_attendance(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_native_member_attendance(uuid,integer,integer) TO authenticated;
