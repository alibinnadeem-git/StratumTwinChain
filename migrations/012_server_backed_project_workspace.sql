BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_progress_percent_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_progress_percent_check
  CHECK (progress_percent BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS projects_organization_status_idx
  ON projects(organization_id,status,name);

COMMENT ON COLUMN projects.progress_percent IS
  'Project-management progress only. It does not represent asset verification, DIR finality, PoVI finality, or physical truth.';

COMMIT;
