\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_site_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE public.fff_clubs(id uuid PRIMARY KEY,metadata jsonb);
INSERT INTO public.fff_clubs VALUES('10000000-0000-0000-0000-000000000001','{"other":{"kept":true}}');
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT ON public.fff_clubs TO authenticated,anon;
\ir ../migrations/20260908016000_native_club_status.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_verified',true,null); RAISE EXCEPTION 'Unauthorized write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_verified',true,null);
SELECT public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_verified',true,null);
DO $$ BEGIN
 BEGIN PERFORM public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_verified',false,null); RAISE EXCEPTION 'Stale write'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.set_native_club_status('10000000-0000-0000-0000-000000000001','other',true,null); RAISE EXCEPTION 'Unknown field'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_suspended',null,null); RAISE EXCEPTION 'Null status'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.set_native_club_status('10000000-0000-0000-0000-000000000099','is_suspended',true,null); RAISE EXCEPTION 'Missing club'; EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
SELECT public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_suspended',true,null);
SELECT public.set_native_club_status('10000000-0000-0000-0000-000000000001','is_verified',false,true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fff_clubs WHERE metadata='{"other":{"kept":true},"is_verified":false,"is_suspended":true}'::jsonb) THEN RAISE EXCEPTION 'Metadata lost'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.set_native_club_status(uuid,text,boolean,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous grant'; END IF;
END $$;
\echo Club status: authorization, concurrency, retry, validation and metadata preservation passed.
