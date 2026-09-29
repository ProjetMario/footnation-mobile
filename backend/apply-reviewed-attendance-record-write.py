"""Apply only the tested attendance-record-write migration to the explicitly linked FootNation project.
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
sql = (root/'migrations/20260908030000_native_attendance_record_write.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908030000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF to_regprocedure('public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected existing function'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.club_attendance_records'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Unexpected attendance trigger'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.club_attendance_records'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (session_id, player_id)') THEN RAISE EXCEPTION 'Unique session player required'; END IF;
 IF to_regprocedure('public.is_fff_club_admin(uuid)') IS NULL THEN RAISE EXCEPTION 'Club administrator helper missing'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('club_attendance_records','club_attendance_sessions','club_players') AND c.relrowsecurity)<>3 THEN RAISE EXCEPTION 'Club tables and RLS required'; END IF;
END $$;
""" + sql + """
DO $$ BEGIN
 IF has_function_privilege('anon','public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution'; END IF;
 IF NOT has_function_privilege('authenticated','public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Authenticated execution missing'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb)'::regprocedure) THEN RAISE EXCEPTION 'Invoker security required'; END IF;
END $$;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908030000','native_attendance_record_write',ARRAY['{journal}']);"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation attendance-record-write migration committed with privilege and RLS checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
