"""Two real connections attempt to remove each other in a disposable database."""
import subprocess, sys, time
bin_dir, socket, database = sys.argv[1:]
if not database.startswith('footnation_test_'):
    raise SystemExit('Disposable database required')
command = [bin_dir+'/psql','-X','-A','-t','-h',socket,'-U','postgres','-d',database,'-v','ON_ERROR_STOP=1']
first = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
second = None
try:
    first.stdin.write("SET application_name='fn-admin-first'; BEGIN; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; DELETE FROM club_admins WHERE profile_id='00000000-0000-0000-0000-000000000002'; SELECT pg_sleep(2); COMMIT;\n")
    first.stdin.close()
    deadline = time.monotonic()+8
    while True:
        check = subprocess.run(command+['-c',"SELECT count(*) FROM pg_stat_activity WHERE application_name='fn-admin-first' AND state='active' AND wait_event='PgSleep'"],capture_output=True,text=True,check=True)
        if check.stdout.strip()=='1': break
        if first.poll() is not None or time.monotonic()>deadline:
            raise RuntimeError('First live transaction did not reach its verified wait')
        time.sleep(.02)
    second = subprocess.run(command,input="BEGIN; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; DELETE FROM club_admins WHERE profile_id='00000000-0000-0000-0000-000000000001'; COMMIT;",capture_output=True,text=True,timeout=10)
    first.wait(timeout=10)
    if first.returncode != 0 or second.returncode == 0 or 'accès administrateur a changé' not in second.stderr:
        raise RuntimeError('Concurrent authority recheck failed: '+second.stderr)
    result = subprocess.run(command+['-c',"SELECT count(*) FROM club_admins WHERE club_id='00000000-0000-0000-0000-000000000100'"],capture_output=True,text=True,check=True)
    if result.stdout.strip()!='1': raise RuntimeError('Club lost its final administrator')
    print('Two-connection test passed: second removal waits, then rejects revoked authority; one administrator remains.')
finally:
    if first.poll() is None:
        first.kill()
        first.wait()
