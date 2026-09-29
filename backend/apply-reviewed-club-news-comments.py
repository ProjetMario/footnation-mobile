"""Apply only the tested club news comments migration to the explicitly linked FootNation project.
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
sql=(root/'migrations/20260908039000_native_club_news_comments.sql').read_text()
journal=sql.replace("'","''")
script="""SET ROLE postgres;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260908039000') THEN RAISE EXCEPTION 'Already installed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_news_comments')<>2 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_news_likes')<>3 THEN RAISE EXCEPTION 'Interaction policies changed'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.club_news_comments'::regclass,'public.club_news_likes'::regclass) AND relrowsecurity)<>2 THEN RAISE EXCEPTION 'RLS required'; END IF;
 IF NOT has_table_privilege('authenticated','public.club_news_comments','INSERT,SELECT') THEN RAISE EXCEPTION 'Comment privileges required'; END IF;
END $$;
"""+sql+"""
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('club_news_comments','club_news_likes') AND permissive='RESTRICTIVE')<>4 THEN RAISE EXCEPTION 'Restrictive policies missing'; END IF;
 IF has_function_privilege('anon','public.create_native_club_news_comment(uuid,uuid,uuid,text)','EXECUTE') OR (SELECT prosecdef FROM pg_proc WHERE oid='public.create_native_club_news_comment(uuid,uuid,uuid,text)'::regprocedure) THEN RAISE EXCEPTION 'Unsafe comment function'; END IF;
END $$;
"""+f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260908039000','native_club_news_comments',ARRAY['{journal}']);"
result=subprocess.run(['/usr/local/opt/postgresql@16/bin/psql','-X','-v','ON_ERROR_STOP=1','--single-transaction'],input=script,env=env,text=True,capture_output=True)
output=result.stderr
for key in keys: output=output.replace(env[key],f'<{key}>')
print('FootNation comment publication policies and idempotent RPC committed.' if result.returncode==0 else output[-2500:])
raise SystemExit(result.returncode)
