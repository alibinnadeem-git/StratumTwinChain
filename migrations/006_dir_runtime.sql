BEGIN;

-- Application-side DIR governance support.
-- Canonical PoVI consensus state (sv_chain_*) is intentionally NOT stored in the
-- STRATUM Spatial Verified application database. Validator A/B/C remain the
-- authority for chain state; this database stores tenant records, approvals and
-- finalized ledger references only.

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

COMMENT ON TABLE approval_policies IS
  'Tenant/project approval policy. Policy configuration never establishes physical truth or DIR finality by itself.';

COMMENT ON TABLE ledger_records IS
  'Application-side finalized DIR references. Canonical PoVI chain state and validator votes remain authoritative on the validator network.';

COMMIT;
