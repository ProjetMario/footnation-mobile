CREATE FUNCTION public.native_match_mvp_eligible(p_match_id uuid,p_player_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.club_matches m JOIN public.club_players p ON p.club_id=m.club_id WHERE m.id=p_match_id AND p.id=p_player_id AND m.status='finished' AND (
  EXISTS(SELECT 1 FROM public.match_player_stats s WHERE s.match_id=m.id AND s.player_id=p.id) OR
  (p.is_active=true AND NOT EXISTS(SELECT 1 FROM public.match_player_stats s JOIN public.club_players participant ON participant.id=s.player_id WHERE s.match_id=m.id AND participant.club_id=m.club_id))
 ));
$$;
REVOKE ALL ON FUNCTION public.native_match_mvp_eligible(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.native_match_mvp_eligible(uuid,uuid) TO anon,authenticated;
CREATE POLICY native_match_mvp_candidate ON public.match_mvp_votes AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(public.native_match_mvp_eligible(match_id,player_id));
CREATE FUNCTION public.get_native_match_mvp_candidates(p_match_id uuid,p_club_id uuid,p_offset integer DEFAULT 0) RETURNS TABLE(id uuid,name text,category text,"position" text,jersey_number integer,vote_count bigint) LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid offset' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_matches WHERE club_matches.id=p_match_id AND club_id=p_club_id AND status='finished') THEN RAISE EXCEPTION 'Finished match in this club required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,p.name,p.category,p.position,p.jersey_number,(SELECT count(*) FROM public.match_mvp_votes v WHERE v.match_id=p_match_id AND v.player_id=p.id) FROM public.club_players p WHERE p.club_id=p_club_id AND public.native_match_mvp_eligible(p_match_id,p.id) ORDER BY 6 DESC,p.name,p.id LIMIT 30 OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.get_native_match_mvp_candidates(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_native_match_mvp_candidates(uuid,uuid,integer) TO anon,authenticated;
CREATE FUNCTION public.cast_native_match_mvp_vote(p_id uuid,p_match_id uuid,p_player_id uuid) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE existing public.match_mvp_votes; saved uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM public.match_mvp_votes WHERE match_id=p_match_id AND voter_id=auth.uid();
 IF existing.id IS NOT NULL THEN
  IF existing.player_id=p_player_id THEN RETURN existing.id; END IF;
  RAISE EXCEPTION 'You already voted for another player' USING ERRCODE='23505';
 END IF;
 IF p_id IS NULL OR NOT public.native_match_mvp_eligible(p_match_id,p_player_id) THEN RAISE EXCEPTION 'Eligible player in a finished match required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.match_mvp_votes(id,match_id,voter_id,player_id) VALUES(p_id,p_match_id,auth.uid(),p_player_id) ON CONFLICT(match_id,voter_id) DO NOTHING RETURNING id INTO saved;
 IF saved IS NOT NULL THEN RETURN saved; END IF;
 SELECT * INTO existing FROM public.match_mvp_votes WHERE match_id=p_match_id AND voter_id=auth.uid();
 IF existing.player_id=p_player_id THEN RETURN existing.id; END IF;
 RAISE EXCEPTION 'You already voted for another player' USING ERRCODE='23505';
END $$;
REVOKE ALL ON FUNCTION public.cast_native_match_mvp_vote(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cast_native_match_mvp_vote(uuid,uuid,uuid) TO authenticated;
