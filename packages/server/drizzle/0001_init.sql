-- Towventure Phase 1 schema (ARCHITECTURE.md §6). Additive/expand-contract only;
-- never edit an applied migration (AGENTS.md §4).

CREATE TABLE IF NOT EXISTS accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  pass_hash  text NOT NULL,
  email      text,
  is_guest   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  flags      jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_name_lower_uq ON accounts (lower(name));

CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id);

CREATE TABLE IF NOT EXISTS runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  class         text NOT NULL,
  vows          jsonb NOT NULL DEFAULT '[]'::jsonb,
  seed          bigint NOT NULL,
  state         jsonb NOT NULL,
  state_version integer NOT NULL DEFAULT 0,
  floor         integer NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'active',
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz
);
-- At most one active run per account.
CREATE UNIQUE INDEX IF NOT EXISTS runs_one_active_per_account
  ON runs (account_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS runs_account_idx ON runs (account_id);

CREATE TABLE IF NOT EXISTS run_events (
  run_id  uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq     integer NOT NULL,
  at      timestamptz NOT NULL DEFAULT now(),
  command jsonb NOT NULL,
  PRIMARY KEY (run_id, seq)
);

CREATE TABLE IF NOT EXISTS fights (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  floor      integer NOT NULL,
  kind       text NOT NULL,
  seed       bigint NOT NULL,
  result     jsonb NOT NULL,
  log_hash   bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fights_run_idx ON fights (run_id);

CREATE TABLE IF NOT EXISTS honor_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  season     integer NOT NULL,
  delta      integer NOT NULL,
  reason     text NOT NULL,
  ref_id     uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS honor_ledger_season_account_idx ON honor_ledger (season, account_id);

CREATE TABLE IF NOT EXISTS climb_frontier (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  season     integer NOT NULL,
  best_floor integer NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, season)
);
