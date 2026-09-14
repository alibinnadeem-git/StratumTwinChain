-- Typed human attestations v1.
-- These records are authenticated human evidence statements only.
-- They are not lifecycle approval, PoVI votes, DIR finality, validator authority, or physical truth.

CREATE TABLE IF NOT EXISTS human_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  asset_id uuid NOT NULL REFERENCES assets(id),
  lifecycle_event_id uuid NOT NULL REFERENCES lifecycle_events(id),
  attestation_type text NOT NULL CHECK (attestation_type IN (
    'WORK_PERFORMED',
    'INSPECTION_OBSERVATION',
    'SUPERVISOR_REVIEW',
    'CLIENT_ACKNOWLEDGEMENT',
    'ENGINEERING_REVIEW',
    'OEM_CONFORMANCE'
  )),
  attestor_capacity text NOT NULL CHECK (attestor_capacity IN (
    'TECHNICIAN',
    'INSPECTOR',
    'SUPERVISOR',
    'CLIENT_REP',
    'ENGINEER',
    'OEM_REP'
  )),
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 5 AND 2000),
  statement_sha256 char(64) NOT NULL CHECK (statement_sha256 ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  authentication_assurance text NOT NULL DEFAULT 'SESSION' CHECK (authentication_assurance IN ('SESSION','CRYPTOGRAPHIC_IDENTITY')),
  cryptographic_signature text,
  public_key_jwk jsonb,
  capacity_credential_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_attestation_signature_pair CHECK (
    (cryptographic_signature IS NULL AND public_key_jwk IS NULL)
    OR (cryptographic_signature IS NOT NULL AND public_key_jwk IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS human_attestations_asset_idx
  ON human_attestations(organization_id,asset_id,created_at DESC);
CREATE INDEX IF NOT EXISTS human_attestations_event_idx
  ON human_attestations(organization_id,lifecycle_event_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS human_attestations_idempotency_idx
  ON human_attestations(organization_id,lifecycle_event_id,actor_user_id,attestation_type,statement_sha256);

CREATE OR REPLACE FUNCTION reject_human_attestation_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'human_attestations is append-only; create a new attestation instead';
END;
$$;

DROP TRIGGER IF EXISTS human_attestations_no_update ON human_attestations;
CREATE TRIGGER human_attestations_no_update
BEFORE UPDATE ON human_attestations
FOR EACH ROW EXECUTE FUNCTION reject_human_attestation_mutation();

DROP TRIGGER IF EXISTS human_attestations_no_delete ON human_attestations;
CREATE TRIGGER human_attestations_no_delete
BEFORE DELETE ON human_attestations
FOR EACH ROW EXECUTE FUNCTION reject_human_attestation_mutation();

COMMENT ON TABLE human_attestations IS
'Append-only authenticated human evidence statements. No approval, PoVI vote, DIR finality, validator authority, or physical-truth authority is conferred by insertion.';
