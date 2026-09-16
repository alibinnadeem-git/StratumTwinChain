BEGIN;

CREATE OR REPLACE FUNCTION stratum_prevent_asset_archive_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS '
BEGIN
  RAISE EXCEPTION ''STRATUM asset archive history is append-only; append a new ARCHIVE or RESTORE event instead'';
END;
';

DROP TRIGGER IF EXISTS stratum_prevent_asset_archive_event_update ON asset_archive_events;
CREATE TRIGGER stratum_prevent_asset_archive_event_update
BEFORE UPDATE ON asset_archive_events
FOR EACH ROW
EXECUTE FUNCTION stratum_prevent_asset_archive_event_mutation();

DROP TRIGGER IF EXISTS stratum_prevent_asset_archive_event_delete ON asset_archive_events;
CREATE TRIGGER stratum_prevent_asset_archive_event_delete
BEFORE DELETE ON asset_archive_events
FOR EACH ROW
EXECUTE FUNCTION stratum_prevent_asset_archive_event_mutation();

COMMENT ON FUNCTION stratum_prevent_asset_archive_event_mutation() IS
  'Enforces append-only administrative archive/restore history. This protection grants no Verified-state, DIR, PoVI, validator, evidence, or physical-truth authority.';

COMMIT;
