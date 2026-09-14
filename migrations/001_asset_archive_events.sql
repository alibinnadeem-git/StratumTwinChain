BEGIN;

CREATE TABLE IF NOT EXISTS asset_archive_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('ARCHIVE', 'RESTORE')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_event_id uuid NULL REFERENCES asset_archive_events(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_archive_events_org_asset_time_idx
  ON asset_archive_events (organization_id, asset_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS asset_archive_events_asset_time_idx
  ON asset_archive_events (asset_id, occurred_at DESC, id DESC);

COMMENT ON TABLE asset_archive_events IS
  'Append-only administrative archive/restore history. It changes registry visibility only and never establishes or mutates Verified physical state, DIR/PoVI finality, evidence integrity, or validator authority.';

COMMENT ON COLUMN asset_archive_events.previous_event_id IS
  'Prior administrative archive-state event for audit continuity. This is not a PoVI parent, DIR link, or physical-truth assertion.';

CREATE OR REPLACE FUNCTION stratum_prevent_asset_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'STRATUM Assets are durable identities and cannot be physically deleted; append an ARCHIVE event instead';
END;
$$;

DROP TRIGGER IF EXISTS stratum_prevent_asset_physical_delete ON assets;
CREATE TRIGGER stratum_prevent_asset_physical_delete
BEFORE DELETE ON assets
FOR EACH ROW
EXECUTE FUNCTION stratum_prevent_asset_physical_delete();

COMMIT;
