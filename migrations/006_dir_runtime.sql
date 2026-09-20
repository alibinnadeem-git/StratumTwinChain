BEGIN;

-- Canonical DIR runtime capability for STRATUM Spatial Verified.
-- This migration adds protocol/runtime structure only. It creates no finalized DIR,
-- validator vote, block, approval decision, asset, evidence or physical-truth claim.

CREATE UNIQUE INDEX IF NOT EXISTS approvals_one_decision_per_approver
  ON approvals(organization_id,lifecycle_event_id,approver_user_id);

CREATE TABLE IF NOT EXISTS approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Project verification policy',
  approvals_required integer NOT NULL DEFAULT 1 CHECK (approvals_required BETWEEN 1 AND 5),
  allowed_roles text[] NOT NULL DEFAULT ARRAY['INSPECTOR','PROJECT_MANAGER','ORG_ADMIN','SUPER_ADMIN']::text[],
  require_evidence boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS sv_chain_state (
  chain_id text PRIMARY KEY,
  height bigint NOT NULL DEFAULT 0 CHECK (height >= 0),
  latest_block_hash text NOT NULL,
  genesis_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sv_chain_transactions (
  chain_id text NOT NULL,
  tx_hash text NOT NULL,
  record_id text NOT NULL,
  organization_id text NOT NULL,
  project_id text NOT NULL,
  asset_id text NOT NULL,
  event_type text NOT NULL,
  evidence_hash text NOT NULL,
  payload_hash text,
  signer text NOT NULL,
  record_timestamp timestamptz NOT NULL,
  canonical_record jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('PROPOSED','FINALIZED','REJECTED')),
  block_height bigint,
  block_hash text,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id,tx_hash),
  UNIQUE (chain_id,record_id)
);
CREATE INDEX IF NOT EXISTS idx_sv_chain_tx_record ON sv_chain_transactions(chain_id,record_id);
CREATE INDEX IF NOT EXISTS idx_sv_chain_tx_evidence ON sv_chain_transactions(chain_id,evidence_hash);
CREATE INDEX IF NOT EXISTS idx_sv_chain_tx_asset ON sv_chain_transactions(chain_id,organization_id,asset_id,record_timestamp DESC);

CREATE TABLE IF NOT EXISTS sv_chain_votes (
  chain_id text NOT NULL,
  tx_hash text NOT NULL,
  validator_id text NOT NULL,
  validator_address text NOT NULL,
  signature text NOT NULL,
  public_key_b64 text NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id,tx_hash,validator_id),
  FOREIGN KEY (chain_id,tx_hash) REFERENCES sv_chain_transactions(chain_id,tx_hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sv_chain_blocks (
  chain_id text NOT NULL,
  height bigint NOT NULL CHECK (height >= 0),
  block_hash text NOT NULL,
  prev_hash text NOT NULL,
  tx_hash text NOT NULL,
  proposer_validator_id text NOT NULL,
  finalized_at timestamptz NOT NULL,
  votes_json jsonb NOT NULL,
  PRIMARY KEY (chain_id,height),
  UNIQUE (chain_id,block_hash),
  UNIQUE (chain_id,tx_hash),
  FOREIGN KEY (chain_id,tx_hash) REFERENCES sv_chain_transactions(chain_id,tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_sv_chain_blocks_hash ON sv_chain_blocks(chain_id,block_hash);

COMMENT ON TABLE approval_policies IS
  'Tenant/project approval policy. Policy configuration never establishes physical truth or DIR finality by itself.';
COMMENT ON TABLE sv_chain_transactions IS
  'DIR/PoVI transaction index. PROPOSED or FINALIZED status must come from the governed consensus/finality path and table insertion alone confers no authority.';
COMMENT ON TABLE sv_chain_votes IS
  'Validator vote evidence for the canonical DIR runtime. A stored vote is not sufficient finality outside the verified PoVI proof rules.';
COMMENT ON TABLE sv_chain_blocks IS
  'Finalized chain block index. Application code must not manufacture block rows as a substitute for verified PoVI finality.';
COMMENT ON TABLE sv_chain_state IS
  'Cached chain head/genesis index. Empty state is valid until a governed chain runtime establishes canonical state.';

COMMIT;
