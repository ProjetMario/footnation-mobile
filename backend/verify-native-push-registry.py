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
SELECT version FROM supabase_migrations.schema_migrations WHERE version='20260908055000';
SELECT relrowsecurity FROM pg_class WHERE oid='public.native_push_installations'::regclass;
SELECT count(*) FROM public.native_push_installations;
SELECT has_table_privilege('authenticated','public.native_push_installations','SELECT'),has_table_privilege('authenticated','public.native_push_installations','INSERT'),has_table_privilege('anon','public.native_push_installations','SELECT');
SELECT proname,prosecdef,proconfig,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE') FROM pg_proc p WHERE p.oid IN ('public.register_native_push_installation(uuid,uuid,text,text)'::regprocedure,'public.revoke_native_push_installation(uuid,uuid)'::regprocedure);
"""
r=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-A','-t','-c',query],env=env,text=True,capture_output=True)
print(r.stdout if r.returncode==0 else 'Metadata query failed')
raise SystemExit(r.returncode)
