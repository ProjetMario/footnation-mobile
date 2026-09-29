"""Read only the club message schema and trigger metadata on FootNation. No message content is fetched."""
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

query="SET ROLE postgres; SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.club_chat_messages'::regclass AND NOT tgisinternal; SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='club_chat_messages' ORDER BY ordinal_position;"

r=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-A','-t','-c',query],env=env,text=True,capture_output=True)
print(r.stdout if r.returncode==0 else 'Metadata query failed')
