"""Run isolated SQL assertions in a new local cluster; never use a linked database."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--suite", choices=("calendar", "opportunities"), default="calendar")
suite = parser.parse_args().suite
database = "calls_test_calendar_audit" if suite == "calendar" else "opportunity_test_listing_kind"
fixture = "team-calendar-backend.sql" if suite == "calendar" else "opportunity-listing-kind-backend.sql"
configured = os.environ.get("FOOTNATION_TEST_PG_BIN")
if configured:
    binaries = Path(configured)
else:
    config = shutil.which("pg_config")
    if not config:
        raise SystemExit("PostgreSQL required: set FOOTNATION_TEST_PG_BIN to its bin directory.")
    binaries = Path(subprocess.check_output([config, "--bindir"], text=True).strip())

environment = {**os.environ, "LC_ALL": "C", "LANG": "C"}
# Keep macOS Unix socket paths shorter than sockaddr_un.sun_path.
with tempfile.TemporaryDirectory(prefix="fn-sql-") as folder:
    root = Path(folder)
    data = root / "db"
    socket = root / "socket"
    socket.mkdir()
    subprocess.run([str(binaries / "initdb"), "-D", str(data), "-A", "trust", "--no-locale"],
                   check=True, env=environment, stdout=subprocess.DEVNULL)
    started = False
    try:
        try:
            subprocess.run([str(binaries / "pg_ctl"), "-D", str(data), "-l", str(root / "postgres.log"),
                            "-o", f"-k {socket} -c listen_addresses=''", "-w", "start"],
                           check=True, env=environment, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            log = root / "postgres.log"
            if log.exists():
                print(log.read_text()[-6000:])
            raise
        started = True
        subprocess.run([str(binaries / "createdb"), "-h", str(socket), database],
                       check=True, env=environment)
        subprocess.run([str(binaries / "psql"), "-X", "-q", *(["-1"] if suite == "calendar" else []), "-h", str(socket),
                        "-d", database, "-v", "ON_ERROR_STOP=1", "-v", "opportunity_test_disposable=1",
                        "-f", str(repo / "tests" / fixture)], check=True, env=environment)
    finally:
        if started:
            subprocess.run([str(binaries / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"],
                           check=True, env=environment, stdout=subprocess.DEVNULL)
