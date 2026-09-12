package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPeerQuarantineOperatorReleasePreservesEvidence(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-quarantine.json")
	evidence, err := newPeerEvidence(cfg, "validator-b", "PROOF_HEAD_MISMATCH", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "self-inconsistent peer proof", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	state := defaultPeerQuarantineState(cfg)
	if err := quarantinePeer(&state, evidence); err != nil {
		t.Fatal(err)
	}
	entry := state.Entries["validator-b"]
	entry.Status = "RELEASED_BY_OPERATOR"
	entry.Reason = "operator reviewed evidence"
	state.Entries["validator-b"] = entry
	if err := savePeerQuarantineStateAtomic(path, state); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadPeerQuarantineState(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if peerIsQuarantined(loaded, "validator-b") {
		t.Fatal("released peer must no longer be filtered as quarantined")
	}
	if len(loaded.Entries["validator-b"].EvidenceHashes) != 1 || loaded.Entries["validator-b"].EvidenceHashes[0] != evidence.EvidenceHash {
		t.Fatal("operator release must preserve historical evidence hashes")
	}
}
