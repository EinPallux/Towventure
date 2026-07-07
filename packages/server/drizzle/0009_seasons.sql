-- Season metadata (GDD §11). Additive. The 8-week window + status for the end-date UI;
-- Honor stays in the seasoned honor_ledger. The rollover job seeds placement rows.

CREATE TABLE IF NOT EXISTS seasons (
  number     integer PRIMARY KEY,
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz NOT NULL,
  status     text NOT NULL DEFAULT 'active'
);
