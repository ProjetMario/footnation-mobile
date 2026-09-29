"""Apply only the tested attendance corrections migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908035000_native_member_convocations.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908035000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF to_regprocedure('public.get_native_member_convocations(integer,integer)') IS NOT NULL OR to_regprocedure('public.respond_native_member_convocation(uuid,text,text,timestamptz)') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected member functions'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.club_convocation_players'::regclass AND confrelid='public.club_players'::regclass AND contype='f') THEN RAISE EXCEPTION 'Player relation changed'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.club_convocation_players'::regclass,'public.club_convocations'::regclass,'public.club_players'::regclass) AND relrowsecurity)<>3 THEN RAISE EXCEPTION 'RLS required'; END IF;
END $$;
"""+sql+"""
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.get_native_member_convocations(integer,integer)','public.respond_native_member_convocation(uuid,text,text,timestamptz)'] LOOP
  IF has_function_privilege('anon',signature,'EXECUTE') OR NOT has_function_privilege('authenticated',signature,'EXECUTE') THEN RAISE EXCEPTION 'Invalid privileges'; END IF;
 END LOOP;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908035000','native_member_convocations',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation member convocations committed with relation and privilege checks.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
