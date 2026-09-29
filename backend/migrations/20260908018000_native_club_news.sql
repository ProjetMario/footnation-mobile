-- Preserve existing articles; missing editorial fields remain NULL until edited.
ALTER TABLE public.club_news ADD COLUMN title text, ADD COLUMN excerpt text, ADD COLUMN published_at timestamptz;
CREATE POLICY native_club_news_admin_read ON public.club_news FOR SELECT TO authenticated USING (public.is_club_admin(club_id));
CREATE POLICY native_club_news_admin_insert ON public.club_news FOR INSERT TO authenticated WITH CHECK (public.is_club_admin(club_id));
CREATE POLICY native_club_news_admin_update ON public.club_news FOR UPDATE TO authenticated USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));
CREATE POLICY native_club_news_admin_delete ON public.club_news FOR DELETE TO authenticated USING (public.is_club_admin(club_id));
