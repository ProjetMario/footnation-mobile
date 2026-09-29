CREATE FUNCTION public.update_native_club_message_snapshot(
 p_message_id uuid, p_group_id uuid, p_content text, p_delete boolean, p_expected jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE expected_keys text[]; saved uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' OR p_delete IS NULL THEN
  RAISE EXCEPTION 'Invalid message request' USING ERRCODE='22023';
 END IF;
 SELECT array_agg(key ORDER BY key) INTO expected_keys FROM jsonb_object_keys(p_expected) key;
 IF expected_keys IS DISTINCT FROM ARRAY['content','edited_at','is_blocked','is_deleted','media_url']::text[] THEN
  RAISE EXCEPTION 'Complete message snapshot required' USING ERRCODE='22023';
 END IF;
 IF NOT p_delete AND (p_content IS NULL OR length(p_content)>4000 OR p_content ~ '^[[:space:]]*$') THEN
  RAISE EXCEPTION 'Message text must contain 1 to 4000 characters' USING ERRCODE='22023';
 END IF;
 UPDATE public.club_chat_messages m SET
  content=CASE WHEN p_delete THEN '' ELSE p_content END,
  media_url=CASE WHEN p_delete THEN NULL ELSE m.media_url END,
  is_deleted=CASE WHEN p_delete THEN true ELSE m.is_deleted END,
  edited_at=CASE WHEN p_delete THEN m.edited_at ELSE now() END
 WHERE m.id=p_message_id AND m.group_id=p_group_id AND m.author_id=auth.uid()
  AND NOT m.is_blocked AND m.is_deleted IS NOT TRUE
  AND m.content IS NOT DISTINCT FROM (p_expected->>'content')
  AND m.media_url IS NOT DISTINCT FROM (p_expected->>'media_url')
  AND m.is_deleted IS NOT DISTINCT FROM ((p_expected->>'is_deleted')::boolean)
  AND m.is_blocked IS NOT DISTINCT FROM ((p_expected->>'is_blocked')::boolean)
  AND m.edited_at IS NOT DISTINCT FROM ((p_expected->>'edited_at')::timestamptz)
 RETURNING m.id INTO saved;
 IF saved IS NULL THEN RAISE EXCEPTION 'Message changed or unavailable; reload' USING ERRCODE='40001'; END IF;
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.update_native_club_message_snapshot(uuid,uuid,text,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_native_club_message_snapshot(uuid,uuid,text,boolean,jsonb) TO authenticated;
