CREATE FUNCTION public.native_team_member_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.native_team_member_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER native_team_member_version BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.native_team_member_version();
CREATE FUNCTION public.leave_native_team(p_club_id uuid,p_membership_id uuid,p_expected_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member public.team_members%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT tm.* INTO member FROM public.team_members tm WHERE tm.id=p_membership_id AND tm.profile_id=auth.uid()
 AND EXISTS(SELECT 1 FROM public.teams t WHERE t.id=tm.team_id AND t.club_id=p_club_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Appartenance indisponible dans ce club.' USING ERRCODE='42501'; END IF;
 IF member.is_active=false AND member.status='rejected' AND member.left_at IS NOT NULL THEN RETURN; END IF;
 IF member.is_active IS DISTINCT FROM true OR member.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'L’affectation a changé. Actualisez avant de confirmer à nouveau.' USING ERRCODE='40001'; END IF;
 UPDATE public.team_members SET is_active=false,is_primary=false,status='rejected',left_at=clock_timestamp() WHERE id=member.id;
END $$;
REVOKE ALL ON FUNCTION public.leave_native_team(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.leave_native_team(uuid,uuid,timestamptz) TO authenticated;
