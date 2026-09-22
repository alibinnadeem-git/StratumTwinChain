BEGIN;

CREATE TABLE IF NOT EXISTS coordination_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  compilation_id uuid NOT NULL REFERENCES spatial_compilations(id) ON DELETE RESTRICT,
  version text NOT NULL CHECK (char_length(btrim(version)) BETWEEN 1 AND 40),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  finding_count integer NOT NULL CHECK (finding_count >= 0),
  truth_boundary text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, compilation_id),
  UNIQUE (organization_id, project_id, payload_sha256)
);

CREATE INDEX IF NOT EXISTS coordination_snapshot_project_idx
  ON coordination_snapshots (organization_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coordination_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  snapshot_id uuid NOT NULL REFERENCES coordination_snapshots(id) ON DELETE RESTRICT,
  source_finding_id text NOT NULL CHECK (char_length(btrim(source_finding_id)) BETWEEN 1 AND 400),
  finding_type text NOT NULL CHECK (finding_type IN (
    'MISSING_SPATIAL_REPRESENTATION',
    'MODEL_CONFLICT',
    'RATING_CONFLICT',
    'LOCATION_CONFLICT',
    'SHEET_REVISION_CONFLICT',
    'SOURCE_REVISION_AMBIGUITY'
  )),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  detail text NOT NULL,
  entity_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  comparison jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  human_control_level text NOT NULL CHECK (human_control_level IN ('H2','H3')),
  truth_boundary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, source_finding_id)
);

CREATE INDEX IF NOT EXISTS coordination_findings_snapshot_idx
  ON coordination_findings (organization_id, snapshot_id, finding_type);

CREATE TABLE IF NOT EXISTS coordination_finding_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  finding_id uuid NOT NULL REFERENCES coordination_findings(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('ACKNOWLEDGE','DISMISS','REOPEN','ENGINEERING_REVIEW_REQUIRED')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coordination_finding_disposition_idx
  ON coordination_finding_dispositions (organization_id, finding_id, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS coordination_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  finding_id uuid NOT NULL REFERENCES coordination_findings(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN ('RFI','NCR','WORK_ORDER','CHANGE','ENGINEERING_REVIEW')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 500),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED')),
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coordination_action_request_idx
  ON coordination_action_requests (organization_id, project_id, finding_id, created_at DESC);

COMMENT ON TABLE coordination_snapshots IS
  'Append-only coordination analysis tied to a specific Spatial compilation. Findings are review candidates, not geometric clash proof, code compliance, or engineering approval.';
COMMENT ON TABLE coordination_findings IS
  'Cross-document coordination findings supported by explicit source evidence. No coordinate clash is asserted unless coordinate authority exists.';
COMMENT ON TABLE coordination_finding_dispositions IS
  'Append-only human review history for coordination findings. Dispositions do not rewrite source evidence.';
COMMENT ON TABLE coordination_action_requests IS
  'Governed requests to create downstream RFI/NCR/work/change/engineering-review actions. A request is not itself an approved downstream record.';

DROP TRIGGER IF EXISTS stratum_prevent_coordination_snapshot_update ON coordination_snapshots;
CREATE TRIGGER stratum_prevent_coordination_snapshot_update
BEFORE UPDATE OR DELETE ON coordination_snapshots
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_coordination_finding_update ON coordination_findings;
CREATE TRIGGER stratum_prevent_coordination_finding_update
BEFORE UPDATE OR DELETE ON coordination_findings
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_coordination_disposition_update ON coordination_finding_dispositions;
CREATE TRIGGER stratum_prevent_coordination_disposition_update
BEFORE UPDATE OR DELETE ON coordination_finding_dispositions
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_coordination_action_request_update ON coordination_action_requests;
CREATE TRIGGER stratum_prevent_coordination_action_request_update
BEFORE UPDATE OR DELETE ON coordination_action_requests
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

COMMIT;
