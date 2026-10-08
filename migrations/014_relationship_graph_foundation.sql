BEGIN;

CREATE TABLE IF NOT EXISTS relationship_types (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  category text NOT NULL CHECK (category IN ('ELECTRICAL','MECHANICAL','OPERATIONAL','SPATIAL','CONTROL')),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 3 AND 500),
  impact_direction text NOT NULL DEFAULT 'NONE' CHECK (impact_direction IN ('FORWARD','REVERSE','NONE')),
  propagation_weight numeric(4,3) NOT NULL DEFAULT 0 CHECK (propagation_weight >= 0 AND propagation_weight <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO relationship_types(code,category,description,impact_direction,propagation_weight)
VALUES
  ('FEEDS','ELECTRICAL','Source asset delivers electrical power to target asset.','FORWARD',1.000),
  ('SUPPLIES','ELECTRICAL','Source asset provides an operational supply to target asset.','FORWARD',1.000),
  ('DISTRIBUTES','ELECTRICAL','Source asset distributes electrical power to target asset or distribution node.','FORWARD',0.950),
  ('DRIVES','MECHANICAL','Source asset directly drives target equipment.','FORWARD',0.950),
  ('SERVES','OPERATIONAL','Source asset directly serves target asset or system.','FORWARD',0.900),
  ('CONTROLS','CONTROL','Source asset controls target asset.','FORWARD',0.850),
  ('DEPENDS_ON','OPERATIONAL','Source asset depends on target asset; operational impact propagates from target to source.','REVERSE',0.900),
  ('BACKUP_FOR','ELECTRICAL','Source asset is a backup source for target asset. Backup relationships mitigate risk and do not automatically propagate failure in v1.','NONE',0.000),
  ('PROTECTS','ELECTRICAL','Source protective device protects target asset. Protection topology is retained but is not automatically treated as outage propagation in v1.','NONE',0.000),
  ('CONNECTED_TO','SPATIAL','Assets have an evidenced physical or logical connection without a proven operational impact direction.','NONE',0.000),
  ('LOCATED_IN','SPATIAL','Source asset is physically located in target spatial context.','NONE',0.000),
  ('MOUNTED_ON','SPATIAL','Source asset is physically mounted on target context.','NONE',0.000),
  ('ADJACENT_TO','SPATIAL','Source asset is adjacent to target context.','NONE',0.000)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS asset_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  source_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  target_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL REFERENCES relationship_types(code) ON DELETE RESTRICT,
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  discovery_authority text NOT NULL CHECK (discovery_authority IN (
    'SOURCE_DOCUMENT','SCHEDULE','DERIVED_CONNECTIVITY','HUMAN_REVIEW','IMPORT'
  )),
  candidate_sha256 text NOT NULL CHECK (candidate_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  truth_boundary text NOT NULL DEFAULT 'RELATIONSHIP_CANDIDATE_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED',
  CONSTRAINT asset_relationship_distinct_assets_ck CHECK (source_asset_id <> target_asset_id),
  UNIQUE (organization_id,candidate_sha256)
);

CREATE INDEX IF NOT EXISTS asset_relationships_source_idx
  ON asset_relationships (organization_id,project_id,source_asset_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS asset_relationships_target_idx
  ON asset_relationships (organization_id,project_id,target_asset_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS asset_relationships_type_idx
  ON asset_relationships (organization_id,project_id,relationship_type,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS relationship_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  relationship_id uuid NOT NULL REFERENCES asset_relationships(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES spatial_project_sources(id) ON DELETE RESTRICT,
  compilation_id uuid REFERENCES spatial_compilations(id) ON DELETE RESTRICT,
  evidence_id uuid REFERENCES evidence(id) ON DELETE RESTRICT,
  source_sha256 text CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[a-f0-9]{64}$'),
  source_file_name text CHECK (source_file_name IS NULL OR char_length(btrim(source_file_name)) BETWEEN 1 AND 500),
  sheet_reference text CHECK (sheet_reference IS NULL OR char_length(btrim(sheet_reference)) BETWEEN 1 AND 120),
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  region_geometry jsonb,
  extraction_method text NOT NULL CHECK (char_length(btrim(extraction_method)) BETWEEN 2 AND 120),
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  captured_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  truth_boundary text NOT NULL DEFAULT 'RELATIONSHIP_EVIDENCE_SUPPORTS_REVIEW_NOT_PHYSICAL_TRUTH_DIR_OR_POVI_FINALITY',
  CONSTRAINT relationship_evidence_provenance_ck CHECK (
    source_id IS NOT NULL OR compilation_id IS NOT NULL OR evidence_id IS NOT NULL OR source_sha256 IS NOT NULL
  ),
  UNIQUE (organization_id,evidence_sha256)
);

CREATE INDEX IF NOT EXISTS relationship_evidence_relationship_idx
  ON relationship_evidence (organization_id,project_id,relationship_id,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS relationship_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  relationship_id uuid NOT NULL REFERENCES asset_relationships(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('VERIFY','REJECT','DEPRECATE','MAINTAIN','REOPEN_REVIEW')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_review_id uuid REFERENCES relationship_review_events(id) ON DELETE RESTRICT,
  review_sha256 text NOT NULL CHECK (review_sha256 ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  truth_boundary text NOT NULL DEFAULT 'HUMAN_RELATIONSHIP_REVIEW_DOES_NOT_ESTABLISH_PHYSICAL_CONDITION_DIR_OR_POVI_FINALITY',
  UNIQUE (organization_id,review_sha256)
);

CREATE INDEX IF NOT EXISTS relationship_review_events_state_idx
  ON relationship_review_events (organization_id,project_id,relationship_id,occurred_at DESC,id DESC);

CREATE OR REPLACE FUNCTION stratum_validate_asset_relationship_context()
RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM projects
   WHERE id=NEW.project_id AND organization_id=NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'relationship project is outside the active organization'; END IF;

  PERFORM 1 FROM assets
   WHERE id=NEW.source_asset_id AND organization_id=NEW.organization_id AND project_id=NEW.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'relationship source asset is outside the organization/project'; END IF;

  PERFORM 1 FROM assets
   WHERE id=NEW.target_asset_id AND organization_id=NEW.organization_id AND project_id=NEW.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'relationship target asset is outside the organization/project'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS asset_relationship_context_guard ON asset_relationships;
CREATE TRIGGER asset_relationship_context_guard
BEFORE INSERT ON asset_relationships
FOR EACH ROW EXECUTE FUNCTION stratum_validate_asset_relationship_context();

CREATE OR REPLACE FUNCTION stratum_validate_relationship_evidence_context()
RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM asset_relationships
   WHERE id=NEW.relationship_id AND organization_id=NEW.organization_id AND project_id=NEW.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'relationship evidence is outside the relationship organization/project'; END IF;

  IF NEW.source_id IS NOT NULL THEN
    PERFORM 1 FROM spatial_project_sources
     WHERE id=NEW.source_id AND organization_id=NEW.organization_id AND project_id=NEW.project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'relationship source provenance is outside the organization/project'; END IF;
  END IF;

  IF NEW.compilation_id IS NOT NULL THEN
    PERFORM 1 FROM spatial_compilations
     WHERE id=NEW.compilation_id AND organization_id=NEW.organization_id AND project_id=NEW.project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'relationship compilation provenance is outside the organization/project'; END IF;
  END IF;

  IF NEW.evidence_id IS NOT NULL THEN
    PERFORM 1 FROM evidence e
    JOIN lifecycle_events le ON le.id=e.lifecycle_event_id
     WHERE e.id=NEW.evidence_id AND e.organization_id=NEW.organization_id AND le.project_id=NEW.project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'relationship field evidence is outside the organization/project'; END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS relationship_evidence_context_guard ON relationship_evidence;
CREATE TRIGGER relationship_evidence_context_guard
BEFORE INSERT ON relationship_evidence
FOR EACH ROW EXECUTE FUNCTION stratum_validate_relationship_evidence_context();

CREATE OR REPLACE FUNCTION stratum_validate_relationship_review_context()
RETURNS trigger AS $$
DECLARE
  latest_action text;
  latest_review_id uuid;
BEGIN
  PERFORM 1 FROM asset_relationships
   WHERE id=NEW.relationship_id
     AND organization_id=NEW.organization_id
     AND project_id=NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'relationship review is outside the relationship organization/project';
  END IF;

  SELECT id,action INTO latest_review_id,latest_action
  FROM relationship_review_events
  WHERE organization_id=NEW.organization_id
    AND project_id=NEW.project_id
    AND relationship_id=NEW.relationship_id
  ORDER BY occurred_at DESC,id DESC
  LIMIT 1;

  IF NEW.previous_review_id IS DISTINCT FROM latest_review_id THEN
    RAISE EXCEPTION 'relationship review must extend the latest append-only review state';
  END IF;

  IF latest_action IS NULL AND NEW.action NOT IN ('VERIFY','REJECT') THEN
    RAISE EXCEPTION 'initial relationship review must VERIFY or REJECT the candidate';
  ELSIF latest_action='VERIFY' AND NEW.action NOT IN ('MAINTAIN','DEPRECATE','REOPEN_REVIEW') THEN
    RAISE EXCEPTION 'invalid relationship review transition from VERIFY';
  ELSIF latest_action='MAINTAIN' AND NEW.action NOT IN ('MAINTAIN','DEPRECATE','REOPEN_REVIEW') THEN
    RAISE EXCEPTION 'invalid relationship review transition from MAINTAIN';
  ELSIF latest_action IN ('REJECT','DEPRECATE') AND NEW.action<>'REOPEN_REVIEW' THEN
    RAISE EXCEPTION 'rejected or deprecated relationships must be reopened before new verification';
  ELSIF latest_action='REOPEN_REVIEW' AND NEW.action NOT IN ('VERIFY','REJECT') THEN
    RAISE EXCEPTION 'reopened relationship review must VERIFY or REJECT the candidate';
  END IF;

  IF NEW.action IN ('VERIFY','MAINTAIN') THEN
    PERFORM 1 FROM relationship_evidence
     WHERE organization_id=NEW.organization_id
       AND project_id=NEW.project_id
       AND relationship_id=NEW.relationship_id
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'evidence is required before a relationship may become trusted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS relationship_review_context_guard ON relationship_review_events;
CREATE TRIGGER relationship_review_context_guard
BEFORE INSERT ON relationship_review_events
FOR EACH ROW EXECUTE FUNCTION stratum_validate_relationship_review_context();

CREATE OR REPLACE FUNCTION stratum_prevent_relationship_graph_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'relationship graph records are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS relationship_types_append_only ON relationship_types;
CREATE TRIGGER relationship_types_append_only
BEFORE UPDATE OR DELETE ON relationship_types
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_relationship_graph_mutation();

DROP TRIGGER IF EXISTS asset_relationships_append_only ON asset_relationships;
CREATE TRIGGER asset_relationships_append_only
BEFORE UPDATE OR DELETE ON asset_relationships
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_relationship_graph_mutation();

DROP TRIGGER IF EXISTS relationship_evidence_append_only ON relationship_evidence;
CREATE TRIGGER relationship_evidence_append_only
BEFORE UPDATE OR DELETE ON relationship_evidence
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_relationship_graph_mutation();

DROP TRIGGER IF EXISTS relationship_review_events_append_only ON relationship_review_events;
CREATE TRIGGER relationship_review_events_append_only
BEFORE UPDATE OR DELETE ON relationship_review_events
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_relationship_graph_mutation();

COMMENT ON TABLE relationship_types IS
  'Append-only controlled relationship vocabulary. Impact direction and propagation weight are immutable once published so trusted traversal semantics cannot silently change.';
COMMENT ON TABLE asset_relationships IS
  'Append-only tenant/project-scoped relationship candidates between durable STRATUM Assets. A candidate does not become operationally trusted until evidence-backed human review verifies it.';
COMMENT ON TABLE relationship_evidence IS
  'Append-only provenance supporting relationship review. Evidence supports a relationship assertion but does not independently establish physical condition, DIR finality, or PoVI finality.';
COMMENT ON TABLE relationship_review_events IS
  'Append-only authenticated human review events. Only latest VERIFY or MAINTAIN events make an edge eligible for trusted operational traversal; review does not establish physical condition, DIR finality, or PoVI finality.';

COMMIT;
