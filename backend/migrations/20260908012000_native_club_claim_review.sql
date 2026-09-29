-- One transaction for the decision, membership and official club identity.
-- No existing claim or club is modified by installing this function.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.review_club_claim(
 p_claim_id uuid, p_decision text, p_notes text, p_expected_updated_at timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 reviewer uuid := auth.uid();
 claim public.club_claim_requests%ROWTYPE;
 club public.fff_clubs%ROWTYPE;
 target_club uuid;
 reviewed timestamptz := clock_timestamp();
BEGIN
 IF reviewer IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=reviewer AND is_admin=true) THEN
  RAISE EXCEPTION 'Administration FootNation requise' USING ERRCODE='42501';
 END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR length(coalesce(p_notes,'')) > 3000 THEN
  RAISE EXCEPTION 'Decision ou note invalide' USING ERRCODE='22023';
 END IF;
 SELECT club_id INTO target_club FROM public.club_claim_requests WHERE id=p_claim_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable' USING ERRCODE='P0002'; END IF;
 -- Serialize decisions concerning the same club before locking individual claims.
 SELECT * INTO club FROM public.fff_clubs WHERE id=target_club FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Club introuvable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO claim FROM public.club_claim_requests WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND OR claim.club_id IS DISTINCT FROM target_club THEN
  RAISE EXCEPTION 'Demande modifiee, rechargez la liste' USING ERRCODE='40001';
 END IF;
 -- Safe retry after an uncertain network response: keep the original review intact.
 IF claim.status=p_decision THEN RETURN claim.status; END IF;
 IF claim.status <> 'pending' OR p_expected_updated_at IS NULL OR claim.updated_at IS DISTINCT FROM p_expected_updated_at THEN
  RAISE EXCEPTION 'Demande deja traitee ou modifiee, rechargez la liste' USING ERRCODE='40001';
 END IF;
 IF p_decision='approved' THEN
  INSERT INTO public.club_admins(club_id,profile_id,role)
   VALUES(claim.club_id,claim.user_id,'admin') ON CONFLICT(club_id,profile_id) DO NOTHING;
  UPDATE public.profiles SET is_verified=true,is_published=false,
   club_official_name=club.name,avatar_url=club.logo_url,linked_club_id=club.id
   WHERE account_type='club' AND linked_club_id=club.id;
  UPDATE public.fff_clubs SET metadata=coalesce(club.metadata,'{}'::jsonb) ||
   jsonb_build_object('is_verified',true,'claimed_by',claim.user_id,'reviewed_by',reviewer,'reviewed_at',reviewed)
   WHERE id=club.id;
 END IF;
 UPDATE public.club_claim_requests SET status=p_decision,
  admin_notes=nullif(btrim(p_notes),''),reviewed_at=reviewed,reviewed_by=reviewer,updated_at=reviewed
  WHERE id=claim.id;
 RETURN p_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.review_club_claim(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_club_claim(uuid,text,text,timestamptz) TO authenticated;
