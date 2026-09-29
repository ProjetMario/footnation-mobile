"""Apply only the tested native push intents migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260909056000_native_push_intents.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260909056000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908055000') THEN RAISE EXCEPTION 'Registry migration missing'; END IF;
 IF to_regclass('public.native_push_intents') IS NOT NULL OR to_regprocedure('public.register_native_push_device(uuid,uuid,text,text,uuid)') IS NOT NULL OR to_regprocedure('public.revoke_native_push_device(uuid,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Push intents already exist'; END IF;
 IF EXISTS(SELECT 1 FROM public.native_push_installations) THEN RAISE EXCEPTION 'Existing devices require migration review'; END IF;
END $$;
"""+sql+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260909056000','native_push_intents',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation native push intents committed.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
