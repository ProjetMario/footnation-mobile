-- Remove only the relationship snapshots explicitly confirmed by the member.
CREATE OR REPLACE FUNCTION public.remove_native_connections(peer_id uuid, expected_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  viewer uuid := auth.uid();
  current_row public.connections%ROWTYPE;
  expected jsonb;
  removed integer;
BEGIN
  IF viewer IS NULL OR peer_id IS NULL OR peer_id = viewer THEN
    RAISE EXCEPTION 'Authentication and another member required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(expected_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid relationship snapshot' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(expected_rows) NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'Invalid relationship snapshot count' USING ERRCODE='22023';
  END IF;
  FOR expected IN SELECT value FROM jsonb_array_elements(expected_rows) LOOP
    IF jsonb_typeof(expected) IS DISTINCT FROM 'object' OR
       expected->>'id' IS NULL OR
       (expected->>'status' IN ('pending','accepted','rejected')) IS NOT TRUE OR
       (((expected->>'user_id')::uuid = viewer AND (expected->>'connected_user_id')::uuid = peer_id) OR
        ((expected->>'user_id')::uuid = peer_id AND (expected->>'connected_user_id')::uuid = viewer)) IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid relationship snapshot' USING ERRCODE='22023';
    END IF;
    PERFORM (expected->>'id')::uuid;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(expected_rows)) <> jsonb_array_length(expected_rows) THEN
    RAISE EXCEPTION 'Duplicate relationship snapshot' USING ERRCODE='22023';
  END IF;
  -- Lock before checking every row; a status change cannot produce partial removal.
  FOR current_row IN SELECT * FROM public.connections c
    WHERE (c.user_id=viewer AND c.connected_user_id=peer_id) OR
          (c.user_id=peer_id AND c.connected_user_id=viewer)
    ORDER BY c.id FOR UPDATE
  LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expected_rows) e
      WHERE (e->>'id')::uuid=current_row.id AND e->>'status'=current_row.status
        AND (e->>'user_id')::uuid=current_row.user_id
        AND (e->>'connected_user_id')::uuid=current_row.connected_user_id) THEN
      RAISE EXCEPTION 'Relationship changed; refresh before confirming removal' USING ERRCODE='40001';
    END IF;
  END LOOP;
  DELETE FROM public.connections c WHERE c.id IN
    (SELECT (value->>'id')::uuid FROM jsonb_array_elements(expected_rows))
    AND ((c.user_id=viewer AND c.connected_user_id=peer_id) OR
         (c.user_id=peer_id AND c.connected_user_id=viewer));
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_native_connections(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_native_connections(uuid,jsonb) TO authenticated;
