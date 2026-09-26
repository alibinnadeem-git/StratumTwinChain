BEGIN;

CREATE TABLE IF NOT EXISTS spatial_project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 500),
  extension text NOT NULL CHECK (char_length(btrim(extension)) BETWEEN 1 AND 20),
  mime_type text NOT NULL CHECK (char_length(btrim(mime_type)) BETWEEN 1 AND 200),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 262144000),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  truth_boundary text NOT NULL DEFAULT 'SOURCE_BYTES_PRESERVED_FOR_PROJECT_RECOVERY_NOT_VERIFIED_INFRASTRUCTURE_STATE',
  UNIQUE (organization_id, project_id, sha256)
);

CREATE INDEX IF NOT EXISTS spatial_project_sources_lookup_idx
  ON spatial_project_sources (organization_id, project_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS spatial_project_source_chunks (
  source_id uuid NOT NULL REFERENCES spatial_project_sources(id) ON DELETE RESTRICT,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  chunk_sha256 text NOT NULL CHECK (chunk_sha256 ~ '^[a-f0-9]{64}$'),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 2097152),
  content bytea NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS spatial_project_source_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL UNIQUE REFERENCES spatial_project_sources(id) ON DELETE RESTRICT,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 262144000),
  chunk_count integer NOT NULL CHECK (chunk_count > 0),
  verified_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  truth_boundary text NOT NULL DEFAULT 'HASH_VERIFIED_SOURCE_BYTES_DO_NOT_ESTABLISH_PHYSICAL_TRUTH_ASSET_IDENTITY_DIR_OR_POVI_FINALITY'
);

CREATE INDEX IF NOT EXISTS spatial_project_source_verifications_project_idx
  ON spatial_project_source_verifications (organization_id, project_id, verified_at DESC, id DESC);

COMMENT ON TABLE spatial_project_sources IS
  'Tenant/project-scoped original engineering source manifests for durable Spatial recovery. A source manifest is provenance and recovery context only; it does not create a STRATUM Asset, establish installed condition, approve engineering use, finalize a DIR, or establish PoVI/physical truth.';

COMMENT ON TABLE spatial_project_source_chunks IS
  'Chunked private source bytes for serverless-safe upload. Chunks may be replaced only before final source verification; verified source bytes become immutable.';

COMMENT ON TABLE spatial_project_source_verifications IS
  'Append-only server verification of the exact source byte stream and SHA-256. Hash agreement proves byte integrity only, not engineering correctness or physical truth.';

DROP TRIGGER IF EXISTS stratum_prevent_spatial_project_source_update ON spatial_project_sources;
CREATE TRIGGER stratum_prevent_spatial_project_source_update
BEFORE UPDATE OR DELETE ON spatial_project_sources
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_spatial_project_source_verification_update ON spatial_project_source_verifications;
CREATE TRIGGER stratum_prevent_spatial_project_source_verification_update
BEFORE UPDATE OR DELETE ON spatial_project_source_verifications
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

CREATE OR REPLACE FUNCTION stratum_protect_spatial_project_source_chunk_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS '
BEGIN
  IF EXISTS (
    SELECT 1
    FROM spatial_project_source_verifications
    WHERE source_id = OLD.source_id
  ) THEN
    RAISE EXCEPTION ''Verified Spatial project source chunks are immutable'';
  END IF;
  RETURN NEW;
END;
';

DROP TRIGGER IF EXISTS stratum_protect_spatial_project_source_chunk_update ON spatial_project_source_chunks;
CREATE TRIGGER stratum_protect_spatial_project_source_chunk_update
BEFORE UPDATE OR DELETE ON spatial_project_source_chunks
FOR EACH ROW EXECUTE FUNCTION stratum_protect_spatial_project_source_chunk_mutation();

COMMIT;
