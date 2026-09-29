-- Site reviewers can inspect only the message attached to an existing report.
CREATE OR REPLACE FUNCTION public.get_native_club_report_message(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_site_admin(),false) THEN
   RAISE EXCEPTION 'Site administration required' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object('id',m.id,'content',m.content,'media_url',m.media_url,
   'is_deleted',m.is_deleted,'is_blocked',m.is_blocked,'created_at',m.created_at,
   'author_name',p.full_name,'group_name',g.name,
   'blocked_reason',m.blocked_reason,'blocked_at',m.blocked_at,
   'version',md5(to_jsonb(m)::text))
 INTO result FROM public.club_chat_message_reports r
 JOIN public.club_chat_messages m ON m.id=r.message_id
 LEFT JOIN public.profiles p ON p.id=m.author_id
 LEFT JOIN public.club_chat_groups g ON g.id=m.group_id
 WHERE r.id=p_report_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_native_club_report_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_native_club_report_message(uuid) TO authenticated;

CREATE FUNCTION public.moderate_native_club_report_message(
 p_report_id uuid, p_block boolean, p_reason text, p_expected_version text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.club_chat_messages%ROWTYPE;
DECLARE reason text := nullif(btrim(p_reason),'');
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_site_admin(),false) THEN
   RAISE EXCEPTION 'Site administration required' USING ERRCODE='42501';
 END IF;
 IF p_block IS NULL OR p_expected_version IS NULL OR (p_block AND reason IS NULL) OR length(reason)>3000 THEN
   RAISE EXCEPTION 'Invalid moderation request' USING ERRCODE='22023';
 END IF;
 SELECT m.* INTO target FROM public.club_chat_messages m
 JOIN public.club_chat_message_reports r ON r.message_id=m.id
 WHERE r.id=p_report_id FOR UPDATE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reported message unavailable' USING ERRCODE='P0002'; END IF;
 IF md5(to_jsonb(target)::text) IS DISTINCT FROM p_expected_version THEN
   RAISE EXCEPTION 'Message changed; reload before moderating' USING ERRCODE='40001';
 END IF;
 IF target.is_deleted IS TRUE THEN
   RAISE EXCEPTION 'Deleted message cannot be moderated' USING ERRCODE='22023';
 END IF;
 UPDATE public.club_chat_messages SET
   is_blocked=p_block,
   blocked_reason=CASE WHEN p_block THEN reason ELSE NULL END,
   blocked_at=CASE WHEN p_block THEN now() ELSE NULL END,
   blocked_by=CASE WHEN p_block THEN auth.uid() ELSE NULL END
 WHERE id=target.id;
 RETURN public.get_native_club_report_message(p_report_id);
END $$;
REVOKE ALL ON FUNCTION public.moderate_native_club_report_message(uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_native_club_report_message(uuid,boolean,text,text) TO authenticated;
