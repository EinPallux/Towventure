-- Valor Marks ledger (GDD §10.2). Additive; the soft-currency twin of honor_ledger.
-- Season Marks balance is SUM(delta): positive = earnings, negative = Merchant spend.

CREATE TABLE IF NOT EXISTS marks_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  season     integer NOT NULL,
  delta      integer NOT NULL,
  reason     text NOT NULL,
  ref_id     uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marks_ledger_season_account_idx ON marks_ledger (season, account_id);
