\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_fff_club_admin(cid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND cid='10000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE club_chat_groups(id uuid PRIMARY KEY,club_id uuid,name text);
CREATE TABLE club_chat_group_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES club_chat_groups(id),profile_id uuid);
CREATE TABLE club_chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES club_chat_groups(id),author_id uuid,content text NOT NULL, media_url text, reply_to_id uuid REFERENCES club_chat_messages(id), is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now(), edited_at timestamptz, is_blocked boolean NOT NULL DEFAULT false, blocked_reason text, blocked_at timestamptz, blocked_by uuid);
INSERT INTO club_chat_groups VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Own club'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Other club');
INSERT INTO club_chat_group_members(group_id,profile_id) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
INSERT INTO club_chat_messages(group_id,author_id,content) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Fixture');
ALTER TABLE club_chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_chat_messages ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON club_chat_groups,club_chat_group_members,club_chat_messages TO anon,authenticated;
CREATE POLICY "Admins manage groups" ON club_chat_groups USING(is_fff_club_admin(club_id)) WITH CHECK(is_fff_club_admin(club_id));
CREATE POLICY "Group members read groups" ON club_chat_groups FOR SELECT USING(EXISTS(SELECT 1 FROM club_chat_group_members m WHERE m.group_id=m.id AND m.profile_id=auth.uid()));
CREATE POLICY "Admins manage membership" ON club_chat_group_members USING(EXISTS(SELECT 1 FROM club_chat_groups g WHERE g.id=group_id AND is_fff_club_admin(g.club_id)));
CREATE POLICY "Members read membership" ON club_chat_group_members FOR SELECT USING(profile_id=auth.uid() OR EXISTS(SELECT 1 FROM club_chat_groups g WHERE g.id=group_id AND is_fff_club_admin(g.club_id)));
CREATE POLICY "Members read messages" ON club_chat_messages FOR SELECT USING(EXISTS(SELECT 1 FROM club_chat_group_members m WHERE m.group_id=club_chat_messages.group_id AND m.profile_id=auth.uid()));
CREATE POLICY "Members send messages" ON club_chat_messages FOR INSERT WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM club_chat_group_members m WHERE m.group_id=club_chat_messages.group_id AND m.profile_id=auth.uid()));
\ir ../migrations/20260908019000_native_club_chat_access.sql
CREATE POLICY "Authors edit messages" ON club_chat_messages FOR UPDATE USING(auth.uid()=author_id);
CREATE ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public,auth TO service_role;
GRANT ALL ON club_chat_messages TO service_role;
\ir ../migrations/20260908021000_native_club_chat_integrity.sql
-- Test-only membership in both groups, to distinguish identity checks from RLS.
INSERT INTO club_chat_group_members(group_id,profile_id) VALUES('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;
\ir ../migrations/20260908025000_native_club_message_snapshot.sql
DO $$ BEGIN IF has_function_privilege('anon','update_native_club_message_snapshot(uuid,uuid,text,boolean,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous mutation exposed'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ DECLARE m club_chat_messages%ROWTYPE; snapshot jsonb; BEGIN
 SELECT * INTO m FROM club_chat_messages LIMIT 1;
 snapshot:=jsonb_build_object('content',m.content,'media_url',m.media_url,'edited_at',m.edited_at,'is_deleted',m.is_deleted,'is_blocked',m.is_blocked);
 PERFORM update_native_club_message_snapshot(m.id,m.group_id,repeat('é',4000),false,snapshot);
 IF NOT EXISTS(SELECT 1 FROM club_chat_messages current_message WHERE current_message.id=m.id AND content=repeat('é',4000) AND edited_at IS NOT NULL) THEN RAISE EXCEPTION 'Long message update failed'; END IF;
 BEGIN PERFORM update_native_club_message_snapshot(m.id,m.group_id,'Stale',false,snapshot); RAISE EXCEPTION 'Stale message accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT * INTO m FROM club_chat_messages current_message WHERE current_message.id=m.id;
 snapshot:=jsonb_build_object('content',m.content,'media_url',m.media_url,'edited_at',m.edited_at,'is_deleted',m.is_deleted,'is_blocked',m.is_blocked);
 BEGIN PERFORM update_native_club_message_snapshot(m.id,m.group_id,repeat('x',4001),false,snapshot); RAISE EXCEPTION 'Too long accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_club_message_snapshot(m.id,m.group_id,E' \n ',false,snapshot); RAISE EXCEPTION 'Empty accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_club_message_snapshot(m.id,m.group_id,'Changed',false,'{}'); RAISE EXCEPTION 'Incomplete snapshot'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM update_native_club_message_snapshot(m.id,'20000000-0000-0000-0000-000000000002','Changed',false,snapshot); RAISE EXCEPTION 'Wrong group'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM update_native_club_message_snapshot(m.id,m.group_id,NULL,true,snapshot);
 IF NOT EXISTS(SELECT 1 FROM club_chat_messages current_message WHERE current_message.id=m.id AND is_deleted AND content='' AND media_url IS NULL) THEN RAISE EXCEPTION 'Logical deletion failed'; END IF;
 BEGIN PERFORM update_native_club_message_snapshot(m.id,m.group_id,'Restored',false,snapshot); RAISE EXCEPTION 'Deleted message changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO club_chat_messages(group_id,author_id,content,is_blocked) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Blocked',true);
SET ROLE authenticated;
DO $$ DECLARE m club_chat_messages%ROWTYPE; BEGIN
 SELECT * INTO m FROM club_chat_messages WHERE is_blocked;
 BEGIN PERFORM update_native_club_message_snapshot(m.id,m.group_id,'Evaded',false,jsonb_build_object('content',m.content,'media_url',m.media_url,'edited_at',m.edited_at,'is_deleted',m.is_deleted,'is_blocked',m.is_blocked)); RAISE EXCEPTION 'Blocked edit'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO club_chat_messages(id,group_id,author_id,content) VALUES('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Available');
INSERT INTO club_chat_group_members(group_id,profile_id) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 BEGIN PERFORM update_native_club_message_snapshot('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Not author',false,'{"content":"Available","media_url":null,"edited_at":null,"is_deleted":false,"is_blocked":false}'); RAISE EXCEPTION 'Other author mutation'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM club_chat_group_members;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM update_native_club_message_snapshot('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','No membership',false,'{"content":"Available","media_url":null,"edited_at":null,"is_deleted":false,"is_blocked":false}'); RAISE EXCEPTION 'Unavailable mutation'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
\echo Message body snapshots: long edits, logical deletion, conflicts, validation, moderation and group scope passed.
