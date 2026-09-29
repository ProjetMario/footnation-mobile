-- A durable client lease identifies one registration attempt. Revocation records
-- a tombstone even when its corresponding registration has not reached us yet.
-- No notification is scheduled or sent by this migration.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.native_push_intents (
 lease_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 installation_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('registered','revoked')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX native_push_intents_user ON public.native_push_intents(user_id);
ALTER TABLE public.native_push_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_push_intents FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.native_push_intents TO service_role;

CREATE FUNCTION public.register_native_push_device(
 p_installation_id uuid,p_project_id uuid,p_token text,p_platform text,p_lease_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 owner_id uuid:=auth.uid();
 intent public.native_push_intents%ROWTYPE;
BEGIN
 IF owner_id IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 IF p_installation_id IS NULL OR p_project_id IS NULL OR p_lease_id IS NULL
  OR p_token IS NULL OR length(p_token)>256
  OR p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
  OR p_platform IS NULL OR p_platform NOT IN ('ios','android') THEN
  RAISE EXCEPTION 'Invalid push installation' USING ERRCODE='22023';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(55000,1);
 SELECT * INTO intent FROM public.native_push_intents WHERE lease_id=p_lease_id;
 IF FOUND THEN
  IF intent.user_id<>owner_id OR intent.installation_id<>p_installation_id THEN
   RAISE EXCEPTION 'Push lease belongs to another registration' USING ERRCODE='42501';
  END IF;
  IF intent.state='registered' AND EXISTS(
   SELECT 1 FROM public.native_push_installations
   WHERE installation_id=p_installation_id AND user_id=owner_id
    AND lease_id=p_lease_id AND project_id=p_project_id AND token=p_token
    AND platform=p_platform AND expires_at>clock_timestamp()
  ) THEN
   -- A retry confirms the original result, without extending its lifetime.
   RETURN p_lease_id;
  END IF;
  RAISE EXCEPTION 'Push registration is revoked, replaced or expired' USING ERRCODE='55000';
 END IF;
 -- Reuse the existing validation, ten-device limit and token-transfer rules.
 -- Its server-generated lease is replaced atomically within this transaction.
 PERFORM public.register_native_push_installation(p_installation_id,p_project_id,p_token,p_platform);
 INSERT INTO public.native_push_intents(lease_id,user_id,installation_id,state)
 VALUES(p_lease_id,owner_id,p_installation_id,'registered');
 UPDATE public.native_push_installations SET lease_id=p_lease_id
 WHERE installation_id=p_installation_id AND user_id=owner_id;
 RETURN p_lease_id;
END $$;

CREATE FUNCTION public.revoke_native_push_device(p_installation_id uuid,p_lease_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 owner_id uuid:=auth.uid();
 intent public.native_push_intents%ROWTYPE;
BEGIN
 IF owner_id IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 IF p_installation_id IS NULL OR p_lease_id IS NULL THEN
  RAISE EXCEPTION 'Invalid push registration' USING ERRCODE='22023';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(55000,1);
 SELECT * INTO intent FROM public.native_push_intents WHERE lease_id=p_lease_id;
 IF FOUND THEN
  IF intent.user_id<>owner_id OR intent.installation_id<>p_installation_id THEN
   RAISE EXCEPTION 'Push lease belongs to another registration' USING ERRCODE='42501';
  END IF;
  UPDATE public.native_push_intents SET state='revoked' WHERE lease_id=p_lease_id;
 ELSE
  INSERT INTO public.native_push_intents(lease_id,user_id,installation_id,state)
  VALUES(p_lease_id,owner_id,p_installation_id,'revoked');
 END IF;
 DELETE FROM public.native_push_installations
 WHERE installation_id=p_installation_id AND user_id=owner_id AND lease_id=p_lease_id;
 -- True confirms the tombstone, including an already absent registration.
 RETURN true;
END $$;

-- Authenticated clients must use the durable operation protocol. The legacy
-- registration remains callable internally by this migration's function owner.
REVOKE EXECUTE ON FUNCTION public.register_native_push_installation(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.register_native_push_device(uuid,uuid,text,text,uuid),
 public.revoke_native_push_device(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_native_push_device(uuid,uuid,text,text,uuid),
 public.revoke_native_push_device(uuid,uuid) TO authenticated;
