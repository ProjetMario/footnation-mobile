CREATE FUNCTION public.set_native_primary_team(p_club_id uuid,p_profile_id uuid,p_team_id uuid,p_expected_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_team uuid; primary_count integer; member_role text; member_position text;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_club_admin(p_club_id),false) THEN RAISE EXCEPTION 'Administration du club requise.' USING ERRCODE='42501'; END IF;
 SELECT primary_role,coalesce(position,target_position) INTO member_role,member_position FROM public.profiles WHERE id=p_profile_id AND linked_club_id=p_club_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ce membre ne fait plus partie du club.' USING ERRCODE='22023'; END IF;
 IF p_team_id IS NOT NULL THEN
  PERFORM 1 FROM public.teams WHERE id=p_team_id AND club_id=p_club_id AND is_active=true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Équipe indisponible dans ce club.' USING ERRCODE='22023'; END IF;
 END IF;
 PERFORM tm.id FROM public.team_members tm JOIN public.teams t ON t.id=tm.team_id WHERE tm.profile_id=p_profile_id AND t.club_id=p_club_id FOR UPDATE OF tm;
 SELECT count(*),min(tm.team_id::text)::uuid INTO primary_count,current_team FROM public.team_members tm JOIN public.teams t ON t.id=tm.team_id WHERE tm.profile_id=p_profile_id AND t.club_id=p_club_id AND tm.is_active AND tm.is_primary;
 IF primary_count>1 THEN RAISE EXCEPTION 'Plusieurs équipes principales sont enregistrées. Corrigez ces affectations avant de continuer.' USING ERRCODE='22023'; END IF;
 IF current_team IS NOT DISTINCT FROM p_team_id THEN RETURN; END IF;
 IF current_team IS DISTINCT FROM p_expected_team_id THEN RAISE EXCEPTION 'L’équipe principale a changé. Actualisez avant de réessayer.' USING ERRCODE='40001'; END IF;
 UPDATE public.team_members tm SET is_primary=false WHERE tm.profile_id=p_profile_id AND tm.is_primary AND EXISTS(SELECT 1 FROM public.teams t WHERE t.id=tm.team_id AND t.club_id=p_club_id);
 IF p_team_id IS NOT NULL THEN
  INSERT INTO public.team_members(team_id,profile_id,role,position,is_active,is_primary)
  VALUES(p_team_id,p_profile_id,coalesce(member_role,'Joueur'),coalesce(member_position,''),true,true)
  ON CONFLICT(team_id,profile_id) DO UPDATE SET is_primary=true,is_active=true,left_at=null;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_native_primary_team(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_native_primary_team(uuid,uuid,uuid,uuid) TO authenticated;
