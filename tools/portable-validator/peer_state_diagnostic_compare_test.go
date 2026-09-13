package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func createDiagnosticBundleAt(t *testing.T, root, name string, when time.Time) (string, PeerStateDiagnosticManifest) {
	t.Helper()
	cfg := testPeerSyncConfig()
	dir := filepath.Join(root, name+"-validator")
	output := filepath.Join(root, name+"-diagnostic")
	if err := os.MkdirAll(filepath.Join(dir, "state"), 0o700); err != nil {
		t.Fatal(err)
	}
	head := defaultPeerSyncTrustedHead(cfg)
	if err := savePeerSyncTrustedHeadAtomic(filepath.Join(dir, "state", "peer-sync-head.json"), head); err != nil {
		t.Fatal(err)
	}
	manifest, err := exportPeerStateDiagnostics(dir, output, cfg, when.UTC())
	if err != nil {
		t.Fatal(err)
	}
	return output, manifest
}

func rewriteDiagnosticFileAndManifest(t *testing.T, bundle string, manifest PeerStateDiagnosticManifest, name string, data []byte) PeerStateDiagnosticManifest {
	t.Helper()
	for i := range manifest.Files {
		if manifest.Files[i].Name != name {
			continue
		}
		path := filepath.Join(bundle, manifest.Files[i].ExportPath)
		if err := os.WriteFile(path, data, 0o600); err != nil {
			t.Fatal(err)
		}
		digest := sha256.Sum256(data)
		manifest.Files[i].SizeBytes = int64(len(data))
		manifest.Files[i].SHA256 = hex.EncodeToString(digest[:])
		if err := writeJSON(filepath.Join(bundle, "manifest.json"), manifest, 0o600); err != nil {
			t.Fatal(err)
		}
		return manifest
	}
	t.Fatalf("diagnostic file not found in manifest: %s", name)
	return PeerStateDiagnosticManifest{}
}

func TestPeerStateDiagnosticCompareRequiresVerifiedBundles(t *testing.T) {
	root := t.TempDir()
	left, _ := createDiagnosticBundleAt(t, root, "left", time.Unix(1_800_000_000, 0))
	right, manifest := createDiagnosticBundleAt(t, root, "right", time.Unix(1_800_000_001, 0))
	entry := diagnosticFileByName(t, manifest, "trusted-head")
	if err := os.WriteFile(filepath.Join(right, entry.ExportPath), []byte("unmanifested change"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := comparePeerStateDiagnosticBundles(left, right); err == nil {
		t.Fatal("compare must reject a bundle that fails independent integrity verification")
	}
}

func TestPeerStateDiagnosticCompareReportsMetadataWithoutAuthority(t *testing.T) {
	root := t.TempDir()
	left, _ := createDiagnosticBundleAt(t, root, "left", time.Unix(1_800_000_000, 0))
	right, _ := createDiagnosticBundleAt(t, root, "right", time.Unix(1_800_000_100, 0))
	comparison, err := comparePeerStateDiagnosticBundles(left, right)
	if err != nil {
		t.Fatal(err)
	}
	if !comparison.LeftIntegrityVerified || !comparison.RightIntegrityVerified {
		t.Fatalf("expected both bundles to be independently verified: %+v", comparison)
	}
	if comparison.AuthenticityEstablished || comparison.ConsensusAuthority || comparison.CanonicalHistorySelection || comparison.RecoveryAuthority || comparison.MutationPerformed {
		t.Fatalf("comparison must remain non-authoritative and read-only: %+v", comparison)
	}
	if !comparison.ChainIDMatch || !comparison.ValidatorIDMatch || !comparison.CreatedAtChanged {
		t.Fatalf("unexpected context/timestamp comparison: %+v", comparison)
	}
	if comparison.HealthChanged || len(comparison.HealthChanges) != 0 || len(comparison.FileChanges) != 0 {
		t.Fatalf("identical state bytes should not produce health/file changes: %+v", comparison)
	}
}

func TestPeerStateDiagnosticCompareReportsFileHashChangeOnly(t *testing.T) {
	root := t.TempDir()
	left, _ := createDiagnosticBundleAt(t, root, "left", time.Unix(1_800_000_000, 0))
	right, rightManifest := createDiagnosticBundleAt(t, root, "right", time.Unix(1_800_000_001, 0))
	rewriteDiagnosticFileAndManifest(t, right, rightManifest, "trusted-head", []byte("internally consistent but different diagnostic bytes\n"))

	comparison, err := comparePeerStateDiagnosticBundles(left, right)
	if err != nil {
		t.Fatal(err)
	}
	if len(comparison.FileChanges) != 1 {
		t.Fatalf("expected one file change, got %+v", comparison.FileChanges)
	}
	change := comparison.FileChanges[0]
	if change.Name != "trusted-head" || change.ChangeType != "CHANGED" || !change.LeftPresent || !change.RightPresent || change.LeftSHA256 == change.RightSHA256 {
		t.Fatalf("unexpected trusted-head diagnostic delta: %+v", change)
	}
	if comparison.CanonicalHistorySelection || comparison.RecoveryAuthority {
		t.Fatal("a file delta must never become fork-choice or recovery authority")
	}
}

func TestPeerStateDiagnosticCompareReportsValidatorContextMismatch(t *testing.T) {
	root := t.TempDir()
	left, _ := createDiagnosticBundleAt(t, root, "left", time.Unix(1_800_000_000, 0))
	right, rightManifest := createDiagnosticBundleAt(t, root, "right", time.Unix(1_800_000_001, 0))
	rightManifest.ValidatorID = "different-validator-for-diagnostic-comparison"
	if err := writeJSON(filepath.Join(right, "manifest.json"), rightManifest, 0o600); err != nil {
		t.Fatal(err)
	}
	comparison, err := comparePeerStateDiagnosticBundles(left, right)
	if err != nil {
		t.Fatal(err)
	}
	if !comparison.ChainIDMatch || comparison.ValidatorIDMatch {
		t.Fatalf("expected validator context mismatch to be reported, got %+v", comparison)
	}
}

func TestPeerStateDiagnosticCompareDoesNotMutateBundles(t *testing.T) {
	root := t.TempDir()
	left, _ := createDiagnosticBundleAt(t, root, "left", time.Unix(1_800_000_000, 0))
	right, _ := createDiagnosticBundleAt(t, root, "right", time.Unix(1_800_000_001, 0))
	leftBefore, err := os.ReadFile(filepath.Join(left, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	rightBefore, err := os.ReadFile(filepath.Join(right, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := comparePeerStateDiagnosticBundles(left, right); err != nil {
		t.Fatal(err)
	}
	leftAfter, _ := os.ReadFile(filepath.Join(left, "manifest.json"))
	rightAfter, _ := os.ReadFile(filepath.Join(right, "manifest.json"))
	if string(leftBefore) != string(leftAfter) || string(rightBefore) != string(rightAfter) {
		t.Fatal("diagnostic comparison must not modify either source bundle")
	}
}
