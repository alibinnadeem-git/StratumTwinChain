package main

import (
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPeerQuarantineRecordsEvidenceAndBlocksSelection(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-quarantine.json")
	now := time.Date(2026, 9, 11, 22, 0, 0, 0, time.UTC)
	evidence, state, err := recordPeerSafetyFailure(
		path,
		cfg,
		"validator-b",
		"HISTORICAL_DIVERGENCE",
		42,
		strings.Repeat("a", 64),
		strings.Repeat("b", 64),
		"peer supplied a proof path that did not extend the locally trusted DIR",
		now,
	)
	if err != nil {
		t.Fatal(err)
	}
	if !isSHA256(evidence.EvidenceHash) {
		t.Fatalf("expected SHA-256 evidence hash, got %q", evidence.EvidenceHash)
	}
	if !peerIsQuarantined(state, "validator-b") {
		t.Fatal("expected validator-b to be locally quarantined")
	}
	loaded, err := loadPeerQuarantineState(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !peerIsQuarantined(loaded, "validator-b") {
		t.Fatal("expected quarantine to survive restart")
	}
}

func TestPeerQuarantineDeduplicatesEvidenceHash(t *testing.T) {
	cfg := testPeerSyncConfig()
	state := defaultPeerQuarantineState(cfg)
	now := time.Date(2026, 9, 11, 22, 0, 0, 0, time.UTC)
	evidence, err := newPeerEvidence(cfg, "validator-c", "INVALID_FINALITY_PROOF", 77, strings.Repeat("c", 64), strings.Repeat("d", 64), "invalid PFC", now)
	if err != nil {
		t.Fatal(err)
	}
	if err := quarantinePeer(&state, evidence); err != nil {
		t.Fatal(err)
	}
	if err := quarantinePeer(&state, evidence); err != nil {
		t.Fatal(err)
	}
	entry := state.Entries["validator-c"]
	if len(entry.EvidenceHashes) != 1 {
		t.Fatalf("expected one deduplicated evidence hash, got %d", len(entry.EvidenceHashes))
	}
}

func TestPeerQuarantineRejectsForeignTrustContext(t *testing.T) {
	cfg := testPeerSyncConfig()
	state := defaultPeerQuarantineState(cfg)
	evidence, err := newPeerEvidence(cfg, "validator-b", "HEAD_EQUIVOCATION", 20, strings.Repeat("a", 64), strings.Repeat("b", 64), "same authenticated peer claimed incompatible finalized heads", time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	evidence.ChainID = "foreign-chain"
	if err := quarantinePeer(&state, evidence); err == nil {
		t.Fatal("expected foreign-chain evidence to be rejected")
	}
}

func TestPeerQuarantineDoesNotChangeVoteAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	if cfg.VoteAuthority {
		t.Fatal("test requires candidate with voteAuthority=false")
	}
	state := defaultPeerQuarantineState(cfg)
	evidence, err := newPeerEvidence(cfg, "validator-a", "INVALID_SYNC_PROOF", 12, "", "", "malformed read-only sync proof", time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if err := quarantinePeer(&state, evidence); err != nil {
		t.Fatal(err)
	}
	if cfg.VoteAuthority {
		t.Fatal("local read-only peer quarantine must not grant or change vote authority")
	}
}
