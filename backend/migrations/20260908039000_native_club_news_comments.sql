-- Retain existing ownership policies; published parent is required as well.
CREATE POLICY native_news_comments_public_parent ON public.club_news_comments AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.club_news n WHERE n.id=news_id AND n.is_published=true));
CREATE POLICY native_news_comments_insert_parent ON public.club_news_comments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.club_news n WHERE n.id=news_id AND n.is_published=true));
CREATE POLICY native_news_likes_public_parent ON public.club_news_likes AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.club_news n WHERE n.id=news_id AND n.is_published=true));
CREATE POLICY native_news_likes_insert_parent ON public.club_news_likes AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.club_news n WHERE n.id=news_id AND n.is_published=true));
CREATE FUNCTION public.create_native_club_news_comment(p_id uuid,p_news_id uuid,p_club_id uuid,p_content text) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE existing public.club_news_comments;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_content IS NULL OR length(btrim(p_content))=0 OR length(p_content)>10000 THEN RAISE EXCEPTION 'Comment must contain between 1 and 10000 characters' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_news WHERE id=p_news_id AND club_id=p_club_id AND is_published=true) THEN RAISE EXCEPTION 'Published club news required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.club_news_comments(id,news_id,author_id,content) VALUES(p_id,p_news_id,auth.uid(),p_content) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO existing FROM public.club_news_comments WHERE id=p_id;
 IF existing.id IS NULL OR (existing.news_id,existing.author_id,existing.content) IS DISTINCT FROM (p_news_id,auth.uid(),p_content) THEN RAISE EXCEPTION 'Comment identity conflict' USING ERRCODE='23505'; END IF;
 RETURN existing.id;
END $$;
REVOKE ALL ON FUNCTION public.create_native_club_news_comment(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_native_club_news_comment(uuid,uuid,uuid,text) TO authenticated;
