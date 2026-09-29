\set ON_ERROR_STOP on
\ir club-player-management.sql
CREATE TABLE club_staff(id uuid PRIMARY KEY,club_id uuid NOT NULL,profile_id uuid,name text NOT NULL,role text NOT NULL,category text,is_active boolean DEFAULT true,joined_at date DEFAULT CURRENT_DATE,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),email text,phone text,metadata jsonb,source_type text,source_url text,retrieved_at timestamptz);
CREATE TABLE staff_history(staff_id uuid REFERENCES club_staff ON DELETE CASCADE);
ALTER TABLE club_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_staff ON club_staff FOR SELECT USING(true);
GRANT SELECT ON club_staff TO authenticated;
CREATE OR REPLACE FUNCTION public.is_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.is_fff_club_admin($1) OR auth.uid()='00000000-0000-0000-0000-000000000002'::uuid $$;
\ir ../migrations/20260908038000_native_club_staff_management.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
INSERT INTO club_staff(id,club_id,name,role,category) VALUES('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000100','Coach','Entraîneur','U18');
RESET ROLE;
INSERT INTO staff_history VALUES('00000000-0000-0000-0000-000000000021');
UPDATE club_staff SET profile_id='00000000-0000-0000-0000-000000000002',metadata='{"source":"import"}';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r uuid:='00000000-0000-0000-0000-000000000021'; c uuid:='00000000-0000-0000-0000-000000000100'; old jsonb; BEGIN
 SELECT to_jsonb(s) INTO old FROM club_staff s WHERE id=r;
 PERFORM mutate_native_club_record_snapshot('staff',c,r,'{"name":"Nom corrigé","role":"Adjoint","category":"Seniors"}',old,false);
 BEGIN PERFORM mutate_native_club_record_snapshot('staff',c,r,'{"is_active":false}',old,false); RAISE EXCEPTION 'Stale archive'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT to_jsonb(s) INTO old FROM club_staff s WHERE id=r;
 PERFORM mutate_native_club_record_snapshot('staff',c,r,'{"is_active":false}',old,false);
 SELECT to_jsonb(s) INTO old FROM club_staff s WHERE id=r;
 BEGIN PERFORM mutate_native_club_record_snapshot('staff',c,r,'{}',old,true); RAISE EXCEPTION 'History deletion'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM mutate_native_club_record_snapshot('staff',c,r,'{"is_active":true}',old,false);
 BEGIN UPDATE club_staff SET profile_id=NULL WHERE id=r; RAISE EXCEPTION 'Account relink'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_staff SET club_id='00000000-0000-0000-0000-000000000101' WHERE id=r; RAISE EXCEPTION 'Club transfer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_staff SET metadata='{}' WHERE id=r; RAISE EXCEPTION 'Imported data tampering'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_staff SET role=' ' WHERE id=r; RAISE EXCEPTION 'Empty role'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN INSERT INTO club_staff(id,club_id,name,role,profile_id) VALUES('00000000-0000-0000-0000-000000000022',c,'Autre','admin','00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Forged association'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT to_jsonb(s) INTO old FROM club_staff s WHERE id=r;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM mutate_native_club_record_snapshot('staff',c,r,'{"role":"admin"}',old,false); RAISE EXCEPTION 'Staff self elevation'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN INSERT INTO club_staff(id,club_id,name,role) VALUES('00000000-0000-0000-0000-000000000022',c,'Autre','admin'); RAISE EXCEPTION 'Staff creation authority'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 BEGIN PERFORM mutate_native_club_record_snapshot('staff',c,r,'{"role":"admin"}',old,false); RAISE EXCEPTION 'Unrelated account'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM staff_history)<>1 OR (SELECT count(*) FROM club_staff WHERE is_active AND role='Adjoint' AND category='Seniors' AND profile_id IS NOT NULL AND metadata='{"source":"import"}')<>1 THEN RAISE EXCEPTION 'History or identity lost'; END IF;
 IF has_function_privilege('anon','public.mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous write'; END IF;
END $$;
\echo Staff: authorized create/edit/archive/restore, stale conflict, history preservation, immutable linked account, restricted authority and anonymous denial passed.
