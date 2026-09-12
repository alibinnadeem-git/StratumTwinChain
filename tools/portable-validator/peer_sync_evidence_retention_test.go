package main

import (
	"testing"
	"time"
)

func retentionEvidence(t *testing.T, cfg BootstrapConfig, peer, kind string, second int64) PeerEvidence {
	t.Helper()
	evidence, err := newPeerEvidence(cfg, peer, kind, second, "", "", "retention test", time.Unix(second, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	return evidence
}

func TestPeerEvidenceRetentionNoPruningUnderLimit(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerEvidenceJournal(cfg)
	journal.Entries = []PeerEvidence{
		retentionEvidence(t, cfg, "validator-a", "FINALIZED_HEAD_CONFLICT", 1),
		retentionEvidence(t, cfg, "validator-b", "FINALIZED_HEAD_CONFLICT", 2),
	}
	retained, result, err := applyPeerEvidenceRetention(journal, defaultPeerQuarantineState(cfg), 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(retained.Entries) != 2 || result.UnpinnedPruned != 0 {
		t.Fatalf("unexpected retention result: %+v", result)
	}
}

func TestPeerEvidenceRetentionPrunesOldestUnpinned(t *testing.T) {
	cfg := testPeerSyncConfig()
	oldest := retentionEvidence(t, cfg, "validator-a", "FINALIZED_HEAD_CONFLICT", 1)
	middle := retentionEvidence(t, cfg, "validator-b", "FINALIZED_HEAD_CONFLICT", 2)
	newest := retentionEvidence(t, cfg, "validator-c", "FINALIZED_HEAD_CONFLICT", 3)
	journal := defaultPeerEvidenceJournal(cfg)
	journal.Entries = []PeerEvidence{oldest, middle, newest}
	retained, result, err := applyPeerEvidenceRetention(journal, defaultPeerQuarantineState(cfg), 2)
	if err != nil {
		t.Fatal(err)
	}
	if result.UnpinnedPruned != 1 || len(retained.Entries) != 2 {
		t.Fatalf("unexpected retention result: %+v", result)
	}
	if retained.Entries[0].EvidenceHash != middle.EvidenceHash || retained.Entries[1].EvidenceHash != newest.EvidenceHash {
		t.Fatalf("expected newest two unpinned entries to remain, got %+v", retained.Entries)
	}
}

func TestPeerEvidenceRetentionPinsQuarantineAndReleasedHistory(t *testing.T) {
	cfg := testPeerSyncConfig()
	pinnedActive := retentionEvidence(t, cfg, "validator-a", "HEAD_EQUIVOCATION", 1)
	pinnedReleased := retentionEvidence(t, cfg, "validator-b", "PROOF_HEAD_MISMATCH", 2)
	unpinnedNewest := retentionEvidence(t, cfg, "validator-c", "FINALIZED_HEAD_CONFLICT", 3)
	journal := defaultPeerEvidenceJournal(cfg)
	journal.Entries = []PeerEvidence{pinnedActive, pinnedReleased, unpinnedNewest}
	quarantine := defaultPeerQuarantineState(cfg)
	quarantine.Entries["validator-a"] = PeerQuarantineEntry{PeerValidatorID: "validator-a", Status: "QUARANTINED", EvidenceHashes: []string{pinnedActive.EvidenceHash}}
	quarantine.Entries["validator-b"] = PeerQuarantineEntry{PeerValidatorID: "validator-b", Status: "RELEASED_BY_OPERATOR", EvidenceHashes: []string{pinnedReleased.EvidenceHash}}
	retained, result, err := applyPeerEvidenceRetention(journal, quarantine, 0)
	if err != nil {
		t.Fatal(err)
	}
	if result.Pinned != 2 || result.UnpinnedPruned != 1 || len(retained.Entries) != 2 {
		t.Fatalf("unexpected retention result: %+v", result)
	}
	if retained.Entries[0].EvidenceHash != pinnedActive.EvidenceHash || retained.Entries[1].EvidenceHash != pinnedReleased.EvidenceHash {
		t.Fatal("quarantine-linked evidence history must remain pinned regardless of status")
	}
}

func TestPeerEvidenceRetentionFailsClosedWhenPinnedEvidenceMissing(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerEvidenceJournal(cfg)
	quarantine := defaultPeerQuarantineState(cfg)
	quarantine.Entries["validator-a"] = PeerQuarantineEntry{
		PeerValidatorID: "validator-a",
		Status:          "RELEASED_BY_OPERATOR",
		EvidenceHashes:  []string{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
	}
	if _, _, err := applyPeerEvidenceRetention(journal, quarantine, 10); err == nil {
		t.Fatal("retention must fail closed when quarantine audit history references missing evidence")
	}
}

func TestPeerEvidenceRetentionRejectsMalformedUnpinnedTimestamp(t *testing.T) {
	cfg := testPeerSyncConfig()
	evidence := retentionEvidence(t, cfg, "validator-a", "FINALIZED_HEAD_CONFLICT", 1)
	evidence.ObservedAt = "not-a-time"
	journal := defaultPeerEvidenceJournal(cfg)
	journal.Entries = []PeerEvidence{evidence}
	if _, _, err := applyPeerEvidenceRetention(journal, defaultPeerQuarantineState(cfg), 0); err == nil {
		t.Fatal("retention must fail closed on malformed unpinned evidence timestamp")
	}
}
