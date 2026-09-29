from pathlib import Path
import os, subprocess, tempfile, shutil, sys
root = Path(__file__).resolve().parents[2]
fixture = sys.argv[1] if len(sys.argv) > 1 else 'access.sql'
if fixture not in ['access.sql', 'profile-workflows.sql', 'club-claim-review.sql', 'pro-media.sql', 'pro-authority.sql', 'pro-review-privacy.sql', 'club-status.sql', 'primary-team.sql', 'club-news.sql', 'club-chat-access.sql', 'club-achievements.sql', 'club-chat-integrity.sql', 'club-report-review.sql', 'club-message-moderation.sql', 'profile-snapshot-save.sql', 'club-message-snapshot.sql', 'profile-visibility.sql', 'personal-safety-privacy.sql', 'club-record-snapshot.sql', 'attendance-record-write.sql', 'attendance-corrections.sql', 'club-admin-integrity.sql', 'membership-response.sql', 'member-convocations.sql', 'convocation-roster.sql', 'club-player-management.sql', 'club-staff-management.sql', 'club-news-comments.sql', 'club-follow-owner.sql', 'match-player-stats.sql', 'match-mvp.sql', 'conversation-list.sql', 'message-realtime.sql', 'message-update-integrity.sql', 'message-insert-integrity.sql', 'message-send-permission.sql', 'connection-consent.sql', 'connection-removal.sql', 'story-views.sql', 'member-attendance.sql', 'team-leave.sql', 'member-roster.sql', 'organization-integrity.sql', 'native-push-registry.sql', 'native-push-intents.sql']: raise SystemExit('Unknown fixture')
base = Path(tempfile.mkdtemp(prefix='footnation-rls-test-', dir='/private/tmp'))
bin_dir = Path('/usr/local/opt/postgresql@16/bin')
env = {**os.environ, 'LC_ALL': 'C', 'LANG': 'C'}
started = False
try:
    subprocess.run([str(bin_dir/'initdb'), '-D', str(base/'data'), '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8', '--wal-segsize=1'], env=env, check=True, stdout=subprocess.DEVNULL)
    subprocess.run([str(bin_dir/'pg_ctl'), '-D', str(base/'data'), '-l', str(base/'postgres.log'), '-o', f"-k {base} -c listen_addresses='' -c min_wal_size=2MB -c max_wal_size=16MB" + (" -c wal_level=logical" if fixture == "message-realtime.sql" else ""), '-w', 'start'], env=env, check=True, stdout=subprocess.DEVNULL)
    started = True
    subprocess.run([str(bin_dir/'createdb'), '-h', str(base), '-U', 'postgres', 'footnation_test_access'], env=env, check=True)
    result = subprocess.run([str(bin_dir/'psql'), '-X', '-h', str(base), '-U', 'postgres', '-d', 'footnation_test_access', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', str(root/'backend/tests'/fixture)], env=env, text=True, capture_output=True)
    print(result.stdout[-1800:])
    print(result.stderr[-2500:])
    if result.returncode: raise SystemExit(result.returncode)
    if fixture == "club-admin-integrity.sql":
        subprocess.run([sys.executable,str(root/"backend/tests/club-admin-concurrency.py"),str(bin_dir),str(base),"footnation_test_access"],env=env,check=True)
finally:
    if started: subprocess.run([str(bin_dir/'pg_ctl'), '-D', str(base/'data'), '-m', 'fast', '-w', 'stop'], env=env, stdout=subprocess.DEVNULL, check=True)
    shutil.rmtree(base)
