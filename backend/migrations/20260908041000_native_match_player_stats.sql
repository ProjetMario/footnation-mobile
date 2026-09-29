GRANT INSERT,UPDATE ON public.match_player_stats TO authenticated;
CREATE POLICY native_match_stats_insert ON public.match_player_stats FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.club_matches m WHERE m.id=match_id AND public.is_fff_club_admin(m.club_id)));
CREATE POLICY native_match_stats_update ON public.match_player_stats FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.club_matches m WHERE m.id=match_id AND public.is_fff_club_admin(m.club_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.club_matches m WHERE m.id=match_id AND public.is_fff_club_admin(m.club_id)));
CREATE FUNCTION public.guard_native_match_player_stats() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE club uuid; field text;
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 SELECT club_id INTO club FROM public.club_matches WHERE id=NEW.match_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) OR NOT EXISTS(SELECT 1 FROM public.club_players WHERE id=NEW.player_id AND club_id=club) THEN RAISE EXCEPTION 'Match and player must belong to an administered club' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['goals','assists','minutes_played','yellow_cards','red_cards','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['goals','assists','minutes_played','yellow_cards','red_cards','updated_at']) THEN RAISE EXCEPTION 'Statistic identity and rating are immutable' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN NEW.created_at:=now(); IF NEW.rating IS NOT NULL THEN RAISE EXCEPTION 'Rating requires a separate workflow' USING ERRCODE='42501'; END IF; END IF;
 NEW.updated_at:=now();
 FOREACH field IN ARRAY ARRAY['goals','assists','minutes_played','yellow_cards','red_cards'] LOOP
  IF (TG_OP='INSERT' OR to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field) AND ((to_jsonb(NEW)->>field) IS NULL OR (to_jsonb(NEW)->>field)::integer<0) THEN RAISE EXCEPTION 'Non-negative statistics required' USING ERRCODE='22023'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_match_player_stats() FROM PUBLIC,anon;
CREATE TRIGGER native_match_player_stats_integrity BEFORE INSERT OR UPDATE ON public.match_player_stats FOR EACH ROW EXECUTE FUNCTION public.guard_native_match_player_stats();
CREATE FUNCTION public.save_native_match_player_stats(p_id uuid,p_match_id uuid,p_player_id uuid,p_values jsonb,p_expected jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE previous public.match_player_stats; written uuid; club uuid; keys text[];
BEGIN
 SELECT club_id INTO club FROM public.club_matches WHERE id=p_match_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Club administrator required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Statistic values required' USING ERRCODE='22023'; END IF;
 SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_values) key;
 IF keys IS DISTINCT FROM ARRAY['assists','goals','minutes_played','red_cards','yellow_cards']::text[] THEN RAISE EXCEPTION 'Exactly five statistic fields required' USING ERRCODE='22023'; END IF;
 SELECT * INTO previous FROM public.match_player_stats WHERE match_id=p_match_id AND player_id=p_player_id FOR UPDATE;
 IF previous.id IS NULL THEN
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'Statistics changed or were removed' USING ERRCODE='40001'; END IF;
  INSERT INTO public.match_player_stats(id,match_id,player_id,goals,assists,minutes_played,yellow_cards,red_cards) VALUES(p_id,p_match_id,p_player_id,(p_values->>'goals')::integer,(p_values->>'assists')::integer,(p_values->>'minutes_played')::integer,(p_values->>'yellow_cards')::integer,(p_values->>'red_cards')::integer) ON CONFLICT(match_id,player_id) DO NOTHING RETURNING id INTO written;
  IF written IS NULL THEN RAISE EXCEPTION 'Statistics created elsewhere; refresh before editing' USING ERRCODE='40001'; END IF;
  RETURN written;
 END IF;
 IF previous.id IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'Statistics identity changed' USING ERRCODE='40001'; END IF;
 IF p_expected IS NULL THEN
  IF jsonb_build_object('goals',previous.goals,'assists',previous.assists,'minutes_played',previous.minutes_played,'yellow_cards',previous.yellow_cards,'red_cards',previous.red_cards)=p_values THEN RETURN previous.id; END IF;
  RAISE EXCEPTION 'Statistics already exist with different values' USING ERRCODE='40001';
 END IF;
 IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Complete snapshot required' USING ERRCODE='22023'; END IF;
 IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(p_expected) key) IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(to_jsonb(previous)) key) THEN RAISE EXCEPTION 'Complete snapshot required' USING ERRCODE='22023'; END IF;
 IF to_jsonb(previous) IS DISTINCT FROM to_jsonb(jsonb_populate_record(NULL::public.match_player_stats,p_expected)) THEN RAISE EXCEPTION 'Statistics changed; refresh before editing' USING ERRCODE='40001'; END IF;
 UPDATE public.match_player_stats SET goals=(p_values->>'goals')::integer,assists=(p_values->>'assists')::integer,minutes_played=(p_values->>'minutes_played')::integer,yellow_cards=(p_values->>'yellow_cards')::integer,red_cards=(p_values->>'red_cards')::integer WHERE id=p_id RETURNING id INTO written;
 RETURN written;
END $$;
REVOKE ALL ON FUNCTION public.save_native_match_player_stats(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_native_match_player_stats(uuid,uuid,uuid,jsonb,jsonb) TO authenticated;
