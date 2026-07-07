-- Honor Merchant (GDD §10.2). Additive. Cosmetic unlocks are permanent (not seasonal);
-- the armed War Chest boon lives on the account and is consumed at the next run's start.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS armed_boon text;

CREATE TABLE IF NOT EXISTS unlocks (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, item_id)
);
