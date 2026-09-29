CREATE TABLE public.story_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
 viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(story_id,viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_views FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.story_views TO authenticated;
GRANT INSERT(story_id,viewer_id) ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
CREATE POLICY story_view_participants ON public.story_views FOR SELECT TO authenticated USING(
 viewer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.stories s WHERE s.id=story_id AND s.user_id=auth.uid())
);
CREATE POLICY story_view_creation ON public.story_views FOR INSERT TO authenticated WITH CHECK(
 viewer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.stories s WHERE s.id=story_id
   AND s.user_id<>auth.uid() AND s.expires_at>now()
   AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE
     (b.blocker_id=auth.uid() AND b.blocked_id=s.user_id) OR
     (b.blocker_id=s.user_id AND b.blocked_id=auth.uid())))
);
CREATE INDEX story_views_created_id ON public.story_views(created_at DESC,id);
