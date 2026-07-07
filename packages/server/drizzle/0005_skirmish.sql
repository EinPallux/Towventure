-- Skirmishes (GDD §9). Additive. A defense snapshot per account + an attack ledger
-- that backs tickets, the once/day guard, weekly anti-farm decay, and Champion's Keys.

CREATE TABLE IF NOT EXISTS defenses (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  season     integer NOT NULL,
  owner_name text NOT NULL,
  class      text NOT NULL,
  floor      integer NOT NULL,
  honor      integer NOT NULL,
  build      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skirmishes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season       integer NOT NULL,
  attacker_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  defender_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attacker_won boolean NOT NULL,
  honor_delta  integer NOT NULL,
  key_awarded  boolean NOT NULL DEFAULT false,
  key_spent    boolean NOT NULL DEFAULT false,
  seed         bigint NOT NULL,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skirmishes_attacker_at_idx ON skirmishes (attacker_id, at);
CREATE INDEX IF NOT EXISTS skirmishes_pair_at_idx ON skirmishes (attacker_id, defender_id, at);
