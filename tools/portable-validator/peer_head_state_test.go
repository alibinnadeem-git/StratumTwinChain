package main

import (
	"path/filepath"
	"testing"
	"time"
)

func authenticatedHeadObservation(peer string, height int64, dirHash string, observedAt time.Time, cfg BootstrapConfig) PeerHeadObservation {
	return PeerHeadObservation{
		PeerValidatorID: peer,
		TargetURL:       "https://peer.example",
		ObservedAt:      observedAt.UTC().Format(time.RFC3339Nano),
		Head: PeerSyncHeadResponse{
			ProfileVersion:   peerSyncProfile,
			ResponseType:     "SYNC_HEAD",
			ChainID:          cfg.ChainID,
			GenesisDIRHash:   cfg.GenesisDIRHash,
			ProtocolVersion:  cfg.ProtocolVersion,
			LatestHeight:     height,
			LatestDIRHash:    dirHash,
			LatestStateRoot:  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
			ValidatorSetRoot: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		},
	}
}

func TestCrossRunSamePeerSameHeightDifferentHashQuarantines(t *testing.T) {
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	headPath := filepath.Join(root, "heads.json")
	evidencePath := filepath.Join(root, "evidence.json")
	quarantinePath := filepath.Join(root, "quarantine.json")
	first := authenticatedHeadObservation("validator-b", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", time.Unix(100, 0), cfg)
	second := authenticatedHeadObservation("validator-b", 42, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", time.Unix(200, 0), cfg)
	if evidence, err := recordAuthenticatedPeerHead(headPath, evidencePath, quarantinePath, cfg, first); err != nil || evidence != nil {
		t.Fatalf("unexpected first observation result: evidence=%#v err=%v", evidence, err)
	}
	evidence, err := recordAuthenticatedPeerHead(headPath, evidencePath, quarantinePath, cfg, second)
	if err != nil {
		t.Fatal(err)
	}
	if evidence == nil || evidence.EvidenceType != "HEAD_EQUIVOCATION" {
		t.Fatalf("expected HEAD_EQUIVOCATION, got %#v", evidence)
	}
	state, err := loadPeerQuarantineState(quarantinePath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !peerIsQuarantined(state, "validator-b") {
		t.Fatal("same-peer same-height contradictory finalized heads must quarantine the peer locally")
	}
}

func TestCrossRunHeightAdvanceDoesNotEquivocate(t *testing.T) {
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	headPath := filepath.Join(root, "heads.json")
	evidencePath := filepath.Join(root, "evidence.json")
	quarantinePath := filepath.Join(root, "quarantine.json")
	first := authenticatedHeadObservation("validator-b", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", time.Unix(100, 0), cfg)
	second := authenticatedHeadObservation("validator-b", 43, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", time.Unix(200, 0), cfg)
	if _, err := recordAuthenticatedPeerHead(headPath, evidencePath, quarantinePath, cfg, first); err != nil {
		t.Fatal(err)
	}
	evidence, err := recordAuthenticatedPeerHead(headPath, evidencePath, quarantinePath, cfg, second)
	if err != nil {
		t.Fatal(err)
	}
	if evidence != nil {
		t.Fatalf("normal height advance must not be equivocation: %#v", evidence)
	}
	state, err := loadPeerQuarantineState(quarantinePath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if peerIsQuarantined(state, "validator-b") {
		t.Fatal("normal head advancement must not quarantine the peer")
	}
}
