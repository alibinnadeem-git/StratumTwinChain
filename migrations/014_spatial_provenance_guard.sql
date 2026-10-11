-- SCHEMA PROPOSAL ONLY: do not apply until Ali authorizes a controlled migration.
BEGIN;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS provenance_class text NOT NULL DEFAULT 'REAL';
ALTER TABLE spatial_compilations ADD COLUMN IF NOT EXISTS provenance_class text NOT NULL DEFAULT 'REAL';
ALTER TABLE spatial_project_sources ADD COLUMN IF NOT EXISTS provenance_class text NOT NULL DEFAULT 'REAL';
CREATE OR REPLACE FUNCTION stratum_provenance_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.provenance_class IS DISTINCT FROM 'REAL' THEN
  RAISE EXCEPTION 'DEMO cannot be persisted into REAL tables';
 END IF;
 IF TG_OP='UPDATE' AND NEW.provenance_class IS DISTINCT FROM OLD.provenance_class THEN
  RAISE EXCEPTION 'provenance_class is immutable';
 END IF;
 IF TG_TABLE_NAME='spatial_compilations' THEN
  IF NEW.graph_json->>'provenance_class'='DEMO' OR EXISTS(
   SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.graph_json->'entities','[]'::jsonb)) asset
   WHERE asset->>'provenance_class'='DEMO' OR asset->'meta'->>'provenance_class'='DEMO'
      OR asset->>'id' LIKE 'demo_%'
  ) THEN
   RAISE EXCEPTION 'DEMO or mixed twin cannot be written';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assets_provenance_guard ON assets;
CREATE TRIGGER assets_provenance_guard BEFORE INSERT OR UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION stratum_provenance_write_guard();
DROP TRIGGER IF EXISTS spatial_compilations_provenance_guard ON spatial_compilations;
CREATE TRIGGER spatial_compilations_provenance_guard BEFORE INSERT OR UPDATE ON spatial_compilations
FOR EACH ROW EXECUTE FUNCTION stratum_provenance_write_guard();
DROP TRIGGER IF EXISTS spatial_sources_provenance_guard ON spatial_project_sources;
CREATE TRIGGER spatial_sources_provenance_guard BEFORE INSERT OR UPDATE ON spatial_project_sources
FOR EACH ROW EXECUTE FUNCTION stratum_provenance_write_guard();
COMMIT;
