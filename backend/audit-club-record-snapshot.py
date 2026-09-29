"""Read club table and snapshot function metadata without reading member content."""
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

query="""SET ROLE postgres; SELECT c.relname,c.relrowsecurity,string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),',' ORDER BY a.attnum) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='public' AND c.relname IN ('club_staff','teams','club_convocations','club_matches','club_achievements','club_news','club_publications','club_shorts') GROUP BY c.relname,c.relrowsecurity ORDER BY c.relname; SELECT version FROM supabase_migrations.schema_migrations WHERE version='20260908029000'; SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE'),has_function_privilege('authenticated',oid,'EXECUTE') FROM pg_proc WHERE oid=to_regprocedure('public.mutate_native_club_record_snapshot(text,uuid,uuid,jsonb,jsonb,boolean)');"""

r=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-A','-t','-c',query],env=env,text=True,capture_output=True)
print(r.stdout if r.returncode==0 else 'Metadata query failed')
