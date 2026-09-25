BEGIN;

CREATE TABLE IF NOT EXISTS oem_cad_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  candidate_id text NOT NULL CHECK (char_length(btrim(candidate_id)) BETWEEN 1 AND 200),
  source_id text NOT NULL CHECK (char_length(btrim(source_id)) BETWEEN 1 AND 200),
  component_key text NOT NULL CHECK (char_length(btrim(component_key)) BETWEEN 1 AND 200),
  manufacturer_name text NOT NULL CHECK (char_length(btrim(manufacturer_name)) BETWEEN 1 AND 200),
  sku text NOT NULL CHECK (char_length(btrim(sku)) BETWEEN 1 AND 300),
  product_name text NOT NULL CHECK (char_length(btrim(product_name)) BETWEEN 1 AND 500),
  revision text,
  source_file_name text NOT NULL CHECK (char_length(btrim(source_file_name)) BETWEEN 1 AND 500),
  source_mime_type text NOT NULL CHECK (char_length(btrim(source_mime_type)) BETWEEN 1 AND 200),
  source_byte_size bigint NOT NULL CHECK (source_byte_size > 0),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_url text,
  reuse_terms text NOT NULL CHECK (char_length(btrim(reuse_terms)) BETWEEN 5 AND 4000),
  notes text,
  verification_status text NOT NULL DEFAULT 'FILE_VERIFIED' CHECK (verification_status IN ('FILE_VERIFIED')),
  truth_boundary text NOT NULL DEFAULT 'SOURCE_FILE_VERIFIED_NOT_GLb_APPROVED_NOT_INSTALLED_EQUIPMENT',
  verified_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,candidate_id,source_sha256)
);

CREATE INDEX IF NOT EXISTS oem_cad_verification_lookup_idx
  ON oem_cad_verifications (organization_id,candidate_id,verified_at DESC);

CREATE TABLE IF NOT EXISTS oem_cad_source_files (
  verification_id uuid PRIMARY KEY REFERENCES oem_cad_verifications(id) ON DELETE RESTRICT,
  content bytea NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE oem_cad_verifications IS
  'Append-only exact-SKU manufacturer CAD source verification. FILE_VERIFIED records prove the stored source bytes and metadata were reviewed; they do not approve browser GLB geometry, project installation identity, XYZ placement, engineering use, or DIR/PoVI state.';
COMMENT ON TABLE oem_cad_source_files IS
  'Immutable source CAD bytes linked one-to-one to an OEM CAD verification record. Storage does not confer redistribution rights or model activation approval.';

DROP TRIGGER IF EXISTS stratum_prevent_oem_cad_verification_update ON oem_cad_verifications;
CREATE TRIGGER stratum_prevent_oem_cad_verification_update
BEFORE UPDATE OR DELETE ON oem_cad_verifications
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_oem_cad_source_file_update ON oem_cad_source_files;
CREATE TRIGGER stratum_prevent_oem_cad_source_file_update
BEFORE UPDATE OR DELETE ON oem_cad_source_files
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

COMMIT;
