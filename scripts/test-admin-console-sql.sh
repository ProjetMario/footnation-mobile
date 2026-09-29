#!/bin/sh
set -eu
TASK_PG_BIN=${TASK_PG_BIN:-/usr/local/opt/postgresql@16/bin}
TASK_PG_ROOT=$(mktemp -d /tmp/footnation-admin-pg.XXXXXX)
TASK_REPO_ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
mkdir "$TASK_PG_ROOT/socket"
LC_ALL=C LANG=C "$TASK_PG_BIN/initdb" -U postgres -D "$TASK_PG_ROOT/data" -A trust --no-locale > "$TASK_PG_ROOT/init.log"
LC_ALL=C LANG=C "$TASK_PG_BIN/pg_ctl" -D "$TASK_PG_ROOT/data" -l "$TASK_PG_ROOT/server.log" -o "-k $TASK_PG_ROOT/socket -c listen_addresses=''" start >/dev/null
trap 'LC_ALL=C LANG=C "$TASK_PG_BIN/pg_ctl" -D "$TASK_PG_ROOT/data" stop -m fast >/dev/null; rm -rf -- "$TASK_PG_ROOT/data"' EXIT
"$TASK_PG_BIN/createdb" -U postgres -h "$TASK_PG_ROOT/socket" admin_console_test_contract
if "$TASK_PG_BIN/psql" -U postgres -X -h "$TASK_PG_ROOT/socket" -d admin_console_test_contract -v ON_ERROR_STOP=1 -f "$TASK_REPO_ROOT/tests/admin-console.sql" > "$TASK_PG_ROOT/result.log" 2>&1; then
  printf 'Admin console SQL passed. Log: %s/result.log\n' "$TASK_PG_ROOT"
else
  tail -35 "$TASK_PG_ROOT/result.log"
  exit 1
fi
