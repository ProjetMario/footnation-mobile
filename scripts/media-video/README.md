# Mobile video derivatives

`worker.py` produces optional H.264/AAC MP4s (short side <=720, long side <=1280, no upscale, faststart) and JPEG posters for `posts` and `shorts`. It never replaces the original. A derivative is published only when validated and smaller than the original. Small originals remain in use. The authenticated app cannot forge derivative fields.

The migration queues existing videos newest first and future inserts/source changes automatically. Only service-role RPCs can claim/finish jobs. Claims use skip-locked leases, five bounded retries, source equality and a lease-token check; interrupted jobs recover after 15 minutes. Changed/deleted source rows cannot receive a stale result. Queue access and writes are denied to public clients. Existing RLS on posts/shorts stays in charge of visibility.

The worker accepts only HTTPS public Storage URLs on the configured Supabase host in the existing `shorts` and `post-media` buckets. Downloads are capped at 250 MiB / 120 seconds; media at ten minutes; transcode at five minutes. Redirects are rejected, remote FFmpeg input protocols disabled, secrets and URLs excluded from logs. Originals must keep the existing unique-upload-path convention (do not overwrite an original object at the same URL).

Run after applying both reviewed optimization and derivative-cleanup migrations to the correct project:

```sh
python3 scripts/media-video/worker.py --env-file .env --max-jobs 8
```

Only `SUPABASE_URL` and **server-only** `SUPABASE_SERVICE_ROLE_KEY` are read from this file. Never put that key in Expo/Vite or commit it. Uploads go to immutable source/content/lease-addressed `optimized/mobile-720-v1/...` paths in the same source bucket, with long cache lifetime. Completion verifies that public byte-range playback returns HTTP 206. Existing author thumbnails take precedence; the worker's generated poster fills a missing one only.

Frontend contract on each source row: `optimized_video_url`, `optimized_video_source_url`, `optimized_thumbnail_url` are nullable. Select the optimized URL or poster only if `optimized_video_source_url === video_url`; otherwise retain `video_url` and the existing poster. Deploying this migration before the clients is safe. A failed/unavailable worker never blocks playback of an original.

The checked-in GitHub workflow is a free-hosted-runner option for a **public repository**. It runs every ten minutes and on manual dispatch, no pull-request trigger, with a ten-minute timeout and at most eight jobs per run. It is restricted to `ProjetMario/footnation-mobile` on `main`. Configure repository secrets `MEDIA_VIDEO_SUPABASE_URL` and `MEDIA_VIDEO_SERVICE_ROLE_KEY` only after reviewing that target. GitHub may start scheduled jobs a few minutes late, and a busy queue can still span several runs. No active permanent worker is assumed merely because this file exists. The queue's `state`, `attempts`, `error_code`, `updated_at` and `result` provide operator monitoring; `result` includes byte counts and local conversion/download times, not a claim about client time-to-first-frame.

Verification:

```sh
python3 -m unittest discover -s scripts/media-video/tests -v
python3 scripts/media-video/worker.py --local-input /tmp/sample.mp4 --local-output /tmp/mobile-result
```

`tests/backend.sql` requires a fresh disposable PostgreSQL cluster/database whose name starts with `video_test_`; it creates synthetic source tables and roles. Run with `psql -X -v ON_ERROR_STOP=1 -f scripts/media-video/tests/backend.sql`. Never run it on Supabase/production.

Service operations can inspect failed/skipped jobs and reset them after correcting a source or operational issue. Do not indiscriminately retry unsupported/external sources. The worker also consumes the service-only cleanup queue (at most six exact objects before and after a batch); originals and paths outside its reserved namespace are rejected. Source replacement and deletion queue unused generated objects, and late worker completion requests cleanup through a guarded RPC. A source that returns from A to B to A receives a different lease-derived output path, so cleanup of the first A cannot delete a newly published A. A worker never directly deletes an output merely because completion was rejected. A hard process crash between Storage upload and completion can still leave an unreferenced object; namespace cleanup on eventual record/account deletion covers existing objects, while an independent periodic orphan sweep is not provided. Original URLs are never rewritten.
