BEGIN;

-- STRATUM Spatial Verified baseline relational schema.
-- This migration creates only structural capability. It intentionally creates no
-- tenant, user, project, asset, evidence, Verified-state, DIR, or PoVI records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (char_length(btrim(email)) BETWEEN 3 AND 320),
  display_name text,
  password_hash text,
  is_active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 1 CHECK (session_version >= 1),
  last_login_at timestamptz,
  last_password_change_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN (
    'SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','CLIENT','INSPECTOR','VIEWER'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_code text NOT NULL CHECK (char_length(btrim(project_code)) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,project_code)
);
CREATE INDEX IF NOT EXISTS projects_organization_idx ON projects(organization_id);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  location_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sites_org_project_idx ON sites(organization_id,project_id);

CREATE TABLE IF NOT EXISTS systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES projects(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS systems_org_idx ON systems(organization_id);

CREATE TABLE IF NOT EXISTS manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  system_id uuid REFERENCES systems(id) ON DELETE RESTRICT,
  manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE RESTRICT,
  asset_code text NOT NULL CHECK (char_length(btrim(asset_code)) BETWEEN 2 AND 80),
  asset_type text NOT NULL CHECK (char_length(btrim(asset_type)) BETWEEN 2 AND 80),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  model text,
  serial_number text,
  location_label text,
  status text NOT NULL DEFAULT 'REGISTERED',
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz,
  commissioned_at timestamptz,
  warranty_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,asset_code),
  UNIQUE (qr_token)
);
CREATE INDEX IF NOT EXISTS assets_org_project_idx ON assets(organization_id,project_id);
CREATE INDEX IF NOT EXISTS assets_org_site_idx ON assets(organization_id,site_id);
CREATE INDEX IF NOT EXISTS assets_serial_idx ON assets(organization_id,serial_number) WHERE serial_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES assets(id) ON DELETE RESTRICT,
  work_order_code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,work_order_code)
);

CREATE TABLE IF NOT EXISTS lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','VERIFIED','REJECTED','FINALIZED','PLANNED')),
  performed_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  canonical_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_package_sha256 text CHECK (evidence_package_sha256 IS NULL OR evidence_package_sha256 ~ '^[a-f0-9]{64}$'),
  signer_address text,
  ledger_network text,
  ledger_tx_hash text,
  ledger_block_height bigint,
  anchored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lifecycle_events_asset_time_idx
  ON lifecycle_events(organization_id,asset_id,occurred_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS lifecycle_events_project_idx
  ON lifecycle_events(organization_id,project_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  lifecycle_event_id uuid NOT NULL REFERENCES lifecycle_events(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (char_length(btrim(kind)) >= 1),
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) >= 1),
  mime_type text,
  storage_uri text,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE','CLIENT','PUBLIC')),
  captured_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_event_idx ON evidence(organization_id,lifecycle_event_id);
CREATE INDEX IF NOT EXISTS evidence_asset_idx ON evidence(organization_id,asset_id,captured_at DESC);
CREATE INDEX IF NOT EXISTS evidence_sha_idx ON evidence(organization_id,sha256);

CREATE TABLE IF NOT EXISTS evidence_files (
  evidence_id uuid PRIMARY KEY REFERENCES evidence(id) ON DELETE CASCADE,
  content bytea NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  lifecycle_event_id uuid NOT NULL REFERENCES lifecycle_events(id) ON DELETE RESTRICT,
  approver_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  comment text,
  signature text NOT NULL,
  public_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approvals_event_idx ON approvals(organization_id,lifecycle_event_id,created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  lifecycle_event_id uuid NOT NULL REFERENCES lifecycle_events(id) ON DELETE RESTRICT,
  network text NOT NULL,
  record_id text NOT NULL,
  tx_hash text NOT NULL,
  block_height bigint NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  signer_address text NOT NULL,
  anchored_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,lifecycle_event_id)
);

COMMENT ON TABLE organizations IS
  'Tenant identity. Schema existence or tenant creation does not establish Verified infrastructure truth.';
COMMENT ON TABLE assets IS
  'Durable tenant-scoped infrastructure registry identities. Registration alone is not physical verification.';
COMMENT ON TABLE lifecycle_events IS
  'Lifecycle evidence candidates and governed outcomes. Only explicit approval/finality workflows may advance trust state.';
COMMENT ON TABLE ledger_records IS
  'Anchoring receipts. Cryptographic anchoring does not independently establish physical truth.';

COMMIT;
