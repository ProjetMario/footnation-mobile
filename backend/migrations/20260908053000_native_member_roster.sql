CREATE FUNCTION public.get_native_member_roster(p_club_id uuid,p_search text DEFAULT '',p_offset integer DEFAULT 0,p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid,role text,jersey_number integer,"position" text,team jsonb,profile jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE term text:=lower(btrim(coalesce(p_search,'')));
BEGIN
 IF auth.uid() IS NULL OR p_club_id IS NULL OR NOT (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.linked_club_id=p_club_id)
  OR EXISTS(SELECT 1 FROM public.team_members tm JOIN public.teams t ON t.id=tm.team_id WHERE tm.profile_id=auth.uid() AND tm.is_active=true AND tm.status='approved' AND t.club_id=p_club_id)
 ) THEN RAISE EXCEPTION 'Accès réservé aux membres du club.' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Pagination invalide.' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT tm.id,tm.role,tm.jersey_number,tm.position,
 jsonb_build_object('name',t.name),CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'full_name',p.full_name,'username',p.username,'avatar_url',p.avatar_url) END
 FROM public.team_members tm JOIN public.teams t ON t.id=tm.team_id LEFT JOIN public.profiles p ON p.id=tm.profile_id
 WHERE t.club_id=p_club_id AND tm.is_active=true AND tm.status='approved'
 AND (term='' OR strpos(lower(coalesce(p.full_name,'')),term)>0 OR strpos(lower(coalesce(p.username,'')),term)>0 OR strpos(lower(coalesce(tm.role,'')),term)>0)
 ORDER BY tm.id LIMIT p_limit OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.get_native_member_roster(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_native_member_roster(uuid,text,integer,integer) TO authenticated;
