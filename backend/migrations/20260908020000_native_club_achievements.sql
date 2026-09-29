CREATE TABLE public.club_achievements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES public.fff_clubs(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(btrim(title))>0),
 competition text NOT NULL CHECK(length(btrim(competition))>0),
 year integer NOT NULL CHECK(year BETWEEN 0 AND 9999),
 category text,
 description text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX club_achievements_club_year ON public.club_achievements(club_id,year DESC,id);
ALTER TABLE public.club_achievements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_achievements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.club_achievements TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.club_achievements TO authenticated;
CREATE POLICY club_achievements_public_read ON public.club_achievements FOR SELECT USING(true);
CREATE POLICY club_achievements_admin_insert ON public.club_achievements FOR INSERT TO authenticated WITH CHECK(public.is_club_admin(club_id));
CREATE POLICY club_achievements_admin_update ON public.club_achievements FOR UPDATE TO authenticated USING(public.is_club_admin(club_id)) WITH CHECK(public.is_club_admin(club_id));
CREATE POLICY club_achievements_admin_delete ON public.club_achievements FOR DELETE TO authenticated USING(public.is_club_admin(club_id));
