"""Apply only the tested profile-visibility migration to the explicitly linked FootNation project.
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
sql = (root/'migrations/20260908027000_native_profile_visibility.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908027000') OR to_regprocedure('public.fn_native_profile_visible(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND cmd='SELECT')<>3 THEN RAISE EXCEPTION 'Profile read policies changed'; END IF;
 IF md5(pg_get_functiondef((SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_profile_connections'))) <> '3e973c10aab73ce3523f8bd99551ab58' THEN RAISE EXCEPTION 'Audited function changed: get_profile_connections'; END IF;
 IF md5(pg_get_functiondef((SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_connection_suggestions'))) <> 'e8ec2967f59e0bfcd36539c0264b2e8b' THEN RAISE EXCEPTION 'Audited function changed: get_connection_suggestions'; END IF;
 IF md5(pg_get_functiondef((SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_ranked_connection_suggestions'))) <> '5a4d3d0e03480d40b3a3c1f75a483f84' THEN RAISE EXCEPTION 'Audited function changed: get_ranked_connection_suggestions'; END IF;
END $$;
""" + sql + """
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Native profile visibility' AND permissive='RESTRICTIVE') THEN RAISE EXCEPTION 'Visibility policy missing'; END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('get_connection_suggestions','get_profile_connections','get_ranked_connection_suggestions') AND prosrc LIKE '%fn_native_profile_visible%')<>3 THEN RAISE EXCEPTION 'Recommendation filters missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid='public.profiles'::regclass AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
END $$;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908027000','native_profile_visibility',ARRAY['{journal}']);"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation profile-visibility migration committed with policy checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
