"""Apply only the tested club-chat-access migration to the explicitly linked FootNation project.
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
sql = (root/'migrations/20260908019000_native_club_chat_access.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908019000') OR to_regprocedure('public.fn_native_club_chat_admin(uuid)') IS NOT NULL OR to_regprocedure('public.fn_native_club_chat_member(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF to_regprocedure('public.is_fff_club_admin(uuid)') IS NULL THEN RAISE EXCEPTION 'Required helper missing'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('club_chat_groups','club_chat_group_members'))<>4 THEN RAISE EXCEPTION 'Policies changed; audit required'; END IF;
END $$;
""" + sql + """
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('club_chat_groups','club_chat_group_members'))<>4 THEN RAISE EXCEPTION 'Policy count mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.club_chat_groups'::regclass,'public.club_chat_group_members'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
END $$;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908019000','native_club_chat_access',ARRAY['{journal}']);"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation club-chat-access migration committed with policy checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
