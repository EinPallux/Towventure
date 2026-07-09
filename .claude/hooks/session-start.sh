#!/bin/bash
# SessionStart hook — provision the local Postgres this monorepo needs so `pnpm test`
# (the server integration suite gates on DATABASE_URL) and `pnpm dev` work out of the
# box in Claude Code on the web. Dev-only: gated on the remote flag, idempotent, and
# carrying only a throwaway local dev secret — never production config.
set -euo pipefail

# Only provision in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

# 1. Workspace dependencies (idempotent; `install`, not `ci`, so the cached container reuses them).
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
fi

# 2. Start PostgreSQL 16.
service postgresql start 2>/dev/null || pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do pg_isready -q && break; sleep 1; done

# 3. Ensure the `towventure` role + `towventure_test` database exist (idempotent).
su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='towventure'\"" | grep -q 1 \
  || su postgres -c "psql -c \"CREATE ROLE towventure LOGIN PASSWORD 'towventure'\""
su postgres -c "psql -c \"ALTER ROLE towventure LOGIN PASSWORD 'towventure'\"" >/dev/null
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='towventure_test'\"" | grep -q 1 \
  || su postgres -c "psql -c \"CREATE DATABASE towventure_test OWNER towventure\""

# 4. Persist connection env for the session. DATABASE_URL un-skips the server suite and lets
#    `pnpm dev` connect; SESSION_SECRET is a throwaway local dev value (the server needs one
#    to boot). Production supplies both via the real environment (OPERATIONS.md §2).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export DATABASE_URL="postgres://towventure:towventure@127.0.0.1:5432/towventure_test"'
    echo 'export SESSION_SECRET="local-dev-session-secret-0000000000"'
  } >> "$CLAUDE_ENV_FILE"
fi

echo "session-start: Postgres 16 up, towventure_test provisioned, DATABASE_URL exported."
