\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_fff_club_admin(cid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid AND cid='10000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE club_chat_groups(id uuid PRIMARY KEY,club_id uuid,name text);
CREATE TABLE club_chat_group_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES club_chat_groups(id),profile_id uuid);
CREATE TABLE club_chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES club_chat_groups(id),author_id uuid,content text,media_url text,is_deleted boolean DEFAULT false,is_blocked boolean DEFAULT false,created_at timestamptz DEFAULT now());
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
CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,is_admin boolean DEFAULT false);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','Admin',true),('00000000-0000-0000-0000-000000000002','Author',false),('00000000-0000-0000-0000-000000000003','Reporter',false);
CREATE FUNCTION is_site_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT is_admin FROM public.profiles WHERE id=auth.uid()),false) $$;
CREATE TABLE club_chat_message_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),message_id uuid REFERENCES club_chat_messages(id),reporter_id uuid,reason text,details text,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','resolved','dismissed')),admin_notes text,created_at timestamptz DEFAULT now(),reviewed_at timestamptz,reviewed_by uuid);
ALTER TABLE club_chat_message_reports ENABLE ROW LEVEL SECURITY;
GRANT ALL ON club_chat_message_reports TO authenticated;
CREATE POLICY own_insert ON club_chat_message_reports FOR INSERT WITH CHECK(reporter_id=auth.uid());
CREATE POLICY own_or_admin_read ON club_chat_message_reports FOR SELECT USING(reporter_id=auth.uid() OR is_site_admin());
CREATE POLICY admin_update ON club_chat_message_reports FOR UPDATE USING(is_site_admin());
INSERT INTO club_chat_group_members(group_id,profile_id) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
\ir ../migrations/20260908022000_native_club_report_review.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
INSERT INTO club_chat_message_reports(message_id,reporter_id,reason) SELECT id,auth.uid(),'spam' FROM club_chat_messages;
DO $$ BEGIN
 IF (SELECT count(*) FROM club_chat_message_reports)<>1 THEN RAISE EXCEPTION 'Report missing'; END IF;
 BEGIN INSERT INTO club_chat_message_reports(message_id,reporter_id,reason,status) SELECT id,auth.uid(),'spam','resolved' FROM club_chat_messages; RAISE EXCEPTION 'Forged status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO club_chat_message_reports(message_id,reporter_id,reason,reviewed_by) SELECT id,auth.uid(),'spam',auth.uid() FROM club_chat_messages; RAISE EXCEPTION 'Forged reviewer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM get_native_club_report_message(id) FROM club_chat_message_reports; RAISE EXCEPTION 'Reporter RPC access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE club_chat_message_reports SET status='resolved'; IF FOUND THEN RAISE EXCEPTION 'Reporter review'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM club_chat_message_reports) THEN RAISE EXCEPTION 'Author sees reporter'; END IF;
 BEGIN INSERT INTO club_chat_message_reports(message_id,reporter_id,reason) SELECT id,auth.uid(),'spam' FROM club_chat_messages; RAISE EXCEPTION 'Self report'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM club_chat_messages) THEN RAISE EXCEPTION 'Admin conversation access expanded'; END IF;
 IF (SELECT get_native_club_report_message(id)->>'content' FROM club_chat_message_reports)<>'Fixture' THEN RAISE EXCEPTION 'Reported message unavailable to reviewer'; END IF;
 BEGIN UPDATE club_chat_message_reports SET reason='Forged'; RAISE EXCEPTION 'Evidence changed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE club_chat_message_reports SET status='reviewed',admin_notes='Examined',reviewed_by='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM club_chat_message_reports WHERE reviewed_by=auth.uid() AND reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'Reviewer not assigned by server'; END IF;
 UPDATE club_chat_message_reports SET status='dismissed' WHERE status='pending'; IF FOUND THEN RAISE EXCEPTION 'Stale update accepted'; END IF;
END $$;
RESET ROLE;
DELETE FROM club_chat_group_members WHERE profile_id='00000000-0000-0000-0000-000000000003';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM club_chat_message_reports WHERE reporter_id=auth.uid() AND status='reviewed' AND admin_notes='Examined') THEN RAISE EXCEPTION 'Own report follow-up unavailable after leaving'; END IF;
 BEGIN INSERT INTO club_chat_message_reports(message_id,reporter_id,reason) VALUES((SELECT message_id FROM club_chat_message_reports LIMIT 1),auth.uid(),'spam'); RAISE EXCEPTION 'Former member report'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
\echo Club reports: submission, reviewer authority, immutable evidence, protected fields, reported-message scope and revocation passed.
