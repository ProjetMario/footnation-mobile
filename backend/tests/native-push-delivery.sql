-- Run ONLY in a fresh disposable database with footnation.push_test_disposable=1.
DO $$ BEGIN
 IF current_setting('footnation.push_test_disposable',true) IS DISTINCT FROM '1' OR to_regclass('public.profiles') IS NOT NULL THEN
  RAISE EXCEPTION 'Fresh disposable database required';
 END IF;
END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_suspended boolean,suspended_until timestamptz);
CREATE TABLE public.user_preferences(user_id uuid PRIMARY KEY,push_notifications boolean);
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.notifications(id uuid PRIMARY KEY,receiver_id uuid REFERENCES profiles(id),sender_id uuid,read boolean DEFAULT false,created_at timestamptz DEFAULT now());
INSERT INTO profiles(id) VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO user_preferences VALUES('00000000-0000-0000-0000-000000000001',true);
\ir ../../../supabase/migrations/20260908055000_native_push_registry.sql
\ir ../../../supabase/migrations/20260909056000_native_push_intents.sql
-- A historical notification must never be backfilled by deployment.
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
\ir ../../../supabase/migrations/20260911057000_native_push_delivery.sql
CREATE FUNCTION public.assert_push(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Push assertion: %',label; END IF; END $$;
SELECT assert_push(NOT EXISTS(SELECT 1 FROM native_push_deliveries),'no historical backfill');
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[synthetic]','ios','30000000-0000-0000-0000-000000000001');
SELECT assert_push(renew_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),'own lease renews');
SELECT assert_push(NOT renew_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000099'),'old lease cannot renew current token');
DO $$ BEGIN
 BEGIN PERFORM * FROM native_push_deliveries; RAISE EXCEPTION 'Token queue disclosed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100); RAISE EXCEPTION 'Client claimed pushes'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM finish_native_push_delivery(NULL,NULL,'invalid'); RAISE EXCEPTION 'Client invalidated pushes'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SELECT assert_push((SELECT count(*)=1 FROM native_push_deliveries),'one eligible job');
UPDATE user_preferences SET push_notifications=false;
SET ROLE authenticated;
SELECT assert_push(NOT renew_native_push_device('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),'opt-out cannot renew');
RESET ROLE;
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SELECT assert_push((SELECT count(*)=1 FROM native_push_deliveries),'opt-out does not enqueue');
SET ROLE service_role;
SELECT assert_push((SELECT count(*)=0 FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100)),'opt-out cancels already queued send');
RESET ROLE;
UPDATE user_preferences SET push_notifications=true;
INSERT INTO user_blocks VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SELECT assert_push((SELECT count(*)=1 FROM native_push_deliveries),'blocked sender does not enqueue');
DELETE FROM user_blocks;
UPDATE profiles SET is_suspended=true WHERE id='00000000-0000-0000-0000-000000000001';
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SELECT assert_push((SELECT count(*)=1 FROM native_push_deliveries),'suspended receiver does not enqueue');
UPDATE profiles SET is_suspended=false;
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
CREATE TEMP TABLE claimed AS SELECT * FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100);
SELECT assert_push((SELECT count(*)=1 FROM claimed),'one send claimed');
SELECT assert_push((SELECT count(*)=0 FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100)),'claim is exclusive');
SELECT assert_push(NOT finish_native_push_delivery(id,gen_random_uuid(),'accepted','wrong-ticket'),'stale claim rejected') FROM claimed;
SELECT assert_push(finish_native_push_delivery(id,claim_id,'accepted','ticket-a'),'ticket persisted') FROM claimed;
SELECT assert_push((SELECT state='receipt' AND next_attempt_at>clock_timestamp()+interval '14 minutes' FROM native_push_deliveries WHERE id=(SELECT id FROM claimed)),'receipt delayed 15 minutes');
-- Renew between send and receipt: DeviceNotRegistered for the old lease cannot revoke new token.
SET ROLE authenticated;
SELECT register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[new_synthetic]','ios','30000000-0000-0000-0000-000000000002');
RESET ROLE;
UPDATE native_push_deliveries SET next_attempt_at=clock_timestamp()-interval '1 minute' WHERE state='receipt';
CREATE TEMP TABLE receipts AS SELECT * FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','receipt',100);
SELECT assert_push(finish_native_push_delivery(id,claim_id,'invalid',NULL,'DeviceNotRegistered'),'invalid receipt recorded') FROM receipts;
SELECT assert_push(EXISTS(SELECT 1 FROM native_push_installations WHERE lease_id='30000000-0000-0000-0000-000000000002'),'renewed installation survives old receipt');
-- An interrupted HTTP send must not be automatically sent again.
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SELECT * FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100);
UPDATE native_push_deliveries SET claimed_at=clock_timestamp()-interval '3 minutes' WHERE state='sending';
SELECT assert_push((SELECT count(*)=0 FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100)),'ambiguous send not retried');
SELECT assert_push(EXISTS(SELECT 1 FROM native_push_deliveries WHERE state='unknown' AND error_code='TransportUnknown'),'ambiguous result explicit');
-- Definite transient failure retries are bounded, and invalidation of the current lease works.
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM claimed; INSERT INTO claimed SELECT * FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100);
SELECT assert_push(finish_native_push_delivery(id,claim_id,'retry',NULL,'ProviderUnavailable'),'transient schedules retry') FROM claimed;
SELECT assert_push(EXISTS(SELECT 1 FROM native_push_deliveries WHERE state='pending' AND next_attempt_at>clock_timestamp()),'backoff is in the future');
UPDATE native_push_deliveries SET attempts=4,next_attempt_at=clock_timestamp()-interval '1 minute' WHERE state='pending';
DELETE FROM claimed; INSERT INTO claimed SELECT * FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100);
SELECT finish_native_push_delivery(id,claim_id,'retry',NULL,'ProviderUnavailable') FROM claimed;
SELECT assert_push(NOT EXISTS(SELECT 1 FROM native_push_deliveries WHERE state='pending'),'five attempts stop');
INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM claimed; INSERT INTO claimed SELECT * FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100);
SELECT finish_native_push_delivery(id,claim_id,'invalid',NULL,'DeviceNotRegistered') FROM claimed;
SELECT assert_push(NOT EXISTS(SELECT 1 FROM native_push_installations),'current invalid token revoked');
SELECT assert_push(EXISTS(SELECT 1 FROM native_push_intents WHERE lease_id='30000000-0000-0000-0000-000000000002' AND state='revoked'),'invalid lease tombstone retained');
SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM claim_native_push_deliveries(NULL,'send',1); RAISE EXCEPTION 'Anon queue access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
