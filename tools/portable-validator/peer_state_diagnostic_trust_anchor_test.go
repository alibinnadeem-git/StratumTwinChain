package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func appendInitialDiagnosticTrustAnchorForTest(t *testing.T, journal string, cfg BootstrapConfig, effectiveAt, recordedAt time.Time) PeerStateDiagnosticTrustAnchorRecord {
	t.Helper()
	record, err := diagnosticTrustAnchorFromConfig(
		diagnosticTrustAnchorActionTrust,
		cfg,
		effectiveAt,
		recordedAt,
		"security-operator-a",
		"TRUSTED_CONFIG",
		"CHG-1001",
		"initial independently reviewed TRANSPORT identity",
	)
	if err != nil {
		t.Fatal(err)
	}
	if err := appendDiagnosticTrustAnchorRecord(journal, record); err != nil {
		t.Fatal(err)
	}
	records, err := loadDiagnosticTrustAnchorJournal(journal)
	if err != nil {
		t.Fatal(err)
	}
	return records[len(records)-1]
}

func rotateDiagnosticAttestedFixture(t *testing.T, dir string, original BootstrapConfig, bundleDir string, attestedAt time.Time) (BootstrapConfig, PeerStateDiagnosticAttestation) {
	t.Helper()
	cfg := original
	cfg.Keys = map[string]KeyRef{}
	for name, ref := range original.Keys {
		cfg.Keys[name] = ref
	}
	ref, err := generateLocalKey(dir, "TRANSPORT")
	if err != nil {
		t.Fatal(err)
	}
	ref.KeyVersion = original.Keys["TRANSPORT"].KeyVersion + 1
	cfg.Keys["TRANSPORT"] = ref
	cfg.CreatedAt = attestedAt.Add(-2 * time.Minute).UTC().Format(time.RFC3339Nano)
	if _, err := exportPeerStateDiagnosticsV2(dir, bundleDir, cfg, attestedAt.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	att, err := createPeerStateDiagnosticAttestation(dir, bundleDir, cfg, attestedAt)
	if err != nil {
		t.Fatal(err)
	}
	return cfg, att
}

func appendRotationDiagnosticTrustAnchorForTest(t *testing.T, journal string, cfg BootstrapConfig, effectiveAt, recordedAt time.Time) PeerStateDiagnosticTrustAnchorRecord {
	t.Helper()
	records, err := loadDiagnosticTrustAnchorJournal(journal)
	if err != nil {
		t.Fatal(err)
	}
	var current *PeerStateDiagnosticTrustAnchorRecord
	for i := range records {
		if records[i].ChainID == cfg.ChainID && records[i].ValidatorID == cfg.ValidatorID {
			current = &records[i]
		}
	}
	if current == nil {
		t.Fatal("missing prior trust anchor")
	}
	record, err := diagnosticTrustAnchorFromConfig(
		diagnosticTrustAnchorActionRotate,
		cfg,
		effectiveAt,
		recordedAt,
		"security-operator-b",
		"TRUSTED_CONFIG",
		"CHG-1002",
		"explicit TRANSPORT identity rotation",
	)
	if err != nil {
		t.Fatal(err)
	}
	record.SupersedesKeyVersion = current.KeyVersion
	record.SupersedesPublicKeyHash = current.PublicKeyHash
	if err := appendDiagnosticTrustAnchorRecord(journal, record); err != nil {
		t.Fatal(err)
	}
	updated, err := loadDiagnosticTrustAnchorJournal(journal)
	if err != nil {
		t.Fatal(err)
	}
	return updated[len(updated)-1]
}

func TestPeerStateDiagnosticTrustAnchorEstablishesAuthenticityWithoutPoVIAuthority(t *testing.T) {
	_, bundle, cfg, att := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	effective := time.Unix(1_799_999_900, 0).UTC()
	anchor := appendInitialDiagnosticTrustAnchorForTest(t, journal, cfg, effective, time.Unix(1_800_000_000, 0).UTC())
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)

	verification, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundle, attestationPath, journal, time.Unix(1_800_000_200, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if !verification.BundleIntegrityVerified || !verification.BundleDigestVerified || !verification.CryptographicSignatureValid || !verification.AuthenticityEstablished || !verification.TrustAnchorJournalUsed {
		t.Fatalf("expected independently anchored diagnostic authenticity: %+v", verification)
	}
	if verification.TrustedConfigUsed {
		t.Fatal("trust-anchor journal verification must remain distinct from legacy point-in-time --trusted-config verification")
	}
	if verification.TrustAnchorRecordSequence != anchor.Sequence || verification.TrustAnchorKeyVersion != anchor.KeyVersion {
		t.Fatalf("unexpected anchor provenance in result: %+v", verification)
	}
	if verification.ConsensusAuthority || verification.CanonicalHistorySelection || verification.RecoveryAuthority || verification.VoteAuthority || verification.ValidatorGovernanceAuthority || verification.ActivationAuthority || verification.PoVIFinalityEstablished || verification.PhysicalTruthEstablished || verification.MutationPerformed {
		t.Fatalf("diagnostic trust anchors must never acquire PoVI/governance/recovery/physical authority: %+v", verification)
	}
}

func TestPeerStateDiagnosticTrustAnchorRejectsSilentRotatedKey(t *testing.T) {
	dir, _, cfg, _ := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	appendInitialDiagnosticTrustAnchorForTest(t, journal, cfg, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())
	rotatedBundle := filepath.Join(filepath.Dir(dir), "diagnostic-v2-rotated")
	_, rotatedAtt := rotateDiagnosticAttestedFixture(t, dir, cfg, rotatedBundle, time.Unix(1_800_001_100, 0).UTC())
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation-rotated.json")
	writeDiagnosticAttestationForTest(t, attestationPath, rotatedAtt)

	if _, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(rotatedBundle, attestationPath, journal, time.Unix(1_800_001_200, 0).UTC()); err == nil {
		t.Fatal("a cryptographically valid rotated key must not become trusted without an explicit ROTATE journal record")
	}
}

func TestPeerStateDiagnosticTrustAnchorExplicitRotationAndHistoricalAudit(t *testing.T) {
	dir, bundleV1, cfgV1, attV1 := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	appendInitialDiagnosticTrustAnchorForTest(t, journal, cfgV1, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())

	bundleV2 := filepath.Join(filepath.Dir(dir), "diagnostic-v2-key-2")
	cfgV2, attV2 := rotateDiagnosticAttestedFixture(t, dir, cfgV1, bundleV2, time.Unix(1_800_001_100, 0).UTC())
	rotation := appendRotationDiagnosticTrustAnchorForTest(t, journal, cfgV2, time.Unix(1_800_001_000, 0).UTC(), time.Unix(1_800_000_900, 0).UTC())
	if rotation.KeyVersion != cfgV1.Keys["TRANSPORT"].KeyVersion+1 || rotation.SupersedesKeyVersion != cfgV1.Keys["TRANSPORT"].KeyVersion {
		t.Fatalf("rotation did not record explicit monotonic supersession: %+v", rotation)
	}

	attestationV2Path := filepath.Join(t.TempDir(), "diagnostic-attestation-key-2.json")
	writeDiagnosticAttestationForTest(t, attestationV2Path, attV2)
	if _, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundleV2, attestationV2Path, journal, time.Unix(1_800_001_200, 0).UTC()); err != nil {
		t.Fatalf("explicitly rotated key should verify after its effective time: %v", err)
	}

	attestationV1Path := filepath.Join(t.TempDir(), "diagnostic-attestation-key-1.json")
	writeDiagnosticAttestationForTest(t, attestationV1Path, attV1)
	if _, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundleV1, attestationV1Path, journal, time.Unix(1_800_001_200, 0).UTC()); err == nil {
		t.Fatal("superseded key must not silently authenticate under current-time trust evaluation")
	}
	if _, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundleV1, attestationV1Path, journal, time.Unix(1_800_000_500, 0).UTC()); err != nil {
		t.Fatalf("explicit historical audit time should resolve the then-effective anchor: %v", err)
	}
}

func TestPeerStateDiagnosticTrustAnchorRevocationFailsClosed(t *testing.T) {
	dir, _, cfgV1, _ := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	appendInitialDiagnosticTrustAnchorForTest(t, journal, cfgV1, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())
	bundleV2 := filepath.Join(filepath.Dir(dir), "diagnostic-v2-key-2")
	cfgV2, attV2 := rotateDiagnosticAttestedFixture(t, dir, cfgV1, bundleV2, time.Unix(1_800_001_100, 0).UTC())
	current := appendRotationDiagnosticTrustAnchorForTest(t, journal, cfgV2, time.Unix(1_800_001_000, 0).UTC(), time.Unix(1_800_000_900, 0).UTC())
	revoke := diagnosticTrustAnchorRevokeRecord(current, time.Unix(1_800_002_000, 0).UTC(), time.Unix(1_800_001_900, 0).UTC(), "security-operator-c", "SECURITY_CHANGE_CONTROL", "INC-2201", "TRANSPORT identity revoked")
	if err := appendDiagnosticTrustAnchorRecord(journal, revoke); err != nil {
		t.Fatal(err)
	}
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation-key-2.json")
	writeDiagnosticAttestationForTest(t, attestationPath, attV2)
	if _, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundleV2, attestationPath, journal, time.Unix(1_800_002_100, 0).UTC()); err == nil {
		t.Fatal("revoked diagnostic trust anchor must fail closed")
	}
}

func TestPeerStateDiagnosticTrustAnchorRejectsRotationVersionGapWithoutAppending(t *testing.T) {
	dir, _, cfgV1, _ := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	current := appendInitialDiagnosticTrustAnchorForTest(t, journal, cfgV1, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())
	before, err := os.ReadFile(journal)
	if err != nil {
		t.Fatal(err)
	}
	cfgBad := cfgV1
	cfgBad.Keys = map[string]KeyRef{}
	for name, ref := range cfgV1.Keys {
		cfgBad.Keys[name] = ref
	}
	newRef, err := generateLocalKey(dir, "TRANSPORT")
	if err != nil {
		t.Fatal(err)
	}
	newRef.KeyVersion = current.KeyVersion + 2
	cfgBad.Keys["TRANSPORT"] = newRef
	record, err := diagnosticTrustAnchorFromConfig(diagnosticTrustAnchorActionRotate, cfgBad, time.Unix(1_800_001_000, 0).UTC(), time.Unix(1_800_000_900, 0).UTC(), "operator", "TRUSTED_CONFIG", "CHG-gap", "invalid skipped key version")
	if err != nil {
		t.Fatal(err)
	}
	record.SupersedesKeyVersion = current.KeyVersion
	record.SupersedesPublicKeyHash = current.PublicKeyHash
	if err := appendDiagnosticTrustAnchorRecord(journal, record); err == nil {
		t.Fatal("rotation that skips a key version must fail closed")
	}
	after, err := os.ReadFile(journal)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("rejected rotation must not partially append to the trust-anchor journal")
	}
}

func TestPeerStateDiagnosticTrustAnchorJournalTamperingIsDetected(t *testing.T) {
	_, _, cfg, _ := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	appendInitialDiagnosticTrustAnchorForTest(t, journal, cfg, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())
	raw, err := os.ReadFile(journal)
	if err != nil {
		t.Fatal(err)
	}
	var record PeerStateDiagnosticTrustAnchorRecord
	if err := json.Unmarshal([]byte(strings.TrimSpace(string(raw))), &record); err != nil {
		t.Fatal(err)
	}
	record.ProvenanceRef = "TAMPERED"
	tampered, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(journal, append(tampered, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadDiagnosticTrustAnchorJournal(journal); err == nil {
		t.Fatal("hash-chained trust-anchor journal must reject tampered provenance")
	}
}

func TestPeerStateDiagnosticTrustAnchorJournalCannotBeNominatedByDownloadedBundle(t *testing.T) {
	_, bundle, cfg, att := createAttestedDiagnosticFixture(t)
	externalJournal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	appendInitialDiagnosticTrustAnchorForTest(t, externalJournal, cfg, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())
	raw, err := os.ReadFile(externalJournal)
	if err != nil {
		t.Fatal(err)
	}
	bundleJournal := filepath.Join(bundle, "self-nominated-trust-anchor.jsonl")
	if err := os.WriteFile(bundleJournal, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)
	if _, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundle, attestationPath, bundleJournal, time.Unix(1_800_000_200, 0).UTC()); err == nil {
		t.Fatal("downloaded diagnostic bundle must never nominate or contain its own trust anchor")
	}
}

func TestPeerStateDiagnosticTrustAnchorInspectionIsReadOnlyAndAuditable(t *testing.T) {
	_, _, cfg, _ := createAttestedDiagnosticFixture(t)
	journal := filepath.Join(t.TempDir(), "diagnostic-trust-anchors.jsonl")
	anchor := appendInitialDiagnosticTrustAnchorForTest(t, journal, cfg, time.Unix(1_799_999_900, 0).UTC(), time.Unix(1_800_000_000, 0).UTC())
	before, err := os.ReadFile(journal)
	if err != nil {
		t.Fatal(err)
	}
	inspection, err := inspectDiagnosticTrustAnchorJournal(journal, time.Unix(1_800_000_200, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(journal)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) || inspection.MutationPerformed {
		t.Fatal("trust-anchor inspection must be read-only")
	}
	if !inspection.JournalVerified || inspection.RecordCount != 1 || inspection.LastSequence != anchor.Sequence || len(inspection.EffectiveAnchors) != 1 || inspection.EffectiveAnchors[0].Status != "ACTIVE" {
		t.Fatalf("unexpected trust-anchor inspection: %+v", inspection)
	}
	if inspection.PoVIFinalityEstablished || inspection.CanonicalHistorySelection || inspection.RecoveryAuthority || inspection.ValidatorGovernanceAuthority || inspection.VoteAuthority || inspection.ActivationAuthority || inspection.PhysicalTruthEstablished {
		t.Fatalf("operator inspection must remain diagnostic-only: %+v", inspection)
	}
}
