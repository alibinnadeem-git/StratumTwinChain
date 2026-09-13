package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func diagnosticFileByName(t *testing.T, manifest PeerStateDiagnosticManifest, name string) PeerStateDiagnosticFile {
	t.Helper()
	for _, file := range manifest.Files {
		if file.Name == name {
			return file
		}
	}
	t.Fatalf("diagnostic manifest missing file %q", name)
	return PeerStateDiagnosticFile{}
}

func TestPeerStateDiagnosticExportPreservesCorruptBytesAndExcludesPrivateKeys(t *testing.T) {
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	dir := filepath.Join(root, "validator")
	output := filepath.Join(root, "diagnostic")
	stateDir := filepath.Join(dir, "state")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	corrupt := []byte(`{"profileVersion":"STRATUM-PEER-SYNC/1","truncated":`)
	sourcePath := filepath.Join(stateDir, "peer-sync-head.json")
	if err := os.WriteFile(sourcePath, corrupt, 0o600); err != nil {
		t.Fatal(err)
	}
	privateDir := filepath.Join(dir, "keys", "private")
	if err := os.MkdirAll(privateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	secret := []byte("DO-NOT-EXPORT-PRIVATE-KEY-MATERIAL")
	if err := os.WriteFile(filepath.Join(privateDir, "transport.pk8"), secret, 0o600); err != nil {
		t.Fatal(err)
	}

	before, err := os.ReadFile(sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := exportPeerStateDiagnostics(dir, output, cfg, time.Unix(1_800_000_000, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if manifest.Health.OverallStatus != "INVALID_PERSISTED_STATE" || manifest.SourceMutation || manifest.PrivateKeysIncluded || manifest.ConsensusAuthority || manifest.VoteAuthority || manifest.ConsensusParticipation {
		t.Fatalf("unexpected diagnostic authority/health metadata: %+v", manifest)
	}
	after, err := os.ReadFile(sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("diagnostic export mutated source state")
	}

	entry := diagnosticFileByName(t, manifest, "trusted-head")
	exported, err := os.ReadFile(filepath.Join(output, entry.ExportPath))
	if err != nil {
		t.Fatal(err)
	}
	if string(exported) != string(corrupt) {
		t.Fatal("diagnostic export did not preserve raw corrupt bytes")
	}
	digest := sha256.Sum256(corrupt)
	if entry.SHA256 != hex.EncodeToString(digest[:]) || entry.SizeBytes != int64(len(corrupt)) {
		t.Fatalf("diagnostic hash/size mismatch: %+v", entry)
	}
	manifestBytes, err := os.ReadFile(filepath.Join(output, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(manifestBytes), string(secret)) {
		t.Fatal("diagnostic manifest leaked private key material")
	}
	if err := filepath.Walk(output, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if strings.Contains(string(data), string(secret)) || strings.Contains(strings.ToLower(path), "keys") {
			t.Fatalf("diagnostic output contains private key material/path: %s", path)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestPeerStateDiagnosticExportRefusesDestinationInsideValidatorDir(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	output := filepath.Join(dir, "diagnostic")
	if _, err := exportPeerStateDiagnostics(dir, output, cfg, time.Now().UTC()); err == nil {
		t.Fatal("diagnostic export must refuse destinations inside validator data directory")
	}
	if _, err := os.Stat(output); !os.IsNotExist(err) {
		t.Fatal("refused diagnostic export must not create output")
	}
}

func TestPeerStateDiagnosticExportRefusesOverwrite(t *testing.T) {
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	dir := filepath.Join(root, "validator")
	output := filepath.Join(root, "diagnostic")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(output, 0o700); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(output, "keep.txt")
	if err := os.WriteFile(marker, []byte("keep"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := exportPeerStateDiagnostics(dir, output, cfg, time.Now().UTC()); err == nil {
		t.Fatal("diagnostic export must refuse to overwrite an existing destination")
	}
	data, err := os.ReadFile(marker)
	if err != nil || string(data) != "keep" {
		t.Fatal("refused diagnostic export modified existing destination")
	}
}
