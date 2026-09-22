BEGIN;

CREATE TABLE IF NOT EXISTS power_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  compilation_id uuid NOT NULL REFERENCES spatial_compilations(id) ON DELETE RESTRICT,
  version text NOT NULL CHECK (char_length(btrim(version)) BETWEEN 1 AND 40),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  requirement_count integer NOT NULL CHECK (requirement_count >= 0),
  finding_count integer NOT NULL CHECK (finding_count >= 0),
  truth_boundary text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, compilation_id),
  UNIQUE (organization_id, project_id, payload_sha256)
);

CREATE INDEX IF NOT EXISTS power_intelligence_snapshot_project_idx
  ON power_intelligence_snapshots (organization_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS expected_power_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  snapshot_id uuid NOT NULL REFERENCES power_intelligence_snapshots(id) ON DELETE RESTRICT,
  source_entity_id text NOT NULL CHECK (char_length(btrim(source_entity_id)) BETWEEN 1 AND 300),
  source_name text NOT NULL CHECK (char_length(btrim(source_name)) BETWEEN 1 AND 300),
  source_discipline text NOT NULL CHECK (char_length(btrim(source_discipline)) BETWEEN 1 AND 120),
  equipment_class text NOT NULL CHECK (char_length(btrim(equipment_class)) BETWEEN 1 AND 120),
  asset_tag text,
  status text NOT NULL CHECK (status IN ('EXPECTED','MATCHED','MISSING','CONFLICTED','REVIEWED','DISMISSED')),
  authority_class text NOT NULL CHECK (authority_class IN ('SOURCE_EXPLICIT','OEM_OR_PROJECT_METADATA','CLASS_EXPECTATION')),
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  electrical_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_electrical_entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  truth_boundary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, source_entity_id)
);

CREATE INDEX IF NOT EXISTS expected_power_snapshot_idx
  ON expected_power_requirements (organization_id, snapshot_id, status);

CREATE TABLE IF NOT EXISTS power_gap_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  snapshot_id uuid NOT NULL REFERENCES power_intelligence_snapshots(id) ON DELETE RESTRICT,
  expected_power_requirement_id uuid NOT NULL REFERENCES expected_power_requirements(id) ON DELETE RESTRICT,
  source_finding_id text NOT NULL CHECK (char_length(btrim(source_finding_id)) BETWEEN 1 AND 300),
  finding_type text NOT NULL CHECK (finding_type IN ('MISSING_FEED','RATING_MISMATCH','VOLTAGE_PHASE_MISMATCH','EMERGENCY_POWER_REVIEW','CONTROL_POWER_MISSING','DISCONNECT_REVIEW')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  detail text NOT NULL,
  electrical_entity_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  human_control_level text NOT NULL CHECK (human_control_level IN ('H2','H3')),
  truth_boundary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, source_finding_id)
);

CREATE INDEX IF NOT EXISTS power_gap_findings_snapshot_idx
  ON power_gap_findings (organization_id, snapshot_id, finding_type);

CREATE TABLE IF NOT EXISTS power_finding_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  finding_id uuid NOT NULL REFERENCES power_gap_findings(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('ACKNOWLEDGE','DISMISS','REOPEN','ENGINEERING_REVIEW_REQUIRED')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS power_finding_disposition_idx
  ON power_finding_dispositions (organization_id, finding_id, occurred_at DESC, id DESC);

COMMENT ON TABLE power_intelligence_snapshots IS
  'Append-only Expected Power analysis attached to a source-grounded Spatial compilation. It is advisory engineering review data, not a load-study approval, code-compliance determination, Verified state, DIR finality, or PoVI finality.';

COMMENT ON TABLE expected_power_requirements IS
  'Normalized powered-equipment expectations derived from project/OEM/source evidence and explicit bounded inference. Requirements remain reviewable and do not establish physical truth.';

COMMENT ON TABLE power_gap_findings IS
  'Append-only coordination findings such as missing feeds or voltage/phase conflicts. A finding is not itself an engineering approval or AHJ determination.';

COMMENT ON TABLE power_finding_dispositions IS
  'Append-only human disposition history for Expected Power findings. Disposition changes review workflow only and never rewrites source evidence.';

DROP TRIGGER IF EXISTS stratum_prevent_power_snapshot_update ON power_intelligence_snapshots;
CREATE TRIGGER stratum_prevent_power_snapshot_update
BEFORE UPDATE OR DELETE ON power_intelligence_snapshots
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_expected_power_update ON expected_power_requirements;
CREATE TRIGGER stratum_prevent_expected_power_update
BEFORE UPDATE OR DELETE ON expected_power_requirements
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_power_finding_update ON power_gap_findings;
CREATE TRIGGER stratum_prevent_power_finding_update
BEFORE UPDATE OR DELETE ON power_gap_findings
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_power_disposition_update ON power_finding_dispositions;
CREATE TRIGGER stratum_prevent_power_disposition_update
BEFORE UPDATE OR DELETE ON power_finding_dispositions
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

COMMIT;
