package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestResolverConflictEvidenceDoesNotQuarantinePeers(t *testing.T) {
	cfg := testPeerSyncConfig()
	evidencePath := filepath.Join(t.TempDir(), "evidence.json")
	quarantinePath := filepath.Join(t.TempDir(), "quarantine.json")
	hashA := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	hashB := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	result := PeerResolveResult{
		Classification: "FINALIZED_HEAD_CONFLICT",
		Survey: PeerHeadSurvey{Observations: []PeerHeadObservation{
			{PeerValidatorID: "validator-a", Head: PeerSyncHeadResponse{LatestHeight: 42, LatestDIRHash: hashA}},
			{PeerValidatorID: "validator-b", Head: PeerSyncHeadResponse{LatestHeight: 42, LatestDIRHash: hashB}},
		}},
	}
	entries, err := persistResolverEvidence(evidencePath, quarantinePath, cfg, result, time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected two conflict evidence entries, got %d", len(entries))
	}
	state, err := loadPeerQuarantineState(quarantinePath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if peerIsQuarantined(state, "validator-a") || peerIsQuarantined(state, "validator-b") {
		t.Fatal("network head conflict must not auto-quarantine either peer")
	}
}

func TestResolverProofHeadMismatchQuarantinesOnlySelfInconsistentPeer(t *testing.T) {
	cfg := testPeerSyncConfig()
	evidencePath := filepath.Join(t.TempDir(), "evidence.json")
	quarantinePath := filepath.Join(t.TempDir(), "quarantine.json")
	surveyed := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	verified := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	result := PeerResolveResult{
		Classification:   "HISTORICAL_DIVERGENCE",
		HighestHeadPeers: []PeerHeadObservation{{PeerValidatorID: "validator-b", Head: PeerSyncHeadResponse{LatestHeight: 42, LatestDIRHash: surveyed}}},
		AncestryResults:  []PeerAncestryPeerResult{{PeerValidatorID: "validator-b", Classification: "HISTORICAL_DIVERGENCE", VerifiedHeight: 42, VerifiedDIRHash: verified, Reason: "proof-verified terminal head does not match the surveyed higher peer head"}},
	}
	entries, err := persistResolverEvidence(evidencePath, quarantinePath, cfg, result, time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].EvidenceType != "PROOF_HEAD_MISMATCH" {
		t.Fatalf("unexpected evidence: %#v", entries)
	}
	state, err := loadPeerQuarantineState(quarantinePath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !peerIsQuarantined(state, "validator-b") {
		t.Fatal("self-inconsistent peer should be quarantined from local read-only sync selection")
	}
}
