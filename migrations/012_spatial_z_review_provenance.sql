BEGIN;

CREATE TABLE IF NOT EXISTS spatial_z_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  compilation_id uuid NOT NULL REFERENCES spatial_compilations(id) ON DELETE RESTRICT,
  entity_id text NOT NULL CHECK (char_length(btrim(entity_id)) BETWEEN 1 AND 300),
  action text NOT NULL CHECK (action IN ('ACCEPT_DESIGN_CHAIN','CLEAR_DESIGN_CHAIN')),
  candidate_id text,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  graph_sha256 text NOT NULL CHECK (graph_sha256 ~ '^[a-f0-9]{64}$'),
  decision_sha256 text NOT NULL CHECK (decision_sha256 ~ '^[a-f0-9]{64}$'),
  candidate_snapshot jsonb,
  conflict_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_decision_id uuid REFERENCES spatial_z_review_decisions(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  truth_boundary text NOT NULL DEFAULT 'HUMAN_REVIEWED_DESIGN_PLACEMENT_NOT_PHYSICAL_TRUTH_NOT_DIR_NOT_POVI',
  CONSTRAINT spatial_z_review_candidate_action_ck CHECK (
    (action='ACCEPT_DESIGN_CHAIN' AND candidate_id IS NOT NULL AND candidate_snapshot IS NOT NULL)
    OR
    (action='CLEAR_DESIGN_CHAIN' AND candidate_id IS NULL)
  ),
  UNIQUE (organization_id, decision_sha256)
);

CREATE INDEX IF NOT EXISTS spatial_z_review_decisions_lookup_idx
  ON spatial_z_review_decisions (organization_id, project_id, entity_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS spatial_z_review_decisions_compilation_idx
  ON spatial_z_review_decisions (organization_id, compilation_id, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION stratum_prevent_spatial_z_review_decision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS 'BEGIN
  RAISE EXCEPTION ''spatial_z_review_decisions are append-only'';
END';

DROP TRIGGER IF EXISTS spatial_z_review_decisions_append_only ON spatial_z_review_decisions;
CREATE TRIGGER spatial_z_review_decisions_append_only
BEFORE UPDATE OR DELETE ON spatial_z_review_decisions
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_z_review_decision_mutation();

COMMENT ON TABLE spatial_z_review_decisions IS
  'Append-only authenticated review events selecting or clearing a design/source Z evidence chain. These decisions do not establish physical elevation, as-built truth, DIR finality, or PoVI finality.';

COMMIT;
