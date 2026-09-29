-- Public Page Pro images, with object writes confined to the signed-in owner's prefix.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('pro-pages','pro-pages',true,10485760,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']);
CREATE POLICY native_pro_media_read ON storage.objects FOR SELECT USING(bucket_id='pro-pages');
CREATE POLICY native_pro_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='pro-pages' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY native_pro_media_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='pro-pages' AND split_part(name,'/',1)=auth.uid()::text) WITH CHECK(bucket_id='pro-pages' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY native_pro_media_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='pro-pages' AND split_part(name,'/',1)=auth.uid()::text);
-- Existing permissive policies for other buckets must not broaden these write permissions.
CREATE POLICY native_pro_media_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT WITH CHECK(bucket_id<>'pro-pages' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text));
CREATE POLICY native_pro_media_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE USING(bucket_id<>'pro-pages' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text)) WITH CHECK(bucket_id<>'pro-pages' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text));
CREATE POLICY native_pro_media_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE USING(bucket_id<>'pro-pages' OR (auth.uid() IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text));
