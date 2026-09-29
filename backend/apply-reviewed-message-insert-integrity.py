"""Apply only the tested message insert integrity migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908046000_native_message_insert_integrity.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908046000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.messages'::regclass AND NOT tgisinternal)<>1 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.messages'::regclass AND tgname='native_message_update_integrity') THEN RAISE EXCEPTION 'Message triggers changed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='messages')<>3 THEN RAISE EXCEPTION 'Message policies changed'; END IF;
 IF to_regprocedure('public.is_site_admin()') IS NULL THEN RAISE EXCEPTION 'Admin authority missing'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.messages'::regclass AND tgname='native_message_insert_integrity') THEN RAISE EXCEPTION 'Guard missing'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.guard_native_message_insert()'::regprocedure) THEN RAISE EXCEPTION 'Invoker required'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908046000','native_message_insert_integrity',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation message insert integrity committed.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
