\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE club_admins(id uuid PRIMARY KEY,club_id uuid,profile_id uuid,role text DEFAULT 'admin',created_at timestamptz DEFAULT now(),UNIQUE(club_id,profile_id));
CREATE FUNCTION public.is_fff_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000009'::uuid OR EXISTS(SELECT 1 FROM public.club_admins WHERE club_id=$1 AND profile_id=auth.uid()) $$;
ALTER TABLE club_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_all ON club_admins FOR SELECT USING(true);
CREATE POLICY "Club admins can manage other admins" ON club_admins FOR INSERT WITH CHECK(false);
CREATE POLICY "Club admins can remove other admins" ON club_admins FOR DELETE USING(false);
CREATE POLICY "Club admins can update admin roles" ON club_admins FOR UPDATE USING(false);
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON club_admins TO authenticated;
INSERT INTO club_admins(id,club_id,profile_id) VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000002');
\ir ../migrations/20260908032000_native_club_admin_integrity.sql
\ir ../migrations/20260908033000_native_club_admin_nonnull.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN DELETE FROM club_admins WHERE profile_id=auth.uid(); RAISE EXCEPTION 'Self removal accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_admins SET profile_id='00000000-0000-0000-0000-000000000003' WHERE profile_id=auth.uid(); RAISE EXCEPTION 'Identity replacement'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE club_admins SET role='owner' WHERE profile_id=auth.uid();
 DELETE FROM club_admins WHERE profile_id='00000000-0000-0000-0000-000000000002';
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN INSERT INTO club_admins(id,club_id,profile_id) VALUES('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000100',auth.uid()); RAISE EXCEPTION 'Removed admin returned'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO club_admins(id,club_id,profile_id) VALUES('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000100',NULL);
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000009';
DO $$ BEGIN
 BEGIN INSERT INTO club_admins(id,club_id,profile_id) VALUES('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000100',NULL); RAISE EXCEPTION 'Null profile accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN DELETE FROM club_admins WHERE profile_id IS NOT NULL; RAISE EXCEPTION 'Last admin removed'; EXCEPTION WHEN check_violation THEN NULL; END;
 DELETE FROM club_admins WHERE profile_id IS NULL;
 INSERT INTO club_admins(id,club_id,profile_id) VALUES('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000002');
END $$;
RESET ROLE;
\echo Club admin integrity: self removal, identity changes, revoked authority, site admin repair and final administrator protection passed.
