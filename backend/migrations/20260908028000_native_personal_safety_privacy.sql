-- Keep direct mutual-block checks working without exposing everyone's block list.
CREATE POLICY "Native block participants only" ON public.user_blocks AS RESTRICTIVE
FOR SELECT TO anon,authenticated USING (
 auth.uid() IS NOT NULL AND (blocker_id=auth.uid() OR blocked_id=auth.uid() OR coalesce(public.is_site_admin(),false))
);
CREATE POLICY "Native report privacy" ON public.user_reports AS RESTRICTIVE
FOR SELECT TO anon,authenticated USING (
 auth.uid() IS NOT NULL AND (reporter_id=auth.uid() OR coalesce(public.is_site_admin(),false))
);
-- The native administration already exposes report deletion; make it authorized.
CREATE POLICY "Native administrators delete reports" ON public.user_reports
FOR DELETE TO authenticated USING (coalesce(public.is_site_admin(),false));
