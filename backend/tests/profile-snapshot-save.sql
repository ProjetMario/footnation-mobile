\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,bio text,full_name text,skills text[],institution_phone text,is_admin boolean DEFAULT false);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','Original','User',ARRAY['a,b','quote"','back\slash'],NULL,false),('00000000-0000-0000-0000-000000000002','Other','Other',ARRAY[]::text[],NULL,false);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON profiles FOR SELECT USING(id=auth.uid());
CREATE POLICY own_update ON profiles FOR UPDATE USING(id=auth.uid()) WITH CHECK(id=auth.uid());
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT SELECT,UPDATE ON profiles TO authenticated;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908024000_native_profile_snapshot_save.sql
\ir ../migrations/20260908026000_native_institution_profile_phone.sql
DO $$ BEGIN IF has_function_privilege('anon','update_native_profile_snapshot(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous access'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r jsonb; BEGIN
 PERFORM update_native_profile_snapshot('{"institution_phone":"0102030405"}','{"institution_phone":null}');
 r:=update_native_profile_snapshot(jsonb_build_object('bio',repeat('é',3000),'skills',ARRAY['New','line'||chr(10)||'break']),jsonb_build_object('bio','Original','skills',ARRAY['a,b','quote"','back\slash']));
 IF length(r->>'bio')<>3000 OR r->'skills'<>to_jsonb(ARRAY['New','line'||chr(10)||'break']) THEN RAISE EXCEPTION 'Large values/array lost'; END IF;
 BEGIN PERFORM update_native_profile_snapshot('{"bio":"Mine"}','{"bio":"Original"}'); RAISE EXCEPTION 'Stale snapshot accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM update_native_profile_snapshot('{"bio":"Mine"}','{}'); RAISE EXCEPTION 'Missing expectation'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_profile_snapshot('{"is_admin":true}','{"is_admin":false}'); RAISE EXCEPTION 'Authority escalation'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_profile_snapshot('{"id":"00000000-0000-0000-0000-000000000002"}','{"id":"00000000-0000-0000-0000-000000000001"}'); RAISE EXCEPTION 'Identity change'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_profile_snapshot('{"bio":"Other user"}','{"bio":"Other"}'); RAISE EXCEPTION 'Other profile modified'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM update_native_profile_snapshot('{"full_name":null}','{"full_name":"User"}');
 PERFORM update_native_profile_snapshot('{"full_name":"Restored"}','{"full_name":null}');
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT bio FROM profiles WHERE id='00000000-0000-0000-0000-000000000002')<>'Other' THEN RAISE EXCEPTION 'Other profile changed'; END IF; END $$;
\echo Profile snapshot: large Unicode text, arrays, nulls, stale writes, missing fields, protected fields and own-row scope passed.
