-- Echoes + inbox (GDD §8, §11). Additive. An Echo is a dead player's build snapshot
-- placed on their death floor; one per account (a new death upserts over the old).

CREATE TABLE IF NOT EXISTS echoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  season     integer NOT NULL,
  owner_name text NOT NULL,
  class      text NOT NULL,
  floor      integer NOT NULL,
  honor      integer NOT NULL,
  build      jsonb NOT NULL,
  defeats    integer NOT NULL DEFAULT 0,
  kills      integer NOT NULL DEFAULT 0,
  expired    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- One Echo per account (upsert target).
CREATE UNIQUE INDEX IF NOT EXISTS echoes_account_uq ON echoes (account_id);
-- Placement scan: live Echoes near a floor.
CREATE INDEX IF NOT EXISTS echoes_live_floor_idx ON echoes (floor) WHERE expired = false;

CREATE TABLE IF NOT EXISTS inbox (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  body       text NOT NULL,
  ref_id     uuid,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inbox_account_idx ON inbox (account_id, read);
