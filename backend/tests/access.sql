\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() NOT LIKE 'footnation_test_%' THEN RAISE EXCEPTION 'Disposable test database required'; END IF; END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
CREATE TABLE public.groups(id uuid PRIMARY KEY, name text, privacy text, created_by uuid, member_count integer DEFAULT 0);
CREATE TABLE public.group_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES public.groups, user_id uuid, role text, UNIQUE(group_id,user_id));
CREATE TABLE public.pro_pages(id uuid PRIMARY KEY, owner_id uuid, published boolean);
CREATE TABLE public.pro_page_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), page_id uuid REFERENCES public.pro_pages, member_id uuid);
CREATE TABLE public.pro_page_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), page_id uuid REFERENCES public.pro_pages, content text);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_page_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_page_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon,authenticated;
\ir previous-policies.sql
CREATE POLICY content_read ON public.pro_page_posts FOR SELECT USING(EXISTS(SELECT 1 FROM public.pro_pages p WHERE p.id=page_id));
INSERT INTO public.groups VALUES
 ('10000000-0000-0000-0000-000000000001','Public','public','00000000-0000-0000-0000-000000000001',0),
 ('10000000-0000-0000-0000-000000000002','Private','private','00000000-0000-0000-0000-000000000001',0);
INSERT INTO public.group_memberships(group_id,user_id,role) VALUES ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','member');
INSERT INTO public.pro_pages VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',true),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',false);
INSERT INTO public.pro_page_members(page_id,member_id) VALUES ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
INSERT INTO public.pro_page_posts(page_id,content) VALUES ('20000000-0000-0000-0000-000000000002','Private post');
SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM public.groups; RAISE EXCEPTION 'Expected recursion before fix'; EXCEPTION WHEN invalid_object_definition THEN NULL; END;
 BEGIN PERFORM * FROM public.pro_pages; RAISE EXCEPTION 'Expected recursion before fix'; EXCEPTION WHEN invalid_object_definition THEN NULL; END;
END $$;
RESET ROLE;
\ir ../migrations/20260908010000_native_access_recursion.sql
SET ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.groups) <> 1 THEN RAISE EXCEPTION 'Anonymous group visibility'; END IF;
 IF (SELECT count(*) FROM public.pro_pages) <> 1 THEN RAISE EXCEPTION 'Anonymous page visibility'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_page_posts) THEN RAISE EXCEPTION 'Anonymous private content leaked'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.groups) <> 2 THEN RAISE EXCEPTION 'Member cannot read private group'; END IF;
 IF (SELECT count(*) FROM public.pro_pages) <> 2 THEN RAISE EXCEPTION 'Member cannot read private page'; END IF;
 IF (SELECT count(*) FROM public.pro_page_posts) <> 1 THEN RAISE EXCEPTION 'Private page content inaccessible to member'; END IF;
 UPDATE public.group_memberships SET role='admin' WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.group_memberships WHERE role='admin') THEN RAISE EXCEPTION 'Member escalated role'; END IF;
 UPDATE public.pro_pages SET published=true WHERE id='20000000-0000-0000-0000-000000000002';
 IF NOT EXISTS(SELECT 1 FROM public.pro_pages WHERE published=false) THEN RAISE EXCEPTION 'Member changed owner page'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.groups) <> 1 THEN RAISE EXCEPTION 'Stranger sees private group'; END IF;
 IF (SELECT count(*) FROM public.pro_pages) <> 1 THEN RAISE EXCEPTION 'Stranger sees private page'; END IF;
 BEGIN
  INSERT INTO public.group_memberships(group_id,user_id,role) VALUES ('10000000-0000-0000-0000-000000000001',auth.uid(),'admin');
  RAISE EXCEPTION 'Self promotion allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.group_memberships(group_id,user_id,role) VALUES ('10000000-0000-0000-0000-000000000002',auth.uid(),'member');
  RAISE EXCEPTION 'Private self join allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.group_memberships(group_id,user_id,role) VALUES ('10000000-0000-0000-0000-000000000001',auth.uid(),'member');
 DELETE FROM public.group_memberships WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.group_memberships WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Member cannot leave'; END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 INSERT INTO public.groups(id,name,privacy,created_by) VALUES ('10000000-0000-0000-0000-000000000003','New private','private',auth.uid());
 INSERT INTO public.group_memberships(group_id,user_id,role) VALUES ('10000000-0000-0000-0000-000000000003',auth.uid(),'admin');
 IF NOT EXISTS(SELECT 1 FROM public.group_memberships WHERE group_id='10000000-0000-0000-0000-000000000003' AND role='admin') THEN RAISE EXCEPTION 'Creator bootstrap failed'; END IF;
 UPDATE public.groups SET name='Edited' WHERE id='10000000-0000-0000-0000-000000000002';
 IF NOT EXISTS(SELECT 1 FROM public.groups WHERE name='Edited') THEN RAISE EXCEPTION 'Owner cannot edit'; END IF;
 IF (SELECT count(*) FROM public.pro_page_members) <> 1 THEN RAISE EXCEPTION 'Owner cannot manage page members'; END IF;
 INSERT INTO public.pro_page_members(page_id,member_id) VALUES ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
END $$;
RESET ROLE;
SELECT 'Access regression assertions passed' AS result;
