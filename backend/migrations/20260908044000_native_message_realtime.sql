-- Keep existing RLS and replica identity; enable message changes in the managed publication.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime' AND NOT puballtables AND pubinsert AND pubupdate) THEN
  RAISE EXCEPTION 'Expected Supabase Realtime publication missing';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.messages'::regclass) THEN
  RAISE EXCEPTION 'Message RLS is required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.messages'::regclass AND contype='p') THEN
  RAISE EXCEPTION 'Message primary key is required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
 END IF;
END $$;
