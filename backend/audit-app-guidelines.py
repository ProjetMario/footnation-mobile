"""Read-only metadata audit of the linked FOOTNATION project. No personal rows or secrets are emitted."""
from pathlib import Path
import json, os, re, shlex, subprocess, urllib.request

source = Path(__file__).resolve().parents[2]
project = "zkvwqywtlkkkxmapehwe"
if (source / "supabase/.temp/project-ref").read_text().strip() != project:
    raise SystemExit("The linked project is not FOOTNATION.")
prepared = subprocess.run(
    ["supabase", "db", "dump", "--linked", "--schema", "public", "--dry-run"],
    cwd=source, capture_output=True, text=True, timeout=45,
)
if prepared.returncode:
    raise SystemExit("Connection preparation failed; no database command was run.")
env = os.environ.copy()
keys = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]
for token in shlex.split(prepared.stdout):
    if "=" in token and token.split("=", 1)[0] in keys:
        key, value = token.split("=", 1)
        env[key] = value
if not all(env.get(key) for key in keys):
    raise SystemExit("Connection metadata incomplete; no database command was run.")
env["PGCONNECT_TIMEOUT"] = "15"
env["PGOPTIONS"] = "-c default_transaction_read_only=on -c statement_timeout=15000"
query = """
BEGIN READ ONLY;
SET LOCAL ROLE postgres;
SELECT json_build_object(
 'functions', (SELECT json_agg(json_build_object('name',f,'present',to_regprocedure(f) IS NOT NULL))
  FROM unnest(ARRAY['public.account_deletion_check(uuid)',
   'public.account_deletion_shared_spaces_check(uuid)', 'public.get_member_access_status()',
   'public.get_social_signup_status()', 'public.can_review_content()',
   'public.is_site_admin()', 'public.prune_native_growth_activity()',
   'public.review_content_report(uuid,text,text,integer)',
   'public.community_text_rejected(text)', 'public.guard_community_text()',
   'public.apple_deletion_receipt(uuid)']) f),
 'ownership_fks', (SELECT json_agg(json_build_object('table',c.conrelid::regclass::text,'column',a.attname,'nullable',NOT a.attnotnull,'delete_action',c.confdeltype))
   FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
   WHERE c.contype='f' AND ((c.conrelid='public.groups'::regclass AND a.attname='created_by')
    OR (c.conrelid='public.pro_pages'::regclass AND a.attname='owner_id'))),
 'rls', (SELECT json_agg(json_build_object('table',relname,'enabled',relrowsecurity)) FROM pg_class
   WHERE oid IN ('public.posts'::regclass,'public.shorts'::regclass,'public.stories'::regclass,'public.user_reports'::regclass)),
 'report_columns', (SELECT json_agg(column_name) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='user_reports'),
 'report_constraints', (SELECT json_agg(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='public.user_reports'::regclass AND contype='c'),
 'deletion_shared_guard_present', (SELECT position('Shared ownership' IN pg_get_functiondef(oid))>0 FROM pg_proc WHERE oid='public.account_deletion_check(uuid)'::regprocedure),
 'migrations', (SELECT json_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations
   WHERE version IN ('20260924100000','20260924110000','20260924120000','20260924130000','20260924131000'))
);
ROLLBACK;
"""
result = subprocess.run(
    ["/usr/local/opt/postgresql@16/bin/psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", query],
    env=env, capture_output=True, text=True, timeout=45,
)
if result.returncode:
    diagnostic = re.search(r"ERROR:[^\n]+", result.stderr)
    print(json.dumps({"project": project, "database_metadata": "unavailable", "schema_error": diagnostic.group(0)[:200] if diagnostic else "Connection unavailable"}))
else:
    print(json.dumps({"project": project, "database_metadata": json.loads(result.stdout.strip())}, ensure_ascii=False))

# Public provider availability only. Never emit the publishable key or full settings payload.
client = (source / "src/integrations/supabase/client.ts").read_text()
key = re.search(r'SUPABASE_PUBLISHABLE_KEY\s*=\s*"([^"]+)"', client).group(1)
try:
    request = urllib.request.Request(f"https://{project}.supabase.co/auth/v1/settings", headers={"apikey": key})
    with urllib.request.urlopen(request, timeout=15) as response:
        data = json.load(response)
    print(json.dumps({"auth_providers": {name: data.get("external", {}).get(name) for name in ["apple", "google", "email"]}}))
except Exception:
    print(json.dumps({"auth_providers": "unavailable"}))
