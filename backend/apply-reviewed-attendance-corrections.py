"""Apply only the tested attendance corrections migration to the explicitly linked FootNation project.
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
sql = (root/'migrations/20260908031000_native_attendance_corrections.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908031000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF to_regprocedure('public.update_native_attendance_session(uuid,uuid,jsonb,jsonb)') IS NOT NULL OR to_regprocedure('public.delete_native_attendance_record(uuid,uuid,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected functions'; END IF;
 IF to_regprocedure('public.is_fff_club_admin(uuid)') IS NULL THEN RAISE EXCEPTION 'Helper missing'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.club_attendance_sessions'::regclass,'public.club_attendance_records'::regclass) AND relrowsecurity)<>2 THEN RAISE EXCEPTION 'RLS required'; END IF;
 IF (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute WHERE attrelid='public.club_attendance_sessions'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM ARRAY['category','club_id','created_at','created_by','id','notes','session_date','session_type'] THEN RAISE EXCEPTION 'Session schema changed'; END IF;
END $$;
""" + sql + """
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.update_native_attendance_session(uuid,uuid,jsonb,jsonb)','public.delete_native_attendance_record(uuid,uuid,jsonb)'] LOOP
  IF has_function_privilege('anon',signature,'EXECUTE') OR NOT has_function_privilege('authenticated',signature,'EXECUTE') THEN RAISE EXCEPTION 'Invalid execution privileges'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid=signature::regprocedure) THEN RAISE EXCEPTION 'Invoker security required'; END IF;
 END LOOP;
END $$;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908031000','native_attendance_corrections',ARRAY['{journal}']);"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation attendance corrections committed with schema, RLS and privilege checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
