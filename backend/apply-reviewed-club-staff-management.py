"""Apply only the tested club staff management migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908038000_native_club_staff_management.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908038000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean)'::regprocedure) IS DISTINCT FROM '65eba86a337cc4a7ebd6cd0f9bd13dad' THEN RAISE EXCEPTION 'Record function changed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_staff')<>1 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.club_staff'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Staff access definitions changed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.club_staff'::regclass) THEN RAISE EXCEPTION 'Staff RLS required'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_staff' AND cmd IN ('INSERT','UPDATE'))<>2 THEN RAISE EXCEPTION 'Staff write policies missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_staff' AND cmd IN ('DELETE','ALL')) THEN RAISE EXCEPTION 'Physical deletion not intended'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.club_staff'::regclass AND tgname='native_club_staff_integrity') THEN RAISE EXCEPTION 'Staff integrity guard missing'; END IF;
 IF has_function_privilege('anon','public.mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous mutation'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908038000','native_club_staff_management',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation club staff management committed with RLS and history-preservation checks.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
