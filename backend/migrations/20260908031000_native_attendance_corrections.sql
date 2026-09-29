CREATE FUNCTION public.update_native_attendance_session(p_id uuid,p_club_id uuid,p_values jsonb,p_expected jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE keys text[]; old_keys text[]; result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(p_club_id),false) THEN RAISE EXCEPTION 'Attendance administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_values) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot' USING ERRCODE='22023'; END IF;
 SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_values) key;
 SELECT array_agg(key ORDER BY key) INTO old_keys FROM jsonb_object_keys(p_expected) key;
 IF keys IS DISTINCT FROM ARRAY['category','notes','session_date','session_type'] OR old_keys IS DISTINCT FROM ARRAY['category','club_id','created_at','created_by','id','notes','session_date','session_type'] OR p_expected->>'id' IS DISTINCT FROM p_id::text OR p_expected->>'club_id' IS DISTINCT FROM p_club_id::text THEN RAISE EXCEPTION 'Complete session snapshot required' USING ERRCODE='22023'; END IF;
 IF p_values->>'session_type' IS NULL OR p_values->>'session_type' NOT IN ('training','match','meeting','other') OR p_values->>'session_date' IS NULL OR length(coalesce(p_values->>'category',''))>100 OR length(coalesce(p_values->>'notes',''))>3000 THEN RAISE EXCEPTION 'Invalid session values' USING ERRCODE='22023'; END IF;
 UPDATE public.club_attendance_sessions s SET category=p_values->>'category',notes=p_values->>'notes',session_type=p_values->>'session_type',session_date=(p_values->>'session_date')::timestamptz
 WHERE s.id=p_id AND s.club_id=p_club_id AND to_jsonb(s)=to_jsonb(jsonb_populate_record(NULL::public.club_attendance_sessions,p_expected)) RETURNING s.id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'La séance a changé ou est inaccessible. Actualisez la liste.' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.delete_native_attendance_record(p_id uuid,p_session_id uuid,p_expected jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE club uuid; keys text[]; result uuid;
BEGIN
 SELECT club_id INTO club FROM public.club_attendance_sessions WHERE id=p_session_id;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Attendance administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot' USING ERRCODE='22023'; END IF;
 SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_expected) key;
 IF keys IS DISTINCT FROM ARRAY['id','notes','player_id','session_id','status'] OR p_expected->>'id' IS DISTINCT FROM p_id::text OR p_expected->>'session_id' IS DISTINCT FROM p_session_id::text THEN RAISE EXCEPTION 'Complete record snapshot required' USING ERRCODE='22023'; END IF;
 DELETE FROM public.club_attendance_records r WHERE r.id=p_id AND r.session_id=p_session_id AND (to_jsonb(r)-'created_at')=p_expected RETURNING r.id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Le pointage a changé ou a été supprimé. Actualisez.' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.update_native_attendance_session(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_native_attendance_record(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_native_attendance_session(uuid,uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_native_attendance_record(uuid,uuid,jsonb) TO authenticated;
