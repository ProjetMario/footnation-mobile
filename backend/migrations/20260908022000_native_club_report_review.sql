CREATE FUNCTION public.fn_native_club_report_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF auth.uid() IS NULL OR NEW.reporter_id IS DISTINCT FROM auth.uid()
      OR NEW.status <> 'pending' OR NEW.admin_notes IS NOT NULL
      OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL THEN
      RAISE EXCEPTION 'Reporter identity and pending status required' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.club_chat_messages m WHERE m.id=NEW.message_id
      AND m.author_id<>auth.uid() AND NOT m.is_blocked AND m.is_deleted IS NOT TRUE
      AND public.fn_native_club_chat_member(m.group_id)) THEN
      RAISE EXCEPTION 'Available message in a current discussion required' USING ERRCODE='42501';
    END IF;
    IF length(btrim(NEW.reason))=0 OR length(NEW.reason)>200 OR length(NEW.details)>3000 THEN
      RAISE EXCEPTION 'Invalid report text' USING ERRCODE='22023';
    END IF;
  ELSE
    IF NOT coalesce(public.is_site_admin(),false) THEN
      RAISE EXCEPTION 'Site administration required' USING ERRCODE='42501';
    END IF;
    IF (to_jsonb(NEW)-ARRAY['status','admin_notes','reviewed_at','reviewed_by'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','admin_notes','reviewed_at','reviewed_by']) THEN
      RAISE EXCEPTION 'Original report fields are immutable' USING ERRCODE='42501';
    END IF;
    IF length(NEW.admin_notes)>3000 THEN RAISE EXCEPTION 'Review note too long' USING ERRCODE='22023'; END IF;
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fn_native_club_report_guard() FROM PUBLIC;
CREATE TRIGGER native_club_report_guard BEFORE INSERT OR UPDATE ON public.club_chat_message_reports
FOR EACH ROW EXECUTE FUNCTION public.fn_native_club_report_guard();

-- Site reviewers can inspect only the message attached to an existing report.
CREATE FUNCTION public.get_native_club_report_message(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_site_admin(),false) THEN
   RAISE EXCEPTION 'Site administration required' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object('id',m.id,'content',m.content,'media_url',m.media_url,
   'is_deleted',m.is_deleted,'is_blocked',m.is_blocked,'created_at',m.created_at,
   'author_name',p.full_name,'group_name',g.name)
 INTO result FROM public.club_chat_message_reports r
 JOIN public.club_chat_messages m ON m.id=r.message_id
 LEFT JOIN public.profiles p ON p.id=m.author_id
 LEFT JOIN public.club_chat_groups g ON g.id=m.group_id
 WHERE r.id=p_report_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_native_club_report_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_native_club_report_message(uuid) TO authenticated;
