CREATE TABLE IF NOT EXISTS user_password_setup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_via text NOT NULL CHECK (created_via IN ('BOOTSTRAP','SUPER_ADMIN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_setup_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_user_password_setup_tokens_user
  ON user_password_setup_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_password_setup_tokens_active
  ON user_password_setup_tokens(expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE user_password_setup_tokens IS
  'Short-lived one-time account provisioning tokens. Token plaintext is never stored. This table confers no infrastructure approval, DIR, PoVI, validator, or physical-truth authority.';
