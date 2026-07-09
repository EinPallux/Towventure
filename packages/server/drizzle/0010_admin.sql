-- Live-ops admin (OPERATIONS §6, Phase 5). Additive. Moderation (bans with a reason
-- log), the broadcast banner, the content kill-switch state, and an audit trail of
-- every admin action. Admin identity is the accounts.flags->>'admin' flag plus the
-- ADMIN_IP_ALLOWLIST env (checked in the route guard); these tables hold the acts taken.

CREATE TABLE IF NOT EXISTS bans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  banned_by   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  lifted_at   timestamptz,
  lifted_by   uuid REFERENCES accounts(id) ON DELETE SET NULL
);
-- At most one active (un-lifted) ban per account; ban resolution reads this on every request.
CREATE UNIQUE INDEX IF NOT EXISTS bans_one_active_per_account ON bans (account_id) WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS bans_account_idx ON bans (account_id);

CREATE TABLE IF NOT EXISTS broadcasts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);
CREATE INDEX IF NOT EXISTS broadcasts_active_idx ON broadcasts (active, created_at DESC);

CREATE TABLE IF NOT EXISTS content_flags (
  item_id     text PRIMARY KEY,
  disabled    boolean NOT NULL DEFAULT true,
  reason      text,
  updated_by  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target      text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON admin_actions (created_at DESC);
