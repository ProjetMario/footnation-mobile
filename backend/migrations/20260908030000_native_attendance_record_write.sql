CREATE FUNCTION public.guard_native_attendance_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE club uuid;
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 SELECT club_id INTO club FROM public.club_attendance_sessions WHERE id=NEW.session_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Attendance administrator required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_players WHERE id=NEW.player_id AND club_id=club) THEN RAISE EXCEPTION 'Player must belong to this club' USING ERRCODE='22023'; END IF;
 IF NEW.status NOT IN ('present','absent','late','excused','injured') OR NEW.status IS NULL OR length(coalesce(NEW.notes,''))>3000 THEN RAISE EXCEPTION 'Invalid attendance status or notes' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.session_id,NEW.player_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.session_id,OLD.player_id,OLD.created_at) THEN RAISE EXCEPTION 'Attendance identity is immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER native_attendance_record_integrity BEFORE INSERT OR UPDATE ON public.club_attendance_records FOR EACH ROW EXECUTE FUNCTION public.guard_native_attendance_record();
REVOKE ALL ON FUNCTION public.guard_native_attendance_record() FROM PUBLIC,anon;
CREATE FUNCTION public.save_native_attendance_record(p_id uuid,p_session_id uuid,p_player_id uuid,p_status text,p_notes text,p_expected jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE club uuid; existing public.club_attendance_records; expected_keys text[];
BEGIN
 SELECT club_id INTO club FROM public.club_attendance_sessions WHERE id=p_session_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Attendance administrator required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_players WHERE id=p_player_id AND club_id=club) THEN RAISE EXCEPTION 'Player must belong to this club' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL OR p_status IS NULL OR p_status NOT IN ('present','absent','late','excused','injured') OR length(coalesce(p_notes,''))>3000 THEN RAISE EXCEPTION 'Invalid attendance values' USING ERRCODE='22023'; END IF;
 IF p_expected IS NOT NULL THEN
  IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot' USING ERRCODE='22023'; END IF;
  SELECT array_agg(key ORDER BY key) INTO expected_keys FROM jsonb_object_keys(p_expected) key;
  IF expected_keys IS DISTINCT FROM ARRAY['id','notes','player_id','session_id','status'] OR p_expected->>'id' IS DISTINCT FROM p_id::text OR p_expected->>'session_id' IS DISTINCT FROM p_session_id::text OR p_expected->>'player_id' IS DISTINCT FROM p_player_id::text THEN RAISE EXCEPTION 'Complete matching snapshot required' USING ERRCODE='22023'; END IF;
 END IF;
 SELECT * INTO existing FROM public.club_attendance_records WHERE session_id=p_session_id AND player_id=p_player_id FOR UPDATE;
 IF existing.id IS NOT NULL THEN
  IF existing.id=p_id AND existing.status=p_status AND existing.notes IS NOT DISTINCT FROM p_notes THEN RETURN existing.id; END IF;
  IF p_expected IS NULL OR existing.id<>p_id OR existing.status IS DISTINCT FROM p_expected->>'status' OR existing.notes IS DISTINCT FROM p_expected->>'notes' THEN
   RAISE EXCEPTION 'Le pointage a changé. Actualisez avant de réessayer.' USING ERRCODE='40001';
  END IF;
  UPDATE public.club_attendance_records SET status=p_status,notes=p_notes WHERE id=existing.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pointage inaccessible' USING ERRCODE='40001'; END IF;
 ELSE
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'Le pointage a été supprimé. Actualisez.' USING ERRCODE='40001'; END IF;
  BEGIN
   INSERT INTO public.club_attendance_records(id,session_id,player_id,status,notes) VALUES(p_id,p_session_id,p_player_id,p_status,p_notes);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Un pointage existe déjà. Actualisez.' USING ERRCODE='40001'; END;
 END IF;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb) TO authenticated;
