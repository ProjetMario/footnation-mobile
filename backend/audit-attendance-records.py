"""Read attendance session columns, constraints and policies without member data."""
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

query="""SET ROLE postgres; SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('club_attendance_records','club_players') ORDER BY table_name,ordinal_position; SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('club_attendance_records','club_players'); SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.club_attendance_records'::regclass; SELECT tgname FROM pg_trigger WHERE tgrelid='public.club_attendance_records'::regclass AND NOT tgisinternal; SELECT version FROM supabase_migrations.schema_migrations WHERE version='20260908030000'; SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE'),has_function_privilege('authenticated',oid,'EXECUTE') FROM pg_proc WHERE oid=to_regprocedure('public.save_native_attendance_record(uuid,uuid,uuid,text,text,jsonb)');"""

r=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-A','-t','-c',query],env=env,text=True,capture_output=True)
print(r.stdout if r.returncode==0 else 'Metadata query failed')
