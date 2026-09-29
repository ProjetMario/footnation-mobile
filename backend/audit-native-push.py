"""Inspect push infrastructure metadata without member content or writes."""
from pathlib import Path
import os, shlex, subprocess
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

query="""SET ROLE postgres;
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%push%' OR table_name ILIKE '%device%' OR table_name ILIKE '%notification%') ORDER BY table_name;
SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' ORDER BY ordinal_position;
SELECT tgname FROM pg_trigger WHERE tgrelid='public.notifications'::regclass AND NOT tgisinternal;
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net');
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (proname ILIKE '%push%' OR proname ILIKE '%notif%') ORDER BY proname;
"""
r=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-A','-t','-c',query],env=env,text=True,capture_output=True)
print(r.stdout if r.returncode==0 else 'Metadata query failed')
raise SystemExit(r.returncode)
