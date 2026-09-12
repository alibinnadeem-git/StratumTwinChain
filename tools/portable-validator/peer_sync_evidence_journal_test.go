package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPeerEvidenceJournalPersistsAndDeduplicates(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-evidence.json")
	hash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	evidence, err := newPeerEvidence(cfg, "validator-b", "HISTORICAL_DIVERGENCE", 42, "", hash, "operator review required", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	journal, err := appendPeerEvidence(path, cfg, evidence)
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Entries) != 1 {
		t.Fatalf("expected one entry, got %d", len(journal.Entries))
	}
	journal, err = appendPeerEvidence(path, cfg, evidence)
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Entries) != 1 {
		t.Fatalf("expected deduplicated evidence, got %d entries", len(journal.Entries))
	}
}
