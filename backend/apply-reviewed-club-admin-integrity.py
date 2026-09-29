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
sql=(root/'migrations/20260908032000_native_club_admin_integrity.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908032000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.club_admins'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Unexpected admin trigger'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_admins')<>5 THEN RAISE EXCEPTION 'Admin policies changed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.club_admins'::regclass) OR to_regprocedure('public.is_fff_club_admin(uuid)') IS NULL THEN RAISE EXCEPTION 'RLS and authority helper required'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.club_admins'::regclass AND tgname='native_club_admin_integrity') THEN RAISE EXCEPTION 'Integrity guard missing'; END IF;
 IF has_function_privilege('anon','public.guard_native_club_admin()','EXECUTE') OR has_function_privilege('authenticated','public.guard_native_club_admin()','EXECUTE') THEN RAISE EXCEPTION 'Trigger is not directly callable'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_admins' AND cmd IN ('INSERT','UPDATE','DELETE') AND coalesce(qual,with_check)='is_fff_club_admin(club_id)')<>3 THEN RAISE EXCEPTION 'Authority policies incomplete'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908032000','native_club_admin_integrity',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation club administrator integrity committed with policy and trigger checks.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
