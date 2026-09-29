\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_fff_club_admin(cid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND cid='10000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE club_chat_groups(id uuid PRIMARY KEY,club_id uuid,name text);
CREATE TABLE club_chat_group_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES club_chat_groups(id),profile_id uuid);
CREATE TABLE club_chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES club_chat_groups(id),author_id uuid,content text);
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
SET ROLE anon;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM club_chat_groups) OR EXISTS(SELECT 1 FROM club_chat_group_members) OR EXISTS(SELECT 1 FROM club_chat_messages) THEN RAISE EXCEPTION 'Anonymous access'; END IF; END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM club_chat_groups)<>1 OR (SELECT count(*) FROM club_chat_messages)<>1 THEN RAISE EXCEPTION 'Member cannot read own group'; END IF;
 UPDATE club_chat_groups SET name='Forged'; IF FOUND THEN RAISE EXCEPTION 'Member group edit'; END IF;
 BEGIN INSERT INTO club_chat_group_members(group_id,profile_id) VALUES('20000000-0000-0000-0000-000000000002',auth.uid()); RAISE EXCEPTION 'Self-enrollment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_chat_messages(group_id,author_id,content) VALUES('20000000-0000-0000-0000-000000000002',auth.uid(),'Denied'); RAISE EXCEPTION 'Other group message'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO club_chat_messages(group_id,author_id,content) VALUES('20000000-0000-0000-0000-000000000001',auth.uid(),'Allowed fixture');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM club_chat_groups) OR EXISTS(SELECT 1 FROM club_chat_messages) THEN RAISE EXCEPTION 'Third-party access'; END IF; END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM club_chat_groups)<>1 OR (SELECT count(*) FROM club_chat_group_members)<>1 THEN RAISE EXCEPTION 'Admin scope'; END IF;
 IF EXISTS(SELECT 1 FROM club_chat_messages) THEN RAISE EXCEPTION 'Non-member admin message access expanded'; END IF;
 INSERT INTO club_chat_group_members(group_id,profile_id) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
 BEGIN UPDATE club_chat_group_members SET group_id='20000000-0000-0000-0000-000000000002'; RAISE EXCEPTION 'Move to other club'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM club_chat_group_members WHERE profile_id='00000000-0000-0000-0000-000000000002';
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM club_chat_groups) OR EXISTS(SELECT 1 FROM club_chat_messages) THEN RAISE EXCEPTION 'Removed member access'; END IF; END $$;
\echo Club chat: recursion removed, member/admin boundaries, messages and revocation passed.
