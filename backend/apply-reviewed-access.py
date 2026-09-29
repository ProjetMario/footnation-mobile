"""Apply only the tested access-policy migration to the explicitly linked FootNation project.
No credentials are printed or written to disk. All SQL and the migration journal commit together.
"""
from pathlib import Path
import argparse, os, shlex, subprocess
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent
source = Path('/Users/zazouino/Downloads/footzone-main')
if (source/'supabase/.temp/project-ref').read_text().strip() != 'zkvwqywtlkkkxmapehwe':
    raise SystemExit('The linked project is not FootNation.')
prepared = subprocess.run(['supabase', 'db', 'dump', '--linked', '--schema', 'public', '--dry-run'], cwd=source, capture_output=True, text=True, check=True)
env = os.environ.copy()
keys = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']
for token in shlex.split(prepared.stdout):
    if '=' in token and token.split('=', 1)[0] in keys:
        key, value = token.split('=', 1)
        env[key] = value
if not all(env.get(key) for key in keys):
    raise SystemExit('Connection preparation did not provide every required parameter.')
sql = (root/'migrations/20260908010000_native_access_recursion.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908010000') THEN
  RAISE EXCEPTION 'This migration has already been applied';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='groups' AND policyname='Groups are viewable by everyone if public')
 OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pro_pages' AND policyname='pro_pages_public_read') THEN
  RAISE EXCEPTION 'The target policies differ from the reviewed schema';
 END IF;
END $$;
""" + sql + """
SET LOCAL ROLE anon;
DO $$ BEGIN
 PERFORM 1 FROM public.groups LIMIT 1;
 PERFORM 1 FROM public.group_memberships LIMIT 1;
 PERFORM 1 FROM public.pro_pages LIMIT 1;
 PERFORM 1 FROM public.pro_page_posts LIMIT 1;
 IF EXISTS (SELECT 1 FROM public.groups WHERE privacy <> 'public') THEN RAISE EXCEPTION 'Anonymous private group exposure'; END IF;
 IF EXISTS (SELECT 1 FROM public.pro_pages WHERE published IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Anonymous private page exposure'; END IF;
END $$;
SET LOCAL ROLE postgres;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908010000','native_access_recursion',ARRAY['{journal}']);\n"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation access-policy migration committed with anonymous privacy checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
