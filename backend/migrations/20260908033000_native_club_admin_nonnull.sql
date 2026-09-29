-- Serialize authority changes and recheck authority after waiting for another writer.
CREATE OR REPLACE FUNCTION public.guard_native_club_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE club uuid; caller_role text:=current_setting('role',true);
BEGIN
 IF caller_role IN ('postgres','service_role','supabase_admin') OR (coalesce(caller_role,'none')='none' AND session_user IN ('postgres','supabase_admin')) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' THEN club:=OLD.club_id; ELSE club:=NEW.club_id; END IF;
 IF club IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Club administrator required' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.club_id,NEW.profile_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.club_id,OLD.profile_id,OLD.created_at) THEN RAISE EXCEPTION 'Administrator identity is immutable' USING ERRCODE='42501'; END IF;
 IF TG_OP<>'DELETE' AND NEW.profile_id IS NULL THEN RAISE EXCEPTION 'Administrator profile required' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('footnation:club-admin:'||club::text,0));
 IF NOT coalesce(public.is_fff_club_admin(club),false) THEN RAISE EXCEPTION 'Votre accès administrateur a changé. Actualisez.' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.profile_id=auth.uid() THEN RAISE EXCEPTION 'Un autre administrateur doit retirer votre accès.' USING ERRCODE='42501'; END IF;
  IF OLD.profile_id IS NOT NULL AND (SELECT count(*) FROM public.club_admins WHERE club_id=club AND profile_id IS NOT NULL)<2 THEN RAISE EXCEPTION 'Le club doit conserver un administrateur.' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;
