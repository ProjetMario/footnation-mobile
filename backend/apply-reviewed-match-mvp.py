"""Apply only the tested match MVP migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908042000_native_match_mvp.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908042000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='match_mvp_votes')<>2 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.match_mvp_votes'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'MVP definitions changed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.match_mvp_votes'::regclass) THEN RAISE EXCEPTION 'RLS required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.match_mvp_votes'::regclass AND conname='match_mvp_votes_match_id_voter_id_key') THEN RAISE EXCEPTION 'Vote uniqueness required'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='match_mvp_votes' AND policyname='native_match_mvp_candidate' AND permissive='RESTRICTIVE') THEN RAISE EXCEPTION 'Candidate restriction missing'; END IF;
 IF has_function_privilege('anon','public.cast_native_match_mvp_vote(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous vote'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid IN ('public.cast_native_match_mvp_vote(uuid,uuid,uuid)'::regprocedure,'public.get_native_match_mvp_candidates(uuid,uuid,integer)'::regprocedure,'public.native_match_mvp_eligible(uuid,uuid)'::regprocedure) AND prosecdef) THEN RAISE EXCEPTION 'Invoker functions required'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908042000','native_match_mvp',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation MVP candidate restriction, reader and vote RPC committed.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
