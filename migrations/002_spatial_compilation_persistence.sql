BEGIN;

CREATE TABLE IF NOT EXISTS spatial_compilations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  graph_sha256 text NOT NULL CHECK (graph_sha256 ~ '^[a-f0-9]{64}$'),
  graph_version text NOT NULL,
  source_count integer NOT NULL CHECK (source_count >= 0),
  entity_count integer NOT NULL CHECK (entity_count >= 0),
  link_count integer NOT NULL CHECK (link_count >= 0),
  source_sha256s jsonb NOT NULL DEFAULT '[]'::jsonb,
  graph_json jsonb NOT NULL,
  supersedes_compilation_id uuid NULL REFERENCES spatial_compilations(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, revision),
  UNIQUE (organization_id, project_id, graph_sha256)
);

CREATE INDEX IF NOT EXISTS spatial_compilations_project_revision_idx
  ON spatial_compilations (organization_id, project_id, revision DESC);

CREATE TABLE IF NOT EXISTS spatial_compilation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  compilation_id uuid NOT NULL REFERENCES spatial_compilations(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('ACCEPT_REVIEW_BASELINE', 'REOPEN_REVIEW')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_review_id uuid NULL REFERENCES spatial_compilation_reviews(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spatial_compilation_reviews_state_idx
  ON spatial_compilation_reviews (organization_id, compilation_id, occurred_at DESC, id DESC);

COMMENT ON TABLE spatial_compilations IS
  'Append-only server snapshots of source-grounded STRATUM Spatial Compiler output. A stored compilation is a review artifact, not Verified infrastructure state and not a DIR or PoVI finality assertion.';

COMMENT ON COLUMN spatial_compilations.graph_sha256 IS
  'Deterministic server-side hash of the submitted compilation payload for idempotency and provenance only; hash integrity does not establish physical truth.';

COMMENT ON TABLE spatial_compilation_reviews IS
  'Append-only human review state for a Spatial compilation. ACCEPT_REVIEW_BASELINE permits downstream Spatial use only; it does not create STRATUM Assets, approve lifecycle evidence, finalize a DIR, or establish PoVI/physical truth.';

CREATE OR REPLACE FUNCTION stratum_prevent_spatial_compilation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Spatial compilation snapshots are append-only; save a new revision instead';
END;
$$;

DROP TRIGGER IF EXISTS stratum_prevent_spatial_compilation_update ON spatial_compilations;
CREATE TRIGGER stratum_prevent_spatial_compilation_update
BEFORE UPDATE OR DELETE ON spatial_compilations
FOR EACH ROW
EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_spatial_review_update ON spatial_compilation_reviews;
CREATE TRIGGER stratum_prevent_spatial_review_update
BEFORE UPDATE OR DELETE ON spatial_compilation_reviews
FOR EACH ROW
EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

COMMIT;
