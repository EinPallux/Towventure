-- Friends + feed (GDD §10). Additive. Friendship is one edge per pair (accepted counts
-- both ways); feed rows are per-account milestones that friends read + live toasts push.

CREATE TABLE IF NOT EXISTS friendships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uq ON friendships (requester_id, addressee_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships (requester_id, status);

CREATE TABLE IF NOT EXISTS feed (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  body       text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_account_at_idx ON feed (account_id, at);
