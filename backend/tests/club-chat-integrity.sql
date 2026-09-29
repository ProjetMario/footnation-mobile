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
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
UPDATE club_chat_messages SET content='Edited', edited_at=now();
DO $$ BEGIN
 IF (SELECT content FROM club_chat_messages LIMIT 1)<>'Edited' THEN RAISE EXCEPTION 'Normal edit failed'; END IF;
 BEGIN UPDATE club_chat_messages SET id=gen_random_uuid(); RAISE EXCEPTION 'Identity forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET author_id='00000000-0000-0000-0000-000000000003'; RAISE EXCEPTION 'Author forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET is_blocked=true; RAISE EXCEPTION 'Moderation forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET blocked_reason='Forged'; RAISE EXCEPTION 'Reason forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET blocked_by=auth.uid(); RAISE EXCEPTION 'Moderator forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET blocked_at=now(); RAISE EXCEPTION 'Moderation date forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET created_at=now()+interval '1 day'; RAISE EXCEPTION 'Creation time forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET group_id='20000000-0000-0000-0000-000000000002'; RAISE EXCEPTION 'Group relocation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_chat_messages(group_id,author_id,content,is_blocked) VALUES('20000000-0000-0000-0000-000000000001',auth.uid(),'Forbidden',true); RAISE EXCEPTION 'Insert moderation forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_chat_messages(group_id,author_id,content,reply_to_id) SELECT '20000000-0000-0000-0000-000000000002',auth.uid(),'Wrong reply',id FROM club_chat_messages LIMIT 1; RAISE EXCEPTION 'Cross-group reply'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO club_chat_messages(group_id,author_id,content,reply_to_id) SELECT group_id,auth.uid(),'Reply',id FROM club_chat_messages LIMIT 1;
SET ROLE service_role;
UPDATE club_chat_messages SET is_blocked=true,blocked_reason='Fixture moderation' WHERE content='Edited';
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN UPDATE club_chat_messages SET content='Evade moderation' WHERE is_blocked; RAISE EXCEPTION 'Blocked content edit'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE club_chat_messages SET is_blocked=false WHERE is_blocked; RAISE EXCEPTION 'Unblock forge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE club_chat_messages SET is_deleted=true,content='',media_url=null WHERE content='Reply';
DO $$ BEGIN
 BEGIN UPDATE club_chat_messages SET is_deleted=false,content='Restored' WHERE is_deleted; RAISE EXCEPTION 'Restore deleted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM club_chat_group_members;
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM club_chat_messages) THEN RAISE EXCEPTION 'Revoked membership read'; END IF;
 BEGIN INSERT INTO club_chat_messages(group_id,author_id,content) VALUES('20000000-0000-0000-0000-000000000001',auth.uid(),'Former member'); RAISE EXCEPTION 'Former member insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
\echo Club message integrity: author edit, logical deletion, reserved fields, moderation, replies, trusted service and revocation passed.
