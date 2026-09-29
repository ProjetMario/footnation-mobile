"""Apply only the tested pro-review-privacy migration to the explicitly linked FootNation project.
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
sql = (root/'migrations/20260908015000_native_pro_review_privacy.sql').read_text()
journal = sql.replace("'", "''")
script = """SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908015000') THEN
  RAISE EXCEPTION 'This migration has already been applied';
 END IF;
 IF to_regclass('public.pro_page_review_details') IS NOT NULL OR EXISTS(SELECT 1 FROM public.pro_pages) THEN
  RAISE EXCEPTION 'Pro page state changed since the empty-page audit';
 END IF;
END $$;
""" + sql + """
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.pro_pages'::regclass AND tgname='zz_native_capture_pro_review' AND tgenabled='O') THEN RAISE EXCEPTION 'Private capture missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_pages WHERE request_message IS NOT NULL OR verification_notes IS NOT NULL) THEN RAISE EXCEPTION 'Public review text remains'; END IF;
 IF has_table_privilege('anon','public.pro_page_review_details','INSERT,UPDATE,DELETE,TRUNCATE') OR has_table_privilege('authenticated','public.pro_page_review_details','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Direct private writes remain'; END IF;
END $$;
""" + f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908015000','native_pro_review_privacy',ARRAY['{journal}']);\n"
result = subprocess.run(['/usr/local/opt/postgresql@16/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=script, env=env, text=True, capture_output=True)
output = result.stderr
for key in keys:
    output = output.replace(env[key], f'<{key}>')
print('FootNation pro-review-privacy migration committed with privilege checks.' if result.returncode == 0 else output[-2500:])
raise SystemExit(result.returncode)
