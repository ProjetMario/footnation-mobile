-- Run only in a NEW disposable database; no linked/remote data is used.
DO $$ BEGIN
  IF current_database() NOT LIKE 'native_feedback_test_%' THEN RAISE EXCEPTION 'Disposable DB required'; END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN RAISE EXCEPTION 'Empty DB required'; END IF;
END $$;
CREATE SCHEMA auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),is_admin boolean DEFAULT false,is_suspended boolean DEFAULT false,suspended_until timestamptz);
CREATE FUNCTION public.is_site_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT coalesce((SELECT is_admin FROM public.profiles WHERE id=auth.uid()),false) $$;
-- Minimal representative allowlist contract: the migration must extend it.
CREATE FUNCTION public.account_deletion_check(p_user uuid) RETURNS text[] LANGUAGE sql AS $$ SELECT ARRAY['public.support_tickets.user_id'] $$;
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
INSERT INTO profiles(id,is_admin) SELECT id,id='00000000-0000-4000-8000-000000000003' FROM auth.users;
\ir ../../../supabase/migrations/20260911075000_native_beta_feedback.sql
DO $$ BEGIN
  IF has_table_privilege('authenticated','public.native_beta_feedback','SELECT') OR has_table_privilege('authenticated','public.native_beta_feedback','INSERT') THEN RAISE EXCEPTION 'Direct access leaked'; END IF;
  IF has_function_privilege('anon','public.submit_native_beta_feedback(uuid,uuid,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Anon submit leaked'; END IF;
  IF position('public.native_beta_feedback.user_id' IN pg_get_functiondef('public.account_deletion_check(uuid)'::regprocedure))=0 THEN RAISE EXCEPTION 'Deletion integration missing'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SELECT public.submit_native_beta_feedback('10000000-0000-4000-8000-000000000001',auth.uid(),'bug','team',' Ma convocation ne se charge plus. ','ios','1.0.0');
SELECT public.submit_native_beta_feedback('10000000-0000-4000-8000-000000000001',auth.uid(),'bug','team','Ma convocation ne se charge plus.','ios','1.0.0');
DO $$ BEGIN
  BEGIN PERFORM * FROM public.get_native_beta_feedback(auth.uid()); RAISE EXCEPTION 'Non-admin read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.submit_native_beta_feedback(gen_random_uuid(),'00000000-0000-4000-8000-000000000002','bug','team','Valid report text','ios','1.0.0'); RAISE EXCEPTION 'Spoof accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.submit_native_beta_feedback(gen_random_uuid(),auth.uid(),'bug','team','tiny','ios','1.0.0'); RAISE EXCEPTION 'Short report accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.submit_native_beta_feedback('10000000-0000-4000-8000-000000000001',auth.uid(),'bug','team','Different content now','ios','1.0.0'); RAISE EXCEPTION 'Reused ID mutated report'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.review_native_beta_feedback(auth.uid(),'10000000-0000-4000-8000-000000000001','resolved',now()); RAISE EXCEPTION 'User review allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.native_beta_feedback)<>1 THEN RAISE EXCEPTION 'Duplicate feedback'; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
DO $$ DECLARE row public.native_beta_feedback; BEGIN
  SELECT * INTO row FROM public.get_native_beta_feedback(auth.uid());
  IF row.message<>'Ma convocation ne se charge plus.' THEN RAISE EXCEPTION 'Admin report unavailable'; END IF;
  PERFORM public.review_native_beta_feedback(auth.uid(),row.id,'reviewing',row.updated_at);
  BEGIN PERFORM public.review_native_beta_feedback(auth.uid(),row.id,'resolved',row.updated_at); RAISE EXCEPTION 'Stale update accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
UPDATE profiles SET is_suspended=true WHERE id='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.submit_native_beta_feedback(gen_random_uuid(),auth.uid(),'bug','team','Valid report text','web','1.0.0'); RAISE EXCEPTION 'Suspended user allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM profiles WHERE id='00000000-0000-4000-8000-000000000001';
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF EXISTS(SELECT FROM public.native_beta_feedback) THEN RAISE EXCEPTION 'Deleted user feedback retained'; END IF; END $$;
SELECT 'PASS feedback auth, validation, idempotency, review concurrency, cascade' AS result;
