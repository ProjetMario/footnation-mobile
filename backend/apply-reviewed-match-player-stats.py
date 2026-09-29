"""Apply only the tested match statistics migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908041000_native_match_player_stats.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908041000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='match_player_stats')<>1 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.match_player_stats'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Match statistics access changed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.match_player_stats'::regclass) THEN RAISE EXCEPTION 'RLS required'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='match_player_stats' AND cmd IN ('INSERT','UPDATE'))<>2 THEN RAISE EXCEPTION 'Write policies missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='match_player_stats' AND cmd IN ('DELETE','ALL')) THEN RAISE EXCEPTION 'Unexpected physical deletion access'; END IF;
 IF has_function_privilege('anon','public.save_native_match_player_stats(uuid,uuid,uuid,jsonb,jsonb)','EXECUTE') OR (SELECT prosecdef FROM pg_proc WHERE oid='public.save_native_match_player_stats(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure) THEN RAISE EXCEPTION 'Unsafe statistics function'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.match_player_stats'::regclass AND tgname='native_match_player_stats_integrity') THEN RAISE EXCEPTION 'Integrity trigger missing'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908041000','native_match_player_stats',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation match statistics access and snapshot RPC committed.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
