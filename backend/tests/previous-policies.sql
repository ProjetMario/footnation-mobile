CREATE POLICY "Admins can delete their groups" ON public.groups FOR DELETE USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.group_memberships
  WHERE ((group_memberships.group_id = groups.id) AND (group_memberships.user_id = auth.uid()) AND (group_memberships.role = 'admin'::text))))));
CREATE POLICY "Admins can manage memberships" ON public.group_memberships USING ((EXISTS ( SELECT 1
   FROM public.group_memberships gm
  WHERE ((gm.group_id = group_memberships.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = 'admin'::text)))));
CREATE POLICY "Admins can update their groups" ON public.groups FOR UPDATE USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.group_memberships
  WHERE ((group_memberships.group_id = groups.id) AND (group_memberships.user_id = auth.uid()) AND (group_memberships.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))));
CREATE POLICY "Groups are viewable by everyone if public" ON public.groups FOR SELECT USING (((privacy = 'public'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.group_memberships
  WHERE ((group_memberships.group_id = groups.id) AND (group_memberships.user_id = auth.uid()))))));
CREATE POLICY "Memberships viewable by group members" ON public.group_memberships FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.groups
  WHERE ((groups.id = group_memberships.group_id) AND ((groups.privacy = 'public'::text) OR (groups.created_by = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.group_memberships gm
  WHERE ((gm.group_id = group_memberships.group_id) AND (gm.user_id = auth.uid()))))));
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK ((created_by = auth.uid()));
CREATE POLICY "Users can join public groups" ON public.group_memberships FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can leave groups" ON public.group_memberships FOR DELETE USING ((user_id = auth.uid()));
CREATE POLICY pro_page_members_owner_manage ON public.pro_page_members USING ((EXISTS ( SELECT 1
   FROM public.pro_pages p
  WHERE ((p.id = pro_page_members.page_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.pro_pages p
  WHERE ((p.id = pro_page_members.page_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY pro_pages_owner_manage ON public.pro_pages USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY pro_pages_public_read ON public.pro_pages FOR SELECT USING (((published = true) OR (owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.pro_page_members m
  WHERE ((m.page_id = m.id) AND (m.member_id = auth.uid()))))));