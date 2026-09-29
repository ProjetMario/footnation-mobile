"""Synthetic PostgreSQL tests. Always starts its own TCP-disabled disposable cluster."""
from pathlib import Path
import argparse
import os
import subprocess
import tempfile
import time

BASE = Path(__file__).resolve().parent
PG = Path(os.environ.get("FOOTNATION_POSTGRES_BIN", "/usr/local/opt/postgresql@16/bin"))
ENV = {**os.environ, "LC_ALL": "C", "LANG": "C"}


class Database:
    def __enter__(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fn_release_pg_", dir="/tmp")
        self.root = Path(self.temp.name)
        self.data, self.socket = self.root / "data", self.root / "socket"
        self.socket.mkdir(mode=0o700)
        self.db = "footnation_release_test_disposable"
        self.started = False
        self.children = []
        try:
            self.command("initdb", "-D", str(self.data), "-U", "fn_test", "-A", "trust", "--no-locale")
            self.command("pg_ctl", "-D", str(self.data), "-l", str(self.root / "postgres.log"),
                         "-o", f"-k {self.socket} -p 55493 -c listen_addresses=''", "-w", "start")
            self.started = True
            self.command("createdb", "-h", str(self.socket), "-p", "55493", "-U", "fn_test", self.db)
            self.args = [str(PG / "psql"), "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
                         "-h", str(self.socket), "-p", "55493", "-U", "fn_test", "-d", self.db]
            assert self.sql("SHOW listen_addresses").strip() == ""
            return self
        except Exception:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *args):
        for child in self.children:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=5)
        if self.started:
            self.command("pg_ctl", "-D", str(self.data), "-w", "stop", "-m", "fast")
        self.temp.cleanup()

    def command(self, name, *args):
        return subprocess.run([str(PG / name), *args], env=ENV, text=True, capture_output=True, check=True)

    def sql(self, text, ok=True):
        result = subprocess.run(self.args + ["-c", text], env=ENV, text=True, capture_output=True)
        if ok and result.returncode:
            raise RuntimeError(result.stderr)
        return result.stdout.strip() if ok else result

    def fixture(self, filename, setting):
        result = subprocess.run(self.args + ["-c", f"SET {setting}='1'", "-f", str(BASE / "tests" / filename)],
                                env=ENV, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr)

    def sleeping_transaction(self, sql):
        child = subprocess.Popen(self.args + ["-c", f"BEGIN; {sql}; SELECT pg_sleep(1.5); COMMIT"],
                                 env={**ENV, "PGAPPNAME": "fn_release_lane"}, text=True,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.children.append(child)
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise RuntimeError(child.communicate()[1])
            if self.sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='fn_release_lane' AND wait_event='PgSleep'") == "1":
                return child
            time.sleep(0.025)
        raise RuntimeError("Concurrent transaction did not reach its hold point")

    def finish(self, child):
        _, error = child.communicate(timeout=8)
        if child.returncode:
            raise RuntimeError(error)


def attachments_and_markers():
    with Database() as db:
        db.fixture("private-message-attachments.sql", "footnation.attachments_test_disposable")
        a, b = "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"
        for index, message_first in [(91, True), (92, False)]:
            message = f"40000000-0000-4000-8000-0000000000{index}"
            path = f"{a}/{b}/{message}/60000000-0000-4000-8000-000000000001.pdf"
            db.sql(f"INSERT INTO storage.objects(bucket_id,name,metadata,created_at) VALUES('message-attachments','{path}','{{\"mimetype\":\"application/pdf\",\"size\":128}}',now()-interval '49 hours')")
            insert = f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{a}'; INSERT INTO messages(id,sender_id,receiver_id,content,attachment) VALUES('{message}','{a}','{b}','',attachment_fixture('{path}'))"
            claim = "SET LOCAL ROLE service_role; SELECT count(*) FROM claim_native_message_attachment_cleanup(50)"
            lane = db.sleeping_transaction(insert if message_first else claim)
            if message_first:
                assert db.sql(f"SET ROLE service_role; SELECT count(*) FROM claim_native_message_attachment_cleanup(50) WHERE path='{path}'") == "0"
                db.finish(lane)
                assert db.sql(f"SELECT count(*) FROM native_message_attachment_cleanup WHERE path='{path}'") == "0"
                assert db.sql(f"SELECT count(*) FROM messages WHERE id='{message}'") == "1"
            else:
                denied = db.sql("BEGIN; " + insert + "; COMMIT", ok=False)
                db.finish(lane)
                assert denied.returncode and "42501" in denied.stderr, denied.stderr
                assert db.sql(f"SELECT count(*) FROM messages WHERE id='{message}'") == "0"
        print("PASS: attachment fixture and both real concurrent message/cleanup orders", flush=True)

        db.sql("CREATE TABLE public.shorts(id integer PRIMARY KEY)")
        db.sql((BASE.parent.parent / "supabase/migrations/20260911064000_short_goal_markers.sql").read_text())
        db.sql("INSERT INTO shorts(id,goal_timestamps) VALUES(1,'{}'),(2,'{0,1.5,86400}')")
        for values in ["{NULL}", "{-1}", "{NaN}", "{Infinity}", "{1,1}", "{2,1}", "{86401}", "{{1,2},{3,4}}"]:
            rejected = db.sql(f"INSERT INTO shorts VALUES(3,'{values}')", ok=False)
            assert rejected.returncode and "23514" in rejected.stderr, values
        rejected = db.sql("INSERT INTO shorts SELECT 3,array_agg(x::double precision) FROM generate_series(0,50) x", ok=False)
        assert rejected.returncode and "23514" in rejected.stderr
        print("PASS: Short goal marker migration, bounds, ordering, dimension and finite values", flush=True)


def push_claims():
    with Database() as db:
        db.fixture("native-push-delivery.sql", "footnation.push_test_disposable")
        db.sql("""SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
        SELECT register_native_push_device('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ExpoPushToken[synthetic_concurrency]','ios','30000000-0000-0000-0000-000000000003');
        RESET ROLE; INSERT INTO notifications(id,receiver_id,sender_id) VALUES('40000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')""")
        claim = "SELECT count(*) FROM claim_native_push_deliveries('20000000-0000-0000-0000-000000000001','send',100)"
        lane = db.sleeping_transaction("SET LOCAL ROLE service_role; " + claim)
        assert db.sql("SET ROLE service_role; " + claim) == "0"
        db.finish(lane)
        assert db.sql("SELECT count(*) FROM native_push_deliveries WHERE notification_id='40000000-0000-0000-0000-000000000091' AND state='sending'") == "1"
        print("PASS: push fixture and exclusive claim across two PostgreSQL connections", flush=True)


def experience_projection():
    with Database() as db:
        db.fixture("experience-projection.sql", "footnation.experience_test_disposable")
        uid = "00000000-0000-4000-8000-000000000002"
        authority = f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{uid}'; "
        first = "SELECT save_native_experience_history(fixture_experience(),fixture_experience('{\"position\":\"Défenseur\"}'))"
        second = "SELECT save_native_experience_history(fixture_experience(),fixture_experience('{\"position\":\"Attaquant\"}'))"
        lane = db.sleeping_transaction(authority + first)
        rejected = db.sql("BEGIN; " + authority + second + "; COMMIT", ok=False)
        db.finish(lane)
        assert rejected.returncode and "40001" in rejected.stderr, rejected.stderr
        assert db.sql(f"SELECT experience_history->0->>'position' FROM profiles WHERE id='{uid}'") == "Défenseur"
        assert db.sql(f"SELECT position FROM club_experience_members WHERE profile_id='{uid}' AND native_source IS NOT NULL") == "Défenseur"
        timestamp = db.sql(f"SELECT updated_at FROM profiles WHERE id='{uid}'")
        db.sql("BEGIN; " + authority + first + "; COMMIT")
        assert db.sql(f"SELECT updated_at FROM profiles WHERE id='{uid}'") == timestamp
        print("PASS: experience fixture, concurrent snapshot conflict, atomic projection and idempotent retry", flush=True)
    with Database() as db:
        db.fixture("experience-no-timestamp.sql", "footnation.experience_test_disposable")
        print("PASS: actual legacy profile shape without updated_at, save, projection and retry", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=["all", "attachments", "push", "experience"], default="all")
    suite = parser.parse_args().suite
    for name in ["initdb", "pg_ctl", "createdb", "psql"]:
        if not (PG / name).is_file():
            raise SystemExit("Set FOOTNATION_POSTGRES_BIN to a complete local PostgreSQL installation")
    for name, run in [("attachments", attachments_and_markers), ("push", push_claims), ("experience", experience_projection)]:
        if suite in ("all", name):
            run()
