\set ON_ERROR_STOP on
\ir connection-consent.sql
DELETE FROM connections;
INSERT INTO connections VALUES
('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','accepted',now()),
('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','accepted',now());
\ir ../migrations/20260908049000_native_connection_removal.sql
CREATE FUNCTION expected_connections() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'connected_user_id',connected_user_id,'status',status)) FROM connections $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ DECLARE snapshot jsonb := expected_connections(); BEGIN
 BEGIN PERFORM remove_native_connections('00000000-0000-0000-0000-000000000003',jsonb_build_array(snapshot->0)); RAISE EXCEPTION 'Partial snapshot accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM connections)<>2 THEN RAISE EXCEPTION 'Partial deletion'; END IF;
 BEGIN PERFORM remove_native_connections('00000000-0000-0000-0000-000000000003',jsonb_set(snapshot,'{0,status}','"pending"')); RAISE EXCEPTION 'Changed status accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM connections)<>2 THEN RAISE EXCEPTION 'Changed status partial deletion'; END IF;
 BEGIN PERFORM remove_native_connections('00000000-0000-0000-0000-000000000004',snapshot); RAISE EXCEPTION 'Other peer accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM remove_native_connections('00000000-0000-0000-0000-000000000003','null'); RAISE EXCEPTION 'Null snapshot accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF remove_native_connections('00000000-0000-0000-0000-000000000003',snapshot)<>2 THEN RAISE EXCEPTION 'Both links not removed'; END IF;
 IF remove_native_connections('00000000-0000-0000-0000-000000000003',snapshot)<>0 THEN RAISE EXCEPTION 'Retry not idempotent'; END IF;
END $$;
RESET ROLE;
INSERT INTO connections VALUES('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','pending',now());
SET ROLE authenticated;
DO $$ DECLARE snapshot jsonb := expected_connections(); BEGIN
 BEGIN PERFORM remove_native_connections('00000000-0000-0000-0000-000000000003',jsonb_set(snapshot,'{0,id}','"00000000-0000-0000-0000-000000000021"')); RAISE EXCEPTION 'Replacement deleted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM connections)<>1 THEN RAISE EXCEPTION 'Replacement missing'; END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM remove_native_connections('00000000-0000-0000-0000-000000000003','[]'); RAISE EXCEPTION 'Anonymous call accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
\echo Atomic reciprocal relationship removal and stale snapshot protection passed.
