-- Private registry only. This migration does not schedule or send notifications.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.native_push_installations (
 installation_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 token text NOT NULL CHECK(length(token)<=256 AND token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
 platform text NOT NULL CHECK(platform IN ('ios','android')),
 lease_id uuid NOT NULL DEFAULT gen_random_uuid(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '30 days',
 UNIQUE(project_id,token)
);
CREATE INDEX native_push_installations_user ON public.native_push_installations(user_id);
ALTER TABLE public.native_push_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_push_installations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.native_push_installations TO service_role;
CREATE FUNCTION public.register_native_push_installation(p_installation_id uuid,p_project_id uuid,p_token text,p_platform text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid:=auth.uid(); lease uuid:=gen_random_uuid(); stamp timestamptz:=clock_timestamp();
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_installation_id IS NULL OR p_project_id IS NULL OR p_token IS NULL OR length(p_token)>256 OR p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' OR p_platform IS NULL OR p_platform NOT IN ('ios','android') THEN
  RAISE EXCEPTION 'Invalid push installation' USING ERRCODE='22023';
 END IF;
 -- Serialize device/token transfers so a shared phone has only one current recipient.
 PERFORM pg_catalog.pg_advisory_xact_lock(55000,1);
 IF EXISTS(SELECT 1 FROM public.native_push_installations WHERE installation_id=p_installation_id AND user_id<>owner_id AND (token<>p_token OR project_id<>p_project_id)) THEN
  RAISE EXCEPTION 'Installation already belongs to another account' USING ERRCODE='42501';
 END IF;
 DELETE FROM public.native_push_installations WHERE user_id=owner_id AND expires_at<=stamp;
 IF (SELECT count(*) FROM public.native_push_installations WHERE user_id=owner_id)>=10 AND NOT EXISTS(SELECT 1 FROM public.native_push_installations WHERE user_id=owner_id AND (installation_id=p_installation_id OR (project_id=p_project_id AND token=p_token))) THEN
  RAISE EXCEPTION 'Too many registered installations' USING ERRCODE='54000';
 END IF;
 DELETE FROM public.native_push_installations WHERE project_id=p_project_id AND token=p_token AND installation_id<>p_installation_id;
 INSERT INTO public.native_push_installations(installation_id,user_id,project_id,token,platform,lease_id,updated_at,expires_at)
 VALUES(p_installation_id,owner_id,p_project_id,p_token,p_platform,lease,stamp,stamp+interval '30 days')
 ON CONFLICT(installation_id) DO UPDATE SET user_id=EXCLUDED.user_id,project_id=EXCLUDED.project_id,token=EXCLUDED.token,platform=EXCLUDED.platform,lease_id=EXCLUDED.lease_id,updated_at=EXCLUDED.updated_at,expires_at=EXCLUDED.expires_at;
 RETURN lease;
END $$;
CREATE FUNCTION public.revoke_native_push_installation(p_installation_id uuid,p_lease_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(55000,1);
 DELETE FROM public.native_push_installations WHERE installation_id=p_installation_id AND lease_id=p_lease_id AND user_id=auth.uid();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.register_native_push_installation(uuid,uuid,text,text),public.revoke_native_push_installation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_native_push_installation(uuid,uuid,text,text),public.revoke_native_push_installation(uuid,uuid) TO authenticated;
