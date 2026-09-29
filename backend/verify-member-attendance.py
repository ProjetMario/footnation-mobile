"""Read club member space schema and policies without member content or writes."""
from pathlib import Path
import argparse, os, shlex, subprocess
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
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

query="""SET ROLE postgres; SELECT version FROM supabase_migrations.schema_migrations WHERE version='20260908051000'; SELECT prosecdef,proconfig,pg_get_function_result(oid),has_function_privilege('anon',oid,'EXECUTE'),has_function_privilege('authenticated',oid,'EXECUTE') FROM pg_proc WHERE oid=to_regprocedure('public.get_native_member_attendance(uuid,integer,integer)'); SELECT policyname,cmd,qual FROM pg_policies WHERE schemaname='public' AND tablename='club_attendance_sessions';"""
r=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-A','-t','-c',query],env=env,text=True,capture_output=True)
output=r.stdout if r.returncode==0 else r.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print(output)
raise SystemExit(r.returncode)
