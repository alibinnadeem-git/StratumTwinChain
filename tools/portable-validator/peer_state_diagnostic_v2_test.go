package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func createDiagnosticBundleV2ForTest(t *testing.T) (string, PeerStateDiagnosticManifest) {
	t.Helper()
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	dir := filepath.Join(root, "validator")
	output := filepath.Join(root, "diagnostic-v2")
	if err := os.MkdirAll(filepath.Join(dir, "state"), 0o700); err != nil {
		t.Fatal(err)
	}
	head := defaultPeerSyncTrustedHead(cfg)
	if err := savePeerSyncTrustedHeadAtomic(filepath.Join(dir, "state", "peer-sync-head.json"), head); err != nil {
		t.Fatal(err)
	}
	manifest, err := exportPeerStateDiagnosticsV2(dir, output, cfg, time.Unix(1_800_000_000, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	return output, manifest
}

func TestPeerStateDiagnosticV2ExportAndVerifyCanonicalDigest(t *testing.T) {
	bundle, manifest := createDiagnosticBundleV2ForTest(t)
	if manifest.ProfileVersion != peerStateDiagnosticExportProfileV2 || !isSHA256(manifest.BundleDigestSHA256) {
		t.Fatalf("unexpected version-2 manifest: %+v", manifest)
	}
	expected, err := peerStateDiagnosticBundleDigestV2(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if manifest.BundleDigestSHA256 != expected {
		t.Fatalf("bundle digest mismatch: got %s want %s", manifest.BundleDigestSHA256, expected)
	}
	verification, err := verifyPeerStateDiagnosticBundle(bundle)
	if err != nil {
		t.Fatal(err)
	}
	if !verification.IntegrityVerified || !verification.BundleDigestVerified || verification.BundleDigestSHA256 != manifest.BundleDigestSHA256 {
		t.Fatalf("version-2 digest was not verified: %+v", verification)
	}
	if verification.AuthenticityEstablished || verification.ConsensusAuthority {
		t.Fatalf("bundle digest must remain non-authenticating and non-consensus: %+v", verification)
	}
}

func TestPeerStateDiagnosticV1RemainsVerifiableWithoutBundleDigest(t *testing.T) {
	bundle, manifest := createDiagnosticBundleForVerification(t)
	if manifest.ProfileVersion != peerStateDiagnosticExportProfile || manifest.BundleDigestSHA256 != "" {
		t.Fatalf("version-1 export semantics changed unexpectedly: %+v", manifest)
	}
	verification, err := verifyPeerStateDiagnosticBundle(bundle)
	if err != nil {
		t.Fatal(err)
	}
	if !verification.IntegrityVerified || verification.BundleDigestVerified || verification.BundleDigestSHA256 != "" {
		t.Fatalf("version-1 compatibility verification failed: %+v", verification)
	}
}

func TestPeerStateDiagnosticV2RejectsManifestMetadataTampering(t *testing.T) {
	bundle, manifest := createDiagnosticBundleV2ForTest(t)
	manifest.CreatedAt = time.Unix(1_800_000_123, 0).UTC().Format(time.RFC3339Nano)
	if err := writeJSON(filepath.Join(bundle, "manifest.json"), manifest, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticBundle(bundle); err == nil {
		t.Fatal("version-2 verifier must reject manifest metadata changed without recomputing the bundle digest")
	}
}

func TestPeerStateDiagnosticV2DigestCanonicalizesFileAndHealthOrdering(t *testing.T) {
	_, manifest := createDiagnosticBundleV2ForTest(t)
	original, err := peerStateDiagnosticBundleDigestV2(manifest)
	if err != nil {
		t.Fatal(err)
	}
	for left, right := 0, len(manifest.Files)-1; left < right; left, right = left+1, right-1 {
		manifest.Files[left], manifest.Files[right] = manifest.Files[right], manifest.Files[left]
	}
	for left, right := 0, len(manifest.Health.Entries)-1; left < right; left, right = left+1, right-1 {
		manifest.Health.Entries[left], manifest.Health.Entries[right] = manifest.Health.Entries[right], manifest.Health.Entries[left]
	}
	reordered, err := peerStateDiagnosticBundleDigestV2(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if original != reordered {
		t.Fatalf("canonical digest changed under ordering-only permutation: %s != %s", original, reordered)
	}
}

func TestPeerStateDiagnosticV1RejectsInjectedV2DigestClaim(t *testing.T) {
	bundle, manifest := createDiagnosticBundleForVerification(t)
	manifest.BundleDigestSHA256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if err := writeJSON(filepath.Join(bundle, "manifest.json"), manifest, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticBundle(bundle); err == nil {
		t.Fatal("version-1 bundle must not be allowed to claim version-2 bundle-digest semantics")
	}
}
