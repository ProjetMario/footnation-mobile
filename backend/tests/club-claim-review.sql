\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
CREATE TABLE public.fff_clubs(id uuid PRIMARY KEY,name text,logo_url text,metadata jsonb);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_admin boolean DEFAULT false,account_type text,is_verified boolean DEFAULT false,is_published boolean DEFAULT true,club_official_name text,avatar_url text,linked_club_id uuid REFERENCES public.fff_clubs(id));
CREATE TABLE public.club_admins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid REFERENCES public.fff_clubs(id),profile_id uuid REFERENCES public.profiles(id),role text NOT NULL DEFAULT 'admin',UNIQUE(club_id,profile_id));
CREATE TABLE public.club_claim_requests(id uuid PRIMARY KEY,club_id uuid NOT NULL REFERENCES public.fff_clubs(id),user_id uuid NOT NULL REFERENCES public.profiles(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),admin_notes text,reviewed_at timestamptz,reviewed_by uuid REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT '2026-09-08T00:00:00Z');
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fff_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_claim_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
CREATE POLICY profiles_read ON public.profiles FOR SELECT USING(id=auth.uid());
CREATE POLICY claims_read ON public.club_claim_requests FOR SELECT USING(user_id=auth.uid());
INSERT INTO public.fff_clubs VALUES ('10000000-0000-0000-0000-000000000001','Club officiel','logo', '{"retained":"yes"}');
INSERT INTO public.profiles(id,is_admin) VALUES('00000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-000000000002',false),('00000000-0000-0000-0000-000000000003',false);
INSERT INTO public.profiles(id,account_type,linked_club_id) VALUES('00000000-0000-0000-0000-000000000004','club','10000000-0000-0000-0000-000000000001');
INSERT INTO public.club_claim_requests(id,club_id,user_id) SELECT ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002' FROM generate_series(1,4) n;
\ir ../migrations/20260908012000_native_club_claim_review.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','approved',null,'2026-09-08T00:00:00Z'); RAISE EXCEPTION 'Self review permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 BEGIN PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','rejected',null,'2026-09-08T00:00:00Z'); RAISE EXCEPTION 'Third-party review permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','pending',null,'2026-09-08T00:00:00Z'); RAISE EXCEPTION 'Invalid decision permitted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','approved',null,'2026-09-07T00:00:00Z'); RAISE EXCEPTION 'Stale review permitted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','approved','Checked','2026-09-08T00:00:00Z');
 PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','approved','Do not replace',null);
 BEGIN PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000001','rejected',null,'2026-09-08T00:00:00Z'); RAISE EXCEPTION 'Opposite review permitted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000002','rejected','Insufficient evidence','2026-09-08T00:00:00Z');
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.club_admins) <> 1 THEN RAISE EXCEPTION 'Admin grant or retry failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE account_type='club' AND is_verified AND NOT is_published AND club_official_name='Club officiel' AND avatar_url='logo') THEN RAISE EXCEPTION 'Official identity incomplete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fff_clubs WHERE metadata->>'retained'='yes' AND metadata->>'is_verified'='true') THEN RAISE EXCEPTION 'Club metadata lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_claim_requests WHERE status='approved' AND admin_notes='Checked' AND reviewed_at IS NOT NULL AND reviewed_by='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Review audit lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_claim_requests WHERE status='rejected' AND reviewed_at IS NOT NULL AND admin_notes='Insufficient evidence') THEN RAISE EXCEPTION 'Rejection incomplete'; END IF;
 IF has_function_privilege('anon','public.review_club_claim(uuid,text,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execute allowed'; END IF;
END $$;
-- Failure in the final write must undo preceding membership/profile/club changes.
DELETE FROM public.club_admins;
UPDATE public.profiles SET is_verified=false,is_published=true WHERE account_type='club';
UPDATE public.fff_clubs SET metadata='{"retained":"rollback"}';
CREATE FUNCTION public.fail_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced final write failure' USING ERRCODE='23514'; END $$;
CREATE TRIGGER fail_review BEFORE UPDATE ON public.club_claim_requests FOR EACH ROW EXECUTE FUNCTION public.fail_review();
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.review_club_claim('20000000-0000-0000-0000-000000000003','approved',null,'2026-09-08T00:00:00Z'); RAISE EXCEPTION 'Fault injection failed'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.club_admins) OR EXISTS(SELECT 1 FROM public.profiles WHERE account_type='club' AND is_verified) OR EXISTS(SELECT 1 FROM public.fff_clubs WHERE metadata <> '{"retained":"rollback"}'::jsonb) THEN RAISE EXCEPTION 'Partial approval survived rollback'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_claim_requests WHERE id='20000000-0000-0000-0000-000000000003' AND status='pending' AND reviewed_by IS NULL) THEN RAISE EXCEPTION 'Claim changed on failure'; END IF;
END $$;
SELECT 'Club claim review: authorization, stale decisions, retries, metadata and atomic rollback passed' AS result;
