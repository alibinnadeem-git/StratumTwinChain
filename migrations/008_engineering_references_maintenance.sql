BEGIN;

CREATE TABLE IF NOT EXISTS engineering_applicability_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  reference_type text NOT NULL CHECK (reference_type IN ('CODE_STANDARD','ZONING','FIRE_LIFE_SAFETY','PROJECT_SPEC','OWNER_STANDARD','OEM_REQUIREMENT')),
  publisher text NOT NULL,
  reference_code text NOT NULL,
  title text NOT NULL,
  edition text,
  jurisdiction_label text,
  authority_class text NOT NULL CHECK (authority_class IN ('PUBLISHED_REFERENCE','AHJ_ADOPTED','CONTRACTUAL','OWNER_REQUIREMENT','OEM')),
  applicability_status text NOT NULL CHECK (applicability_status IN ('REFERENCE','APPLICABLE','SUPERSEDED','REVIEW_REQUIRED')),
  effective_date date,
  source_url text,
  source_sha256 text CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[a-f0-9]{64}$'),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engineering_applicability_project_idx
  ON engineering_applicability_records (organization_id,project_id,site_id,created_at DESC);

CREATE TABLE IF NOT EXISTS oem_reference_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE RESTRICT,
  manufacturer_name text NOT NULL,
  model_pattern text,
  document_type text NOT NULL CHECK (document_type IN ('DATASHEET','INSTALLATION','OPERATION','MAINTENANCE','SUBMITTAL','WARRANTY','OTHER')),
  title text NOT NULL,
  revision text,
  published_at date,
  source_url text,
  source_sha256 text CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[a-f0-9]{64}$'),
  authority_class text NOT NULL CHECK (authority_class IN ('OEM_PUBLISHED','PROJECT_SUBMITTAL','HISTORICAL_REFERENCE')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oem_reference_lookup_idx
  ON oem_reference_documents (organization_id,manufacturer_name,model_pattern,created_at DESC);

CREATE TABLE IF NOT EXISTS asset_maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  basis text NOT NULL CHECK (basis IN ('OEM','NFPA_70B','NECA','PROJECT_SPEC','OWNER_STANDARD','CONDITION_BASED','USER_DEFINED')),
  interval_days integer CHECK (interval_days IS NULL OR interval_days > 0),
  interval_hours integer CHECK (interval_hours IS NULL OR interval_hours > 0),
  next_due_at timestamptz,
  condition_triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  task_summary text NOT NULL CHECK (char_length(btrim(task_summary)) BETWEEN 3 AND 4000),
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('DRAFT','REVIEWED','ACTIVE','SUPERSEDED')),
  supersedes_plan_id uuid REFERENCES asset_maintenance_plans(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,asset_id,revision)
);
CREATE INDEX IF NOT EXISTS asset_maintenance_plan_idx
  ON asset_maintenance_plans (organization_id,asset_id,revision DESC);

COMMENT ON TABLE engineering_applicability_records IS
  'Append-only project/site reference applicability. Published references do not become project-applicable code until AHJ/contract/project authority is explicitly recorded.';
COMMENT ON TABLE oem_reference_documents IS
  'Append-only OEM/project document registry. Metadata points to source authority; STRATUM does not silently treat historical/reference material as project-approved submittal data.';
COMMENT ON TABLE asset_maintenance_plans IS
  'Versioned maintenance plans. ACTIVE/REVIEWED plan state is an operational governance record, not proof that maintenance was physically performed.';

DROP TRIGGER IF EXISTS stratum_prevent_engineering_applicability_update ON engineering_applicability_records;
CREATE TRIGGER stratum_prevent_engineering_applicability_update
BEFORE UPDATE OR DELETE ON engineering_applicability_records
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_oem_reference_update ON oem_reference_documents;
CREATE TRIGGER stratum_prevent_oem_reference_update
BEFORE UPDATE OR DELETE ON oem_reference_documents
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_maintenance_plan_update ON asset_maintenance_plans;
CREATE TRIGGER stratum_prevent_maintenance_plan_update
BEFORE UPDATE OR DELETE ON asset_maintenance_plans
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_spatial_compilation_mutation();

COMMIT;
