\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE TABLE profiles(id uuid PRIMARY KEY);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
\ir ../migrations/20260908055000_native_push_registry.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.register_native_push_installation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','ios') AS oldlease \gset
SELECT public.register_native_push_installation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_rotated]','ios') AS newlease \gset
SELECT set_config('test.oldlease', :'oldlease',false),set_config('test.newlease', :'newlease',false);
DO $$ BEGIN
 IF public.revoke_native_push_installation('10000000-0000-0000-0000-000000000001',current_setting('test.oldlease')::uuid) THEN RAISE EXCEPTION 'Stale lease revoked new token'; END IF;
 BEGIN PERFORM * FROM public.native_push_installations; RAISE EXCEPTION 'Token disclosure'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.native_push_installations; RAISE EXCEPTION 'Direct delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.register_native_push_installation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','invalid','ios'); RAISE EXCEPTION 'Invalid token accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.register_native_push_installation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','web'); RAISE EXCEPTION 'Invalid platform accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM public.register_native_push_installation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[unrelated]','ios'); RAISE EXCEPTION 'Installation ID alone allowed takeover'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.revoke_native_push_installation('10000000-0000-0000-0000-000000000001',current_setting('test.newlease')::uuid) THEN RAISE EXCEPTION 'Other owner revoked token'; END IF; END $$;
SELECT public.register_native_push_installation('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_rotated]','android') AS transferred \gset
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM native_push_installations)<>1 THEN RAISE EXCEPTION 'Duplicate delivery target'; END IF;
 IF NOT EXISTS(SELECT 1 FROM native_push_installations WHERE user_id='00000000-0000-0000-0000-000000000002' AND platform='android' AND expires_at-updated_at=interval '30 days' AND updated_at<now()+interval '1 minute') THEN RAISE EXCEPTION 'Wrong owner or timestamps'; END IF;
END $$;
SET ROLE authenticated; SET request.jwt.claim.sub='';
DO $$ BEGIN
 BEGIN PERFORM public.revoke_native_push_installation(NULL,NULL); RAISE EXCEPTION 'Anonymous revoke'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.register_native_push_installation(NULL,NULL,NULL,NULL); RAISE EXCEPTION 'Anonymous register'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.revoke_native_push_installation('10000000-0000-0000-0000-000000000002', :'transferred') AS revoked \gset
\if :revoked
\else
\quit 1
\endif
SELECT public.register_native_push_installation('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_delete]','android');
RESET ROLE; DELETE FROM profiles WHERE id='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM native_push_installations) THEN RAISE EXCEPTION 'Account deletion retained tokens'; END IF; END $$;
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE i int; BEGIN
 FOR i IN 1..10 LOOP
  PERFORM public.register_native_push_installation(('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-0000-0000-000000000001','ExpoPushToken[limit_'||i||']','ios');
 END LOOP;
 BEGIN PERFORM public.register_native_push_installation('30000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001','ExpoPushToken[limit_11]','ios'); RAISE EXCEPTION 'Quota bypassed'; EXCEPTION WHEN program_limit_exceeded THEN NULL; END;
 PERFORM public.register_native_push_installation('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[limit_renewed]','ios');
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.register_native_push_installation(NULL,NULL,NULL,NULL); RAISE EXCEPTION 'Anon execute allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
