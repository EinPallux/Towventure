-- Codex lifetime discovery per account (CONTENT §7). Additive; banked once per run
-- at its end. progress = highest ★ for items, cumulative kills for enemies.

CREATE TABLE IF NOT EXISTS codex (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  entry_id   text NOT NULL,
  progress   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, kind, entry_id)
);
