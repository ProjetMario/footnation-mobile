-- Full row snapshots and long text travel in JSON bodies. Caller RLS remains active.
CREATE OR REPLACE FUNCTION public.mutate_native_club_record_snapshot(p_section text,p_club_id uuid,p_id uuid,p_values jsonb,p_expected jsonb,p_delete boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target text; allowed text[]; fields text[]; snapshot_fields text[]; columns text[]; assignments text; result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_club_admin(p_club_id),false) THEN
  RAISE EXCEPTION 'Club administrator required' USING ERRCODE='42501';
 END IF;
 CASE p_section
 WHEN 'players' THEN target:='club_players'; allowed:=ARRAY['name','category','position','jersey_number','is_active'];
 WHEN 'staff' THEN target:='club_staff'; allowed:=ARRAY['name','role','is_active'];
 WHEN 'teams' THEN target:='teams'; allowed:=ARRAY['name','category','age_group','season','is_active'];
 WHEN 'convocations' THEN target:='club_convocations'; allowed:=ARRAY['title','meeting_date','meeting_location','category','description'];
 WHEN 'matches' THEN target:='club_matches'; allowed:=ARRAY['opponent_name','category','match_date','venue','is_home','competition','matchday','home_score','away_score','status'];
 WHEN 'palmares' THEN target:='club_achievements'; allowed:=ARRAY['title','competition','year','category','description'];
 WHEN 'news' THEN target:='club_news'; allowed:=ARRAY['title','excerpt','content','is_published','is_pinned','published_at'];
 WHEN 'publications' THEN target:='club_publications'; allowed:=ARRAY['title','content','is_published'];
 WHEN 'shorts' THEN target:='club_shorts'; allowed:=ARRAY['title','description','video_url','thumbnail_url','is_published'];
 ELSE RAISE EXCEPTION 'Unsupported section' USING ERRCODE='22023';
 END CASE;
 IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' OR jsonb_typeof(p_values) IS DISTINCT FROM 'object' OR p_delete IS NULL THEN
  RAISE EXCEPTION 'Values and snapshot must be objects' USING ERRCODE='22023';
 END IF;
 SELECT array_agg(key ORDER BY key) INTO fields FROM jsonb_object_keys(p_values) key;
 SELECT array_agg(key ORDER BY key) INTO snapshot_fields FROM jsonb_object_keys(p_expected) key;
 SELECT array_agg(attname::text ORDER BY attname) INTO columns FROM pg_catalog.pg_attribute
 WHERE attrelid=format('public.%I',target)::regclass AND attnum>0 AND NOT attisdropped;
 IF snapshot_fields IS DISTINCT FROM columns OR (p_expected->>'id') IS DISTINCT FROM p_id::text OR (p_expected->>'club_id') IS DISTINCT FROM p_club_id::text THEN
  RAISE EXCEPTION 'Complete matching row snapshot required' USING ERRCODE='22023';
 END IF;
 IF (p_delete AND fields IS NOT NULL) OR (NOT p_delete AND (fields IS NULL OR NOT fields <@ allowed)) THEN
  RAISE EXCEPTION 'Unsupported mutation fields' USING ERRCODE='22023';
 END IF;
 IF p_section='players' AND p_delete THEN RAISE EXCEPTION 'Archive the player instead of deleting history' USING ERRCODE='22023'; END IF;
 IF p_delete THEN
  EXECUTE format('DELETE FROM public.%I r WHERE r.id=$1 AND r.club_id=$2 AND to_jsonb(r)=to_jsonb(jsonb_populate_record(NULL::public.%I,$3)) RETURNING r.id',target,target)
  INTO result USING p_id,p_club_id,p_expected;
 ELSE
  SELECT string_agg(format('%I=(jsonb_populate_record(NULL::public.%I,$4)).%I',key,target,key),',') INTO assignments FROM unnest(fields) key;
  EXECUTE format('UPDATE public.%I r SET %s WHERE r.id=$1 AND r.club_id=$2 AND to_jsonb(r)=to_jsonb(jsonb_populate_record(NULL::public.%I,$3)) RETURNING r.id',target,assignments,target)
  INTO result USING p_id,p_club_id,p_expected,p_values;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Cet élément a changé ou est inaccessible. Actualisez la liste avant de réessayer.' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean) TO authenticated;

GRANT INSERT,UPDATE ON public.club_players TO authenticated;
CREATE POLICY native_club_players_insert ON public.club_players FOR INSERT TO authenticated WITH CHECK(public.is_fff_club_admin(club_id));
CREATE POLICY native_club_players_update ON public.club_players FOR UPDATE TO authenticated USING(public.is_fff_club_admin(club_id)) WITH CHECK(public.is_fff_club_admin(club_id));
CREATE FUNCTION public.guard_native_club_player() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(NEW.club_id),false) THEN RAISE EXCEPTION 'Club administrator required' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.profile_id IS NOT NULL THEN RAISE EXCEPTION 'Account linking requires a separate workflow' USING ERRCODE='42501'; END IF;
  NEW.created_at:=now(); NEW.updated_at:=now();
 ELSE
  IF (NEW.id,NEW.club_id,NEW.profile_id,NEW.created_at,NEW.joined_at,NEW.left_at) IS DISTINCT FROM (OLD.id,OLD.club_id,OLD.profile_id,OLD.created_at,OLD.joined_at,OLD.left_at) THEN RAISE EXCEPTION 'Player identity is immutable' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=now();
 END IF;
 IF (TG_OP='INSERT' OR NEW.name IS DISTINCT FROM OLD.name) AND (NEW.name IS NULL OR length(btrim(NEW.name))=0) THEN RAISE EXCEPTION 'Player name required' USING ERRCODE='22023'; END IF;
 IF (TG_OP='INSERT' OR NEW.category IS DISTINCT FROM OLD.category) AND (NEW.category IS NULL OR length(btrim(NEW.category))=0) THEN RAISE EXCEPTION 'Player category required' USING ERRCODE='22023'; END IF;
 IF (TG_OP='INSERT' OR NEW.jersey_number IS DISTINCT FROM OLD.jersey_number) AND NEW.jersey_number IS NOT NULL AND NEW.jersey_number NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Jersey number must be between 1 and 99' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_native_club_player() FROM PUBLIC,anon;
CREATE TRIGGER native_club_player_integrity BEFORE INSERT OR UPDATE ON public.club_players FOR EACH ROW EXECUTE FUNCTION public.guard_native_club_player();
