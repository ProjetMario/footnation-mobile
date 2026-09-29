CREATE FUNCTION public.fn_native_club_chat_admin(p_group_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.club_chat_groups g WHERE g.id=p_group_id AND public.is_fff_club_admin(g.club_id))
$$;
CREATE FUNCTION public.fn_native_club_chat_member(p_group_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.club_chat_group_members m WHERE m.group_id=p_group_id AND m.profile_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION public.fn_native_club_chat_admin(uuid),public.fn_native_club_chat_member(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_native_club_chat_admin(uuid),public.fn_native_club_chat_member(uuid) TO anon,authenticated;
DROP POLICY "Group members read groups" ON public.club_chat_groups;
CREATE POLICY "Group members read groups" ON public.club_chat_groups FOR SELECT USING(public.is_fff_club_admin(club_id) OR public.fn_native_club_chat_member(id));
DROP POLICY "Admins manage membership" ON public.club_chat_group_members;
CREATE POLICY "Admins manage membership" ON public.club_chat_group_members USING(public.fn_native_club_chat_admin(group_id)) WITH CHECK(public.fn_native_club_chat_admin(group_id));
DROP POLICY "Members read membership" ON public.club_chat_group_members;
CREATE POLICY "Members read membership" ON public.club_chat_group_members FOR SELECT USING(profile_id=auth.uid() OR public.fn_native_club_chat_admin(group_id));
