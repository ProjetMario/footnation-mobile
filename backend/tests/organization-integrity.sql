\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
GRANT DELETE,SELECT ON profiles TO authenticated;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile_delete ON profiles FOR DELETE USING(id=auth.uid());
CREATE POLICY own_profile_read ON profiles FOR SELECT USING(id=auth.uid());
CREATE TABLE organizations(id uuid PRIMARY KEY,name text,type text,website text,address text,contact_email text,department text,description text,created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,created_at timestamptz DEFAULT now(),verified boolean DEFAULT false);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON organizations TO authenticated;
CREATE POLICY org_read ON organizations FOR SELECT USING(true);
CREATE POLICY org_insert ON organizations FOR INSERT WITH CHECK(created_by=auth.uid());
CREATE POLICY org_update ON organizations FOR UPDATE USING(created_by=auth.uid());
CREATE POLICY org_delete ON organizations FOR DELETE USING(created_by=auth.uid());
\ir ../migrations/20260908054000_native_organization_integrity.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO organizations(id,name,type,created_by,created_at,verified) VALUES('00000000-0000-0000-0000-000000000010','Club','club',auth.uid(),'2099-01-01',true);
DO $$ BEGIN
 IF (SELECT verified FROM organizations) OR (SELECT created_at FROM organizations) IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Self verification or forged timestamp'; END IF;
 BEGIN UPDATE organizations SET verified=true; RAISE EXCEPTION 'Self verification accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE organizations SET verified=NULL; RAISE EXCEPTION 'Null verification accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE organizations SET created_by='00000000-0000-0000-0000-000000000002'; RAISE EXCEPTION 'Transfer owner'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE organizations SET id='00000000-0000-0000-0000-000000000011'; RAISE EXCEPTION 'Rewrite id'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE organizations SET created_at='2099-01-01'; RAISE EXCEPTION 'Rewrite date'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE; UPDATE organizations SET verified=true;
SET ROLE authenticated; UPDATE organizations SET description='Nouvelle description';
DO $$ BEGIN IF NOT (SELECT verified FROM organizations) THEN RAISE EXCEPTION 'Description removed verification'; END IF; END $$;
UPDATE organizations SET name='Different identity';
DO $$ BEGIN IF (SELECT verified FROM organizations) THEN RAISE EXCEPTION 'Identity change kept old verification'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 UPDATE organizations SET name='Other owner';
 IF FOUND THEN RAISE EXCEPTION 'Other owner update'; END IF;
 BEGIN INSERT INTO organizations(id,created_by) VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'Forged creator'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DELETE FROM profiles WHERE id=auth.uid();
RESET ROLE;
DO $$ BEGIN IF (SELECT created_by FROM organizations) IS NOT NULL THEN RAISE EXCEPTION 'Account deletion blocked'; END IF; END $$;
\echo Organization verification, identity, server timestamp and owner scope passed.
