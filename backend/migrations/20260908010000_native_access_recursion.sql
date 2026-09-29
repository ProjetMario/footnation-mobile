-- FootNation: repair recursive access checks without disabling RLS.
-- Verified against the remote policies on 2026-09-08. No application rows are changed.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE OR REPLACE FUNCTION public.fn_native_group_visible(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_id AND
    (g.privacy = 'public' OR g.created_by = auth.uid() OR EXISTS
      (SELECT 1 FROM public.group_memberships m WHERE m.group_id = g.id AND m.user_id = auth.uid())));
$$;
CREATE OR REPLACE FUNCTION public.fn_native_group_role(p_id uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_id AND
    (g.created_by = auth.uid() OR EXISTS
      (SELECT 1 FROM public.group_memberships m WHERE m.group_id = g.id AND m.user_id = auth.uid() AND m.role = ANY(p_roles))));
$$;
CREATE OR REPLACE FUNCTION public.fn_native_group_public(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = p_id AND privacy = 'public');
$$;
CREATE OR REPLACE FUNCTION public.fn_native_pro_owner(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pro_pages WHERE id = p_id AND owner_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.fn_native_pro_member(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pro_page_members WHERE page_id = p_id AND member_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.fn_native_group_visible(uuid), public.fn_native_group_role(uuid,text[]), public.fn_native_group_public(uuid), public.fn_native_pro_owner(uuid), public.fn_native_pro_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_native_group_visible(uuid), public.fn_native_group_role(uuid,text[]), public.fn_native_group_public(uuid), public.fn_native_pro_owner(uuid), public.fn_native_pro_member(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Groups are viewable by everyone if public" ON public.groups;
DROP POLICY IF EXISTS "Groups are viewable by members if private" ON public.groups;
CREATE POLICY "Groups are viewable by everyone if public" ON public.groups FOR SELECT USING (public.fn_native_group_visible(id));
DROP POLICY IF EXISTS "Admins can update their groups" ON public.groups;
CREATE POLICY "Admins can update their groups" ON public.groups FOR UPDATE TO authenticated
  USING (public.fn_native_group_role(id, ARRAY['admin','moderator']))
  WITH CHECK (public.fn_native_group_role(id, ARRAY['admin','moderator']));
DROP POLICY IF EXISTS "Admins can delete their groups" ON public.groups;
CREATE POLICY "Admins can delete their groups" ON public.groups FOR DELETE TO authenticated
  USING (public.fn_native_group_role(id, ARRAY['admin']));
DROP POLICY IF EXISTS "Memberships viewable by group members" ON public.group_memberships;
CREATE POLICY "Memberships viewable by group members" ON public.group_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.fn_native_group_visible(group_id));
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.group_memberships;
CREATE POLICY "Admins can manage memberships" ON public.group_memberships FOR ALL TO authenticated
  USING (public.fn_native_group_role(group_id, ARRAY['admin']))
  WITH CHECK (public.fn_native_group_role(group_id, ARRAY['admin']));
DROP POLICY IF EXISTS "Users can join public groups" ON public.group_memberships;
CREATE POLICY "Users can join public groups" ON public.group_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND
    ((role = 'member' AND public.fn_native_group_public(group_id)) OR public.fn_native_group_role(group_id, ARRAY[]::text[])));
-- Existing create-group and leave-group policies remain unchanged.

DROP POLICY IF EXISTS pro_pages_public_read ON public.pro_pages;
CREATE POLICY pro_pages_public_read ON public.pro_pages FOR SELECT
  USING (published = true OR owner_id = auth.uid() OR public.fn_native_pro_member(id));
DROP POLICY IF EXISTS pro_page_members_owner_manage ON public.pro_page_members;
CREATE POLICY pro_page_members_owner_manage ON public.pro_page_members FOR ALL TO authenticated
  USING (public.fn_native_pro_owner(page_id)) WITH CHECK (public.fn_native_pro_owner(page_id));
-- Existing owner-only page mutations remain unchanged.
NOTIFY pgrst, 'reload schema';
