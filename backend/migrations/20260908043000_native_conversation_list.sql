-- Read-only conversation summaries, preserving message and profile RLS.
CREATE FUNCTION public.get_native_conversations(search_term text DEFAULT '', page_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,sender_id uuid,receiver_id uuid,content text,created_at timestamptz,read_at timestamptz,is_blocked boolean,sender jsonb,receiver jsonb,unread_count bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF page_offset IS NULL OR page_offset < 0 THEN RAISE EXCEPTION 'Invalid offset' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 WITH own AS (
  SELECT m.id,m.sender_id,m.receiver_id,m.content,m.created_at,m.read_at,m.is_blocked,
   CASE WHEN m.sender_id=auth.uid() THEN m.receiver_id ELSE m.sender_id END AS peer
  FROM public.messages m WHERE m.sender_id=auth.uid() OR m.receiver_id=auth.uid()
 ), ranked AS (
  SELECT o.*,
   row_number() OVER(PARTITION BY o.peer ORDER BY o.created_at DESC,o.id DESC) AS n,
   count(*) FILTER(WHERE o.receiver_id=auth.uid() AND o.read_at IS NULL AND NOT coalesce(o.is_blocked,false)) OVER(PARTITION BY o.peer) AS unread
  FROM own o
 )
 SELECT r.id,r.sender_id,r.receiver_id,
  CASE WHEN r.is_blocked THEN 'Message masqué' ELSE r.content END,
  r.created_at,r.read_at,r.is_blocked,
  CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object('id',sp.id,'full_name',sp.full_name,'username',sp.username,'avatar_url',sp.avatar_url) END,
  CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object('id',rp.id,'full_name',rp.full_name,'username',rp.username,'avatar_url',rp.avatar_url) END,
  r.unread
 FROM ranked r
 LEFT JOIN public.profiles sp ON sp.id=r.sender_id
 LEFT JOIN public.profiles rp ON rp.id=r.receiver_id
 WHERE r.n=1 AND (
  btrim(coalesce(search_term,''))='' OR
  strpos(lower(CASE WHEN r.sender_id=auth.uid() THEN coalesce(rp.full_name,'') || ' ' || coalesce(rp.username,'') ELSE coalesce(sp.full_name,'') || ' ' || coalesce(sp.username,'') END),lower(btrim(search_term)))>0
 )
 ORDER BY r.created_at DESC,r.id DESC LIMIT 30 OFFSET page_offset;
END $$;
REVOKE ALL ON FUNCTION public.get_native_conversations(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_native_conversations(text,integer) TO authenticated;
