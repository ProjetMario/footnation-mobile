\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=auth.uid() $$;
CREATE TABLE club_news(id uuid PRIMARY KEY,club_id uuid,title text,excerpt text,content text,is_published boolean,is_pinned boolean,published_at timestamptz,media_urls text[],author_id uuid);
CREATE TABLE teams(id uuid PRIMARY KEY,club_id uuid,name text,category text,age_group text,season text,is_active boolean,is_from_fff boolean);
ALTER TABLE club_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_news ON club_news USING(club_id=auth.uid() AND coalesce(current_setting('test.deny',true),'')<>'yes');
CREATE POLICY own_team ON teams USING(club_id=auth.uid());
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT SELECT,UPDATE,DELETE ON club_news,teams TO authenticated;
INSERT INTO club_news VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','Original',NULL,'Article',true,false,'2026-09-08T14:30:00Z',ARRAY['a,b','quote"','back\slash'],NULL);
INSERT INTO teams VALUES('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','Equipe','Senior',NULL,'2026',true,true);
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908029000_native_club_record_snapshot.sql
DO $$ BEGIN
 IF has_function_privilege('anon','mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean)'::regprocedure) THEN RAISE EXCEPTION 'RLS bypass'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ DECLARE old jsonb; fresh jsonb; club uuid:='00000000-0000-0000-0000-000000000001'; rowid uuid:='00000000-0000-0000-0000-000000000011'; BEGIN
 SELECT to_jsonb(n) INTO old FROM club_news n WHERE id=rowid;
 old:=jsonb_set(old,'{published_at}','"2026-09-08T14:30:00.000Z"');
 PERFORM mutate_native_club_record_snapshot('news',club,rowid,jsonb_build_object('content',repeat('é',8000)||chr(10)||'Fin'),old,false);
 IF (SELECT length(content) FROM club_news WHERE id=rowid)<>8004 THEN RAISE EXCEPTION 'Long text lost'; END IF;
 BEGIN PERFORM mutate_native_club_record_snapshot('news',club,rowid,'{"title":"Stale"}',old,false); RAISE EXCEPTION 'Stale update accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM mutate_native_club_record_snapshot('news',club,rowid,'{}',old,true); RAISE EXCEPTION 'Stale delete accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT to_jsonb(n) INTO fresh FROM club_news n WHERE id=rowid;
 BEGIN PERFORM mutate_native_club_record_snapshot('news',club,rowid,'{"title":"Incomplete"}',fresh-'excerpt',false); RAISE EXCEPTION 'Incomplete accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM mutate_native_club_record_snapshot('news',club,rowid,'{"author_id":null}',fresh,false); RAISE EXCEPTION 'Author change accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM mutate_native_club_record_snapshot('news;DROP TABLE teams',club,rowid,'{}',fresh,true); RAISE EXCEPTION 'Table injection'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM mutate_native_club_record_snapshot('news','00000000-0000-0000-0000-000000000002',rowid,'{}',fresh,true); RAISE EXCEPTION 'Other club'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.deny','yes',true);
 BEGIN PERFORM mutate_native_club_record_snapshot('news',club,rowid,'{"title":"Denied"}',fresh,false); RAISE EXCEPTION 'RLS bypass'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM set_config('test.deny','no',true);
 PERFORM mutate_native_club_record_snapshot('news',club,rowid,'{}',fresh,true);
 IF EXISTS(SELECT 1 FROM club_news WHERE id=rowid) THEN RAISE EXCEPTION 'Delete failed'; END IF;
 SELECT to_jsonb(t) INTO fresh FROM teams t;
 BEGIN PERFORM mutate_native_club_record_snapshot('teams',club,(fresh->>'id')::uuid,'{"is_from_fff":false}',fresh,false); RAISE EXCEPTION 'Official flag change'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM mutate_native_club_record_snapshot('teams',club,(fresh->>'id')::uuid,'{"name":"Nouvelle équipe"}',fresh,false);
END $$;
\echo Club record snapshot: long Unicode, timestamp normalization, arrays/nulls, stale update/delete, complete snapshot, protected fields, caller scope and RLS passed.
