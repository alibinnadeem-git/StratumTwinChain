package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func createAttestedDiagnosticFixture(t *testing.T) (string, string, BootstrapConfig, PeerStateDiagnosticAttestation) {
	t.Helper()
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	dir := filepath.Join(root, "validator")
	bundle := filepath.Join(root, "diagnostic-v2")
	if err := os.MkdirAll(filepath.Join(dir, "keys", "private"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "state"), 0o700); err != nil {
		t.Fatal(err)
	}
	ref, err := generateLocalKey(dir, "TRANSPORT")
	if err != nil {
		t.Fatal(err)
	}
	cfg.Keys = map[string]KeyRef{"TRANSPORT": ref}
	head := defaultPeerSyncTrustedHead(cfg)
	if err := savePeerSyncTrustedHeadAtomic(filepath.Join(dir, "state", "peer-sync-head.json"), head); err != nil {
		t.Fatal(err)
	}
	if _, err := exportPeerStateDiagnosticsV2(dir, bundle, cfg, time.Unix(1_800_000_000, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	att, err := createPeerStateDiagnosticAttestation(dir, bundle, cfg, time.Unix(1_800_000_100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	return dir, bundle, cfg, att
}

func writeDiagnosticAttestationForTest(t *testing.T, path string, att PeerStateDiagnosticAttestation) {
	t.Helper()
	if err := writeJSON(path, att, 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestPeerStateDiagnosticAttestationSignatureValidWithoutAuthenticityClaim(t *testing.T) {
	_, bundle, _, att := createAttestedDiagnosticFixture(t)
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)
	verification, err := verifyPeerStateDiagnosticAttestation(bundle, attestationPath, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !verification.BundleIntegrityVerified || !verification.BundleDigestVerified || !verification.CryptographicSignatureValid {
		t.Fatalf("expected verified bundle and signature: %+v", verification)
	}
	if verification.TrustedConfigUsed || verification.AuthenticityEstablished {
		t.Fatalf("self-contained signature must not establish external authenticity: %+v", verification)
	}
	if verification.ConsensusAuthority || verification.CanonicalHistorySelection || verification.RecoveryAuthority || verification.VoteAuthority {
		t.Fatalf("diagnostic attestation must remain non-authoritative: %+v", verification)
	}
}

func TestPeerStateDiagnosticAttestationTrustedConfigEstablishesSignerAuthenticityOnly(t *testing.T) {
	_, bundle, cfg, att := createAttestedDiagnosticFixture(t)
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)
	verification, err := verifyPeerStateDiagnosticAttestation(bundle, attestationPath, &cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !verification.TrustedConfigUsed || !verification.AuthenticityEstablished || !verification.CryptographicSignatureValid {
		t.Fatalf("trusted config should establish signer authenticity: %+v", verification)
	}
	if verification.ConsensusAuthority || verification.CanonicalHistorySelection || verification.RecoveryAuthority || verification.VoteAuthority {
		t.Fatal("authenticated diagnostic signer identity must not become PoVI/recovery/activation authority")
	}
}

func TestPeerStateDiagnosticAttestationRejectsMismatchedTrustedConfig(t *testing.T) {
	_, bundle, cfg, att := createAttestedDiagnosticFixture(t)
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)
	cfg.FriendlyLabel = cfg.FriendlyLabel + "-changed"
	if _, err := verifyPeerStateDiagnosticAttestation(bundle, attestationPath, &cfg); err == nil {
		t.Fatal("attestation verifier must fail closed when independently trusted config does not match signed provenance context")
	}
}

func TestPeerStateDiagnosticAttestationRejectsTamperedSignature(t *testing.T) {
	_, bundle, _, att := createAttestedDiagnosticFixture(t)
	att.SignatureB64 = base64.StdEncoding.EncodeToString(make([]byte, 64))
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)
	if _, err := verifyPeerStateDiagnosticAttestation(bundle, attestationPath, nil); err == nil {
		t.Fatal("attestation verifier must reject an invalid detached signature")
	}
}

func TestPeerStateDiagnosticAttestationRejectsTamperedBundle(t *testing.T) {
	_, bundle, _, att := createAttestedDiagnosticFixture(t)
	attestationPath := filepath.Join(t.TempDir(), "diagnostic-attestation.json")
	writeDiagnosticAttestationForTest(t, attestationPath, att)
	var manifest PeerStateDiagnosticManifest
	if err := readJSON(filepath.Join(bundle, "manifest.json"), &manifest); err != nil {
		t.Fatal(err)
	}
	manifest.CreatedAt = time.Unix(1_800_000_999, 0).UTC().Format(time.RFC3339Nano)
	if err := writeJSON(filepath.Join(bundle, "manifest.json"), manifest, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticAttestation(bundle, attestationPath, nil); err == nil {
		t.Fatal("attestation verifier must reject a bundle whose version-2 digest no longer verifies")
	}
}

func TestPeerStateDiagnosticAttestationRequiresVersion2Bundle(t *testing.T) {
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	dir := filepath.Join(root, "validator")
	bundle := filepath.Join(root, "diagnostic-v1")
	if err := os.MkdirAll(filepath.Join(dir, "keys", "private"), 0o700); err != nil {
		t.Fatal(err)
	}
	ref, err := generateLocalKey(dir, "TRANSPORT")
	if err != nil {
		t.Fatal(err)
	}
	cfg.Keys = map[string]KeyRef{"TRANSPORT": ref}
	if _, err := exportPeerStateDiagnostics(dir, bundle, cfg, time.Unix(1_800_000_000, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	if _, err := createPeerStateDiagnosticAttestation(dir, bundle, cfg, time.Unix(1_800_000_100, 0).UTC()); err == nil {
		t.Fatal("detached attestation must require version-2 canonical bundle digest semantics")
	}
}

func TestPeerStateDiagnosticAttestationDoesNotEmbedPrivateKeyMaterialOrMutateBundle(t *testing.T) {
	dir, bundle, _, att := createAttestedDiagnosticFixture(t)
	manifestPath := filepath.Join(bundle, "manifest.json")
	before, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	privateBytes, err := os.ReadFile(filepath.Join(dir, "keys", "private", "transport.pk8"))
	if err != nil {
		t.Fatal(err)
	}
	encodedPrivate := base64.StdEncoding.EncodeToString(privateBytes)
	attBytes, err := jsonMarshalForTest(att)
	if err != nil {
		t.Fatal(err)
	}
	if string(attBytes) == "" || containsForTest(string(attBytes), encodedPrivate) {
		t.Fatal("detached attestation must not embed TRANSPORT private key material")
	}
	after, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("creating detached attestation must not mutate the diagnostic bundle")
	}
}

func jsonMarshalForTest(value any) ([]byte, error) {
	return json.Marshal(value)
}

func containsForTest(value, needle string) bool {
	return strings.Contains(value, needle)
}
