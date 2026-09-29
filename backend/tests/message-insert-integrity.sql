\set ON_ERROR_STOP on
\ir message-update-integrity.sql
CREATE POLICY own_insert ON messages FOR INSERT WITH CHECK(sender_id=auth.uid());
GRANT INSERT ON messages TO authenticated,anon;
\ir ../migrations/20260908046000_native_message_insert_integrity.sql
SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
INSERT INTO messages(id,sender_id,receiver_id,content,created_at,read_at,is_blocked,blocked_reason,blocked_at,blocked_by)
VALUES('00000000-0000-0000-0000-000000000010',auth.uid(),'00000000-0000-0000-0000-000000000003',' Bonjour exact ','2099-01-01','2099-01-01',true,'Forged','2099-01-01',auth.uid());
DO $$ DECLARE row public.messages; BEGIN
 SELECT * INTO STRICT row FROM messages WHERE id='00000000-0000-0000-0000-000000000010';
 IF row.created_at IS DISTINCT FROM now() OR row.read_at IS NOT NULL OR row.is_blocked IS DISTINCT FROM false OR row.blocked_reason IS NOT NULL OR row.blocked_by IS NOT NULL OR row.blocked_at IS NOT NULL THEN RAISE EXCEPTION 'Forged delivery metadata retained'; END IF;
 IF row.content<>' Bonjour exact ' THEN RAISE EXCEPTION 'Content changed and retry would fail'; END IF;
 BEGIN INSERT INTO messages(id,sender_id,receiver_id,content) VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000004',auth.uid(),'Spoof'); RAISE EXCEPTION 'Sender spoofing accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO messages(id,sender_id,receiver_id,content) VALUES(row.id,auth.uid(),row.receiver_id,row.content); RAISE EXCEPTION 'Duplicate ID accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
UPDATE messages SET read_at='2099-01-01' WHERE id='00000000-0000-0000-0000-000000000010';
DO $$ BEGIN IF (SELECT read_at FROM messages WHERE id='00000000-0000-0000-0000-000000000010') IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Recipient read after send failed'; END IF; END $$;
RESET ROLE; SET ROLE anon; SET request.jwt.claim.sub='';
DO $$ BEGIN
 BEGIN INSERT INTO messages(id,sender_id,receiver_id,content) VALUES('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Anonymous'); RAISE EXCEPTION 'Anonymous insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO messages(id,sender_id,receiver_id,content,created_at,is_blocked) VALUES('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Server import','2020-01-01',true);
DO $$ BEGIN IF (SELECT created_at FROM messages WHERE id='00000000-0000-0000-0000-000000000013') IS DISTINCT FROM '2020-01-01'::timestamptz THEN RAISE EXCEPTION 'Server import altered'; END IF; END $$;
\echo Message creation timestamps, unread state, moderation metadata, stable IDs and recipient read flow passed.
