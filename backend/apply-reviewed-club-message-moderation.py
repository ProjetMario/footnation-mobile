"""Apply only the tested club-message-moderation migration to the explicitly linked FootNation project.
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
sql = (root/'migrations/20260908023000_native_club_message_moderation.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908023000') OR to_regprocedure('public.moderate_native_club_report_message(uuid,boolean,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF to_regprocedure('public.get_native_club_report_message(uuid)') IS NULL THEN RAISE EXCEPTION 'Required report reader missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.club_chat_messages'::regclass AND tgname='native_club_chat_message_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'Message guard missing'; END IF;
END $$;
""" + sql + """
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.moderate_native_club_report_message(uuid,boolean,text,text)'::regprocedure AND prosecdef AND proowner='postgres'::regrole) THEN RAISE EXCEPTION 'Unexpected moderation function authority'; END IF;
 IF has_function_privilege('anon','public.moderate_native_club_report_message(uuid,boolean,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous moderation exposed'; END IF;
END $$;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908023000','native_club_message_moderation',ARRAY['{journal}']);"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation club-message-moderation migration committed with policy checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
