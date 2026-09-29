"""Apply only the tested story views migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908050000_native_story_views.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908050000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF to_regclass('public.story_views') IS NOT NULL THEN RAISE EXCEPTION 'Story views already exists'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.story_views'::regclass) THEN RAISE EXCEPTION 'RLS required'; END IF;
 IF has_table_privilege('anon','public.story_views','SELECT') THEN RAISE EXCEPTION 'Anonymous read forbidden'; END IF;
 IF has_column_privilege('authenticated','public.story_views','created_at','INSERT') THEN RAISE EXCEPTION 'Timestamp must be server-owned'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908050000','native_story_views',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation story views committed.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
