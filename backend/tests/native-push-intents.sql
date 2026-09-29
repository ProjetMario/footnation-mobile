\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE TABLE profiles(id uuid PRIMARY KEY);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
\ir ../migrations/20260908055000_native_push_registry.sql
\ir ../migrations/20260909056000_native_push_intents.sql
CREATE FUNCTION public.expect_push_error(command text,expected_code text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_code text;
BEGIN
 BEGIN
  EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE;
  IF actual_code=expected_code THEN RETURN; END IF;
  RAISE EXCEPTION 'Expected SQLSTATE %, got %',expected_code,actual_code;
 END;
 RAISE EXCEPTION 'Expected SQLSTATE %, operation succeeded',expected_code;
END $$;

SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
-- A timed-out registration may arrive after cancellation. The tombstone wins.
SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','ios','30000000-0000-0000-0000-000000000001')$q$,'55000');
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.native_push_installations) THEN RAISE EXCEPTION 'Cancellation created an active registration'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.native_push_intents WHERE lease_id='30000000-0000-0000-0000-000000000001' AND state='revoked') THEN RAISE EXCEPTION 'Cancellation tombstone absent'; END IF;
END $$;

SET ROLE authenticated;
SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','ios','30000000-0000-0000-0000-000000000002');
RESET ROLE;
CREATE TEMP TABLE push_snapshot AS SELECT to_jsonb(i) AS row FROM public.native_push_installations i;
CREATE TEMP TABLE intent_snapshot AS SELECT to_jsonb(i) AS row FROM public.native_push_intents i WHERE lease_id='30000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
-- Retry after a lost success response returns the same lease without mutation.
DO $$ BEGIN
 IF public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','ios','30000000-0000-0000-0000-000000000002')<>'30000000-0000-0000-0000-000000000002'::uuid THEN RAISE EXCEPTION 'Retry changed lease'; END IF;
END $$;
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[other]','ios','30000000-0000-0000-0000-000000000002')$q$,'55000');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','ExpoPushToken[test_token]','ios','30000000-0000-0000-0000-000000000002')$q$,'55000');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','android','30000000-0000-0000-0000-000000000002')$q$,'55000');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','ios','30000000-0000-0000-0000-000000000002')$q$,'42501');
SELECT public.expect_push_error($q$SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002')$q$,'42501');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT to_jsonb(i) FROM public.native_push_installations i)<>(SELECT row FROM push_snapshot) THEN RAISE EXCEPTION 'Retry changed installation payload or lifetime'; END IF;
 IF (SELECT to_jsonb(i) FROM public.native_push_intents i WHERE lease_id='30000000-0000-0000-0000-000000000002')<>(SELECT row FROM intent_snapshot) THEN RAISE EXCEPTION 'Retry changed intent'; END IF;
END $$;

SET ROLE authenticated;
-- A new operation rotates the token; neither stale retry nor stale revoke wins.
SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[rotated]','android','30000000-0000-0000-0000-000000000003');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[test_token]','ios','30000000-0000-0000-0000-000000000002')$q$,'55000');
SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.native_push_installations WHERE lease_id='30000000-0000-0000-0000-000000000003' AND token='ExpoPushToken[rotated]' AND platform='android') THEN RAISE EXCEPTION 'Stale operation replaced or revoked the current registration'; END IF;
END $$;

SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[rotated]','android','30000000-0000-0000-0000-000000000003')$q$,'42501');
SELECT public.expect_push_error($q$SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003')$q$,'42501');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[unrelated]','ios','30000000-0000-0000-0000-000000000004')$q$,'42501');
-- The existing transfer rule requires possession of the current Expo token.
SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[rotated]','ios','30000000-0000-0000-0000-000000000004');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[rotated]','android','30000000-0000-0000-0000-000000000003')$q$,'55000');
SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.native_push_installations)<>1 OR NOT EXISTS(SELECT 1 FROM public.native_push_installations WHERE user_id='00000000-0000-0000-0000-000000000002' AND lease_id='30000000-0000-0000-0000-000000000004') THEN RAISE EXCEPTION 'Old account affected new recipient'; END IF;
END $$;

SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004');
SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[rotated]','ios','30000000-0000-0000-0000-000000000004')$q$,'55000');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.native_push_installations) THEN RAISE EXCEPTION 'Revoke retry recreated registration'; END IF; END $$;

SET ROLE authenticated;
-- Malformed input cannot create an operation or use the legacy escape hatch.
SELECT public.expect_push_error($q$SELECT public.register_native_push_device(NULL,'20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','ios','30000000-0000-0000-0000-000000000005')$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002',NULL,'ExpoPushToken[valid]','ios','30000000-0000-0000-0000-000000000005')$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',NULL,'ios','30000000-0000-0000-0000-000000000005')$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','invalid','ios','30000000-0000-0000-0000-000000000005')$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','web','30000000-0000-0000-0000-000000000005')$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','ios',NULL)$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.revoke_native_push_device(NULL,'30000000-0000-0000-0000-000000000005')$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.revoke_native_push_device('10000000-0000-0000-0000-000000000002',NULL)$q$,'22023');
SELECT public.expect_push_error($q$SELECT public.revoke_native_push_device('invalid-uuid','30000000-0000-0000-0000-000000000005')$q$,'22P02');
SELECT public.expect_push_error($q$SELECT public.register_native_push_installation('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','ios')$q$,'42501');
SELECT public.expect_push_error('SELECT * FROM public.native_push_installations','42501');
SELECT public.expect_push_error('SELECT * FROM public.native_push_intents','42501');
SELECT public.expect_push_error('DELETE FROM public.native_push_intents','42501');
SELECT public.expect_push_error($q$INSERT INTO public.native_push_intents VALUES('30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','registered',now())$q$,'42501');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.native_push_intents WHERE lease_id='30000000-0000-0000-0000-000000000005') THEN RAISE EXCEPTION 'Invalid payload persisted an intent'; END IF; END $$;

SET ROLE authenticated; SET request.jwt.claim.sub='';
SELECT public.expect_push_error('SELECT public.register_native_push_device(NULL,NULL,NULL,NULL,NULL)','42501');
SELECT public.expect_push_error('SELECT public.revoke_native_push_device(NULL,NULL)','42501');
RESET ROLE; SET ROLE anon;
SELECT public.expect_push_error('SELECT public.register_native_push_device(NULL,NULL,NULL,NULL,NULL)','42501');
SELECT public.expect_push_error('SELECT public.revoke_native_push_device(NULL,NULL)','42501');
SELECT public.expect_push_error('SELECT * FROM public.native_push_intents','42501');
RESET ROLE;

-- Re-enabling uses a new operation. Expired leases cannot be extended by retries.
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','ios','30000000-0000-0000-0000-000000000005');
RESET ROLE;
UPDATE public.native_push_installations SET expires_at=clock_timestamp()-interval '1 second';
SET ROLE authenticated;
SELECT public.expect_push_error($q$SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','ios','30000000-0000-0000-0000-000000000005')$q$,'55000');
SELECT public.register_native_push_device('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ExpoPushToken[valid]','ios','30000000-0000-0000-0000-000000000006');
RESET ROLE;
DELETE FROM profiles WHERE id='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.native_push_installations) OR EXISTS(SELECT 1 FROM public.native_push_intents WHERE user_id='00000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Account deletion retained registrations or tombstones'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.native_push_intents WHERE user_id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Deleting one account removed another account tombstones'; END IF;
 IF has_function_privilege('authenticated','public.register_native_push_installation(uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Legacy registration is callable by clients'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.native_push_intents'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Intent RLS missing'; END IF;
END $$;
SELECT 'native push intents: all assertions passed' AS result;
