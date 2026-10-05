BEGIN;

CREATE TABLE IF NOT EXISTS telemetry_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  sensor_key text NOT NULL CHECK (char_length(btrim(sensor_key)) BETWEEN 1 AND 200),
  measurement text NOT NULL CHECK (char_length(btrim(measurement)) BETWEEN 1 AND 120),
  unit text NOT NULL CHECK (char_length(btrim(unit)) BETWEEN 1 AND 60),
  source_protocol text NOT NULL CHECK (source_protocol IN ('OPC_UA','MQTT','REST_WEBHOOK','BACNET_IP','MODBUS_TCP','SIMULATOR')),
  source_ref text,
  sampling_interval_ms integer CHECK (sampling_interval_ms IS NULL OR sampling_interval_ms > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,asset_id,sensor_key)
);

CREATE INDEX IF NOT EXISTS telemetry_points_asset_idx
  ON telemetry_points (organization_id,asset_id,sensor_key);

CREATE TABLE IF NOT EXISTS telemetry_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  point_id uuid NOT NULL REFERENCES telemetry_points(id) ON DELETE RESTRICT,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  value_json jsonb NOT NULL,
  quality text NOT NULL DEFAULT 'GOOD' CHECK (quality IN ('GOOD','UNCERTAIN','BAD')),
  source_protocol text NOT NULL CHECK (source_protocol IN ('OPC_UA','MQTT','REST_WEBHOOK','BACNET_IP','MODBUS_TCP','SIMULATOR')),
  source_ref text,
  truth_boundary text NOT NULL DEFAULT 'OBSERVED_OPERATIONAL_DATA_NOT_VERIFIED_PHYSICAL_TRUTH'
);

CREATE INDEX IF NOT EXISTS telemetry_readings_asset_time_idx
  ON telemetry_readings (organization_id,asset_id,observed_at DESC,received_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS telemetry_readings_point_time_idx
  ON telemetry_readings (organization_id,point_id,observed_at DESC,received_at DESC,id DESC);

CREATE OR REPLACE FUNCTION stratum_prevent_telemetry_reading_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'telemetry_readings are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS telemetry_readings_append_only ON telemetry_readings;
CREATE TRIGGER telemetry_readings_append_only
BEFORE UPDATE OR DELETE ON telemetry_readings
FOR EACH ROW EXECUTE FUNCTION stratum_prevent_telemetry_reading_mutation();

COMMENT ON TABLE telemetry_points IS
  'Tenant-scoped operational telemetry point registry bound to an existing STRATUM asset. Point registration does not establish Verified state or physical truth.';
COMMENT ON TABLE telemetry_readings IS
  'Append-only Observed operational measurements. Telemetry may inform status and maintenance but never silently overwrites Verified state, asset identity, DIR finality, or PoVI finality.';

COMMIT;
