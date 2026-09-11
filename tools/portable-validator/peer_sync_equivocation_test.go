package main

import (
	"strings"
	"testing"
	"time"
)

func TestPeerHeadEquivocationProducesEvidence(t *testing.T) {
	cfg := testPeerSyncConfig()
	previous := PeerHeadObservation{PeerValidatorID: "validator-b", Head: PeerSyncHeadResponse{ProfileVersion: peerSyncProfile, ResponseType: "SYNC_HEAD", ChainID: cfg.ChainID, GenesisDIRHash: cfg.GenesisDIRHash, ProtocolVersion: cfg.ProtocolVersion, LatestHeight: 42, LatestDIRHash: strings.Repeat("a", 64), LatestStateRoot: strings.Repeat("c", 64), ValidatorSetRoot: strings.Repeat("d", 64)}}
	current := previous
	current.Head.LatestDIRHash = strings.Repeat("b", 64)
	evidence, err := detectPeerHeadEquivocation(cfg, previous, current, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if evidence == nil || evidence.EvidenceType != "HEAD_EQUIVOCATION" {
		t.Fatalf("expected HEAD_EQUIVOCATION evidence, got %#v", evidence)
	}
	if evidence.ExpectedDIRHash == evidence.ObservedDIRHash {
		t.Fatal("equivocation evidence must bind incompatible DIR hashes")
	}
}

func TestPeerHeadEquivocationIgnoresDifferentValidators(t *testing.T) {
	cfg := testPeerSyncConfig()
	left := PeerHeadObservation{PeerValidatorID: "validator-a", Head: PeerSyncHeadResponse{ProfileVersion: peerSyncProfile, ResponseType: "SYNC_HEAD", ChainID: cfg.ChainID, GenesisDIRHash: cfg.GenesisDIRHash, ProtocolVersion: cfg.ProtocolVersion, LatestHeight: 7, LatestDIRHash: strings.Repeat("a", 64), LatestStateRoot: strings.Repeat("c", 64), ValidatorSetRoot: strings.Repeat("d", 64)}}
	right := left
	right.PeerValidatorID = "validator-b"
	right.Head.LatestDIRHash = strings.Repeat("b", 64)
	evidence, err := detectPeerHeadEquivocation(cfg, left, right, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if evidence != nil {
		t.Fatal("different validators reporting different heads is a conflict, not per-peer equivocation")
	}
}

func TestFilterQuarantinedPeerHeads(t *testing.T) {
	cfg := testPeerSyncConfig()
	state := defaultPeerQuarantineState(cfg)
	evidence, err := newPeerEvidence(cfg, "validator-b", "INVALID_FINALITY_PROOF", 8, "", "", "invalid proof", time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if err := quarantinePeer(&state, evidence); err != nil {
		t.Fatal(err)
	}
	observations := []PeerHeadObservation{{PeerValidatorID: "validator-a"}, {PeerValidatorID: "validator-b"}, {PeerValidatorID: "validator-c"}}
	allowed, blocked := filterQuarantinedPeerHeads(state, observations)
	if len(allowed) != 2 || len(blocked) != 1 || blocked[0] != "validator-b" {
		t.Fatalf("unexpected quarantine filter result: allowed=%#v blocked=%#v", allowed, blocked)
	}
}
