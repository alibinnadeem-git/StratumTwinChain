package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func createDiagnosticBundleForVerification(t *testing.T) (string, PeerStateDiagnosticManifest) {
	t.Helper()
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	dir := filepath.Join(root, "validator")
	output := filepath.Join(root, "diagnostic")
	if err := os.MkdirAll(filepath.Join(dir, "state"), 0o700); err != nil {
		t.Fatal(err)
	}
	head := defaultPeerSyncTrustedHead(cfg)
	if err := savePeerSyncTrustedHeadAtomic(filepath.Join(dir, "state", "peer-sync-head.json"), head); err != nil {
		t.Fatal(err)
	}
	manifest, err := exportPeerStateDiagnostics(dir, output, cfg, time.Unix(1_800_000_000, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	return output, manifest
}

func TestPeerStateDiagnosticVerifyValidBundleIntegrityOnly(t *testing.T) {
	bundle, manifest := createDiagnosticBundleForVerification(t)
	verification, err := verifyPeerStateDiagnosticBundle(bundle)
	if err != nil {
		t.Fatal(err)
	}
	if !verification.IntegrityVerified || verification.AuthenticityEstablished || verification.ConsensusAuthority {
		t.Fatalf("unexpected verification authority semantics: %+v", verification)
	}
	if verification.BundleProfileVersion != peerStateDiagnosticExportProfile || verification.ChainID != manifest.ChainID || verification.ValidatorID != manifest.ValidatorID || verification.FileCount != len(manifest.Files) {
		t.Fatalf("unexpected verification metadata: %+v", verification)
	}
}

func TestPeerStateDiagnosticVerifyRejectsTamperedFile(t *testing.T) {
	bundle, manifest := createDiagnosticBundleForVerification(t)
	entry := diagnosticFileByName(t, manifest, "trusted-head")
	path := filepath.Join(bundle, entry.ExportPath)
	if err := os.WriteFile(path, []byte("tampered"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticBundle(bundle); err == nil {
		t.Fatal("diagnostic verifier must reject changed file bytes")
	}
}

func TestPeerStateDiagnosticVerifyRejectsUnexpectedOrPrivateKeyPath(t *testing.T) {
	bundle, _ := createDiagnosticBundleForVerification(t)
	keysDir := filepath.Join(bundle, "keys", "private")
	if err := os.MkdirAll(keysDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(keysDir, "transport.pk8"), []byte("forbidden"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticBundle(bundle); err == nil {
		t.Fatal("diagnostic verifier must reject bundles containing private-key paths")
	}
}

func TestPeerStateDiagnosticVerifyRejectsManifestAuthorityEscalation(t *testing.T) {
	bundle, manifest := createDiagnosticBundleForVerification(t)
	manifest.ConsensusAuthority = true
	if err := writeJSON(filepath.Join(bundle, "manifest.json"), manifest, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticBundle(bundle); err == nil {
		t.Fatal("diagnostic verifier must reject a manifest claiming consensus authority")
	}
}

func TestPeerStateDiagnosticVerifyRejectsUnexpectedUnlistedFile(t *testing.T) {
	bundle, _ := createDiagnosticBundleForVerification(t)
	if err := os.WriteFile(filepath.Join(bundle, "extra.txt"), []byte("unexpected"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyPeerStateDiagnosticBundle(bundle); err == nil {
		t.Fatal("diagnostic verifier must reject unexpected unlisted files")
	}
}
