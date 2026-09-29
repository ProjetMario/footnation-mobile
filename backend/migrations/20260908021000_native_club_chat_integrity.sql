-- Keep authors' edits separate from moderation and message identity.
CREATE FUNCTION public.fn_native_club_chat_message_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Invoker security: only actual trusted database roles bypass the guard.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.author_id IS DISTINCT FROM auth.uid()
     OR NOT public.fn_native_club_chat_member(NEW.group_id) THEN
    RAISE EXCEPTION 'Message author and current membership required' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_blocked OR NEW.blocked_reason IS NOT NULL OR NEW.blocked_at IS NOT NULL
       OR NEW.blocked_by IS NOT NULL OR NEW.is_deleted IS TRUE THEN
      RAISE EXCEPTION 'Moderation fields are reserved' USING ERRCODE='42501';
    END IF;
  ELSE
    IF OLD.is_blocked OR OLD.is_deleted IS TRUE THEN
      RAISE EXCEPTION 'Unavailable messages cannot be edited' USING ERRCODE='42501';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['content','media_url','edited_at','is_deleted'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['content','media_url','edited_at','is_deleted']) THEN
      RAISE EXCEPTION 'Message identity and moderation fields are reserved' USING ERRCODE='42501';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.club_chat_messages parent
    WHERE parent.id=NEW.reply_to_id AND parent.group_id=NEW.group_id
  ) THEN
    RAISE EXCEPTION 'Reply must belong to the same discussion' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fn_native_club_chat_message_guard() FROM PUBLIC;
CREATE TRIGGER native_club_chat_message_guard
BEFORE INSERT OR UPDATE ON public.club_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_native_club_chat_message_guard();
