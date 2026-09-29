CREATE FUNCTION public.guard_native_convocation_player() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE club uuid;
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 SELECT club_id INTO club FROM public.club_convocations WHERE id=NEW.convocation_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Convocation administrator required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_players WHERE id=NEW.player_id AND club_id=club) THEN RAISE EXCEPTION 'Player must belong to this club' USING ERRCODE='22023'; END IF;
 IF TG_OP='INSERT' AND (NEW.status IS DISTINCT FROM 'pending' OR NEW.responded_at IS NOT NULL) THEN RAISE EXCEPTION 'New convocation must await a response' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.convocation_id,NEW.player_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.convocation_id,OLD.player_id,OLD.created_at) THEN RAISE EXCEPTION 'Convocation identity is immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_convocation_player() FROM PUBLIC,anon;
CREATE TRIGGER native_convocation_player_integrity BEFORE INSERT OR UPDATE ON public.club_convocation_players FOR EACH ROW EXECUTE FUNCTION public.guard_native_convocation_player();
CREATE FUNCTION public.get_native_convocation_candidates(p_club_id uuid,p_convocation_id uuid,p_team_id uuid DEFAULT NULL,p_search text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,name text,category text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(p_club_id),false) THEN RAISE EXCEPTION 'Convocation administrator required' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR length(coalesce(p_search,''))>100 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_convocations c WHERE c.id=p_convocation_id AND c.club_id=p_club_id) THEN RAISE EXCEPTION 'Convocation inaccessible' USING ERRCODE='42501'; END IF;
 IF p_team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.teams t WHERE t.id=p_team_id AND t.club_id=p_club_id) THEN RAISE EXCEPTION 'Team must belong to this club' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT p.id,p.name,p.category FROM public.club_players p
 WHERE p.club_id=p_club_id AND p.is_active=true
 AND strpos(lower(p.name),lower(coalesce(p_search,'')))>0
 AND (p_team_id IS NULL OR EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=p_team_id AND tm.profile_id=p.profile_id AND tm.is_active=true))
 AND NOT EXISTS(SELECT 1 FROM public.club_convocation_players cp WHERE cp.convocation_id=p_convocation_id AND cp.player_id=p.id)
 ORDER BY p.name,p.id LIMIT 30 OFFSET p_offset;
END $$;
CREATE FUNCTION public.delete_native_convocation_player(p_id uuid,p_convocation_id uuid,p_expected jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE club uuid; keys text[]; result uuid;
BEGIN
 SELECT club_id INTO club FROM public.club_convocations WHERE id=p_convocation_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Convocation administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot' USING ERRCODE='22023'; END IF;
 SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_expected) key;
 IF keys IS DISTINCT FROM ARRAY['convocation_id','created_at','id','notes','player_id','responded_at','status'] OR p_expected->>'id' IS DISTINCT FROM p_id::text OR p_expected->>'convocation_id' IS DISTINCT FROM p_convocation_id::text THEN RAISE EXCEPTION 'Complete snapshot required' USING ERRCODE='22023'; END IF;
 DELETE FROM public.club_convocation_players cp WHERE cp.id=p_id AND cp.convocation_id=p_convocation_id AND to_jsonb(cp)=to_jsonb(jsonb_populate_record(NULL::public.club_convocation_players,p_expected)) RETURNING cp.id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'La convocation ou la réponse a changé. Actualisez.' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_native_convocation_candidates(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_native_convocation_player(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_native_convocation_candidates(uuid,uuid,uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_native_convocation_player(uuid,uuid,jsonb) TO authenticated;
