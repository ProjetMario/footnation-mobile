\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000009'::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,linked_club_id uuid,primary_role text);
CREATE TABLE club_membership_requests(id uuid PRIMARY KEY,club_id uuid,profile_id uuid,requested_role text,invited_by uuid,status text,responded_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
ALTER TABLE club_membership_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON club_membership_requests FOR SELECT USING(profile_id=auth.uid() OR is_club_admin(club_id));
CREATE POLICY own_update ON club_membership_requests FOR UPDATE USING(profile_id=auth.uid()) WITH CHECK(profile_id=auth.uid());
CREATE POLICY admin_insert ON club_membership_requests FOR INSERT WITH CHECK(is_club_admin(club_id));
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON club_membership_requests TO authenticated;
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001',NULL,'Ancien rôle');
INSERT INTO club_membership_requests(id,club_id,profile_id,requested_role,status) VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001','Joueur','pending'),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001','Joueur','pending');
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908034000_native_membership_response.sql
DO $$ BEGIN IF has_function_privilege('anon','accept_club_membership_request(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous acceptance'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN BEGIN PERFORM accept_club_membership_request('00000000-0000-0000-0000-000000000011'); RAISE EXCEPTION 'Foreign acceptance'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN UPDATE club_membership_requests SET status='accepted' WHERE id='00000000-0000-0000-0000-000000000011'; RAISE EXCEPTION 'Direct acceptance bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_membership_requests SET requested_role='President',status='rejected' WHERE id='00000000-0000-0000-0000-000000000011'; RAISE EXCEPTION 'Role tampering'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM accept_club_membership_request('00000000-0000-0000-0000-000000000011');
 PERFORM accept_club_membership_request('00000000-0000-0000-0000-000000000011');
 BEGIN UPDATE club_membership_requests SET status='rejected' WHERE id='00000000-0000-0000-0000-000000000011'; RAISE EXCEPTION 'Accepted request rewritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE club_membership_requests SET status='rejected' WHERE id='00000000-0000-0000-0000-000000000012';
 BEGIN PERFORM accept_club_membership_request('00000000-0000-0000-0000-000000000012'); RAISE EXCEPTION 'Rejected request accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM profiles WHERE linked_club_id='00000000-0000-0000-0000-000000000100' AND primary_role='Joueur') THEN RAISE EXCEPTION 'Membership not applied'; END IF; END $$;
\echo Membership responses: own acceptance and retry, foreign/anonymous refusal, role integrity, decline and terminal-state protection passed.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000009';
DO $$ BEGIN
 BEGIN INSERT INTO club_membership_requests(id,club_id,profile_id,requested_role,invited_by,status) VALUES('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001','Joueur','00000000-0000-0000-0000-000000000002','pending'); RAISE EXCEPTION 'Forged inviter'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO club_membership_requests(id,club_id,profile_id,requested_role,invited_by,status) VALUES('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001','Joueur',auth.uid(),'pending');
END $$;
RESET ROLE;
UPDATE profiles SET linked_club_id='00000000-0000-0000-0000-000000000200';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT accept_club_membership_request('00000000-0000-0000-0000-000000000011');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM profiles WHERE linked_club_id<>'00000000-0000-0000-0000-000000000200') THEN RAISE EXCEPTION 'Retry overwrote subsequent membership'; END IF; END $$;
\echo Invitation identity and accepted retry preserve subsequent membership.
