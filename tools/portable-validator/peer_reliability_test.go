package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPeerReliabilityNeverEnablesConsensusWeighting(t *testing.T) {
	cfg := testPeerSyncConfig()
	state := defaultPeerReliabilityState(cfg)
	if state.ConsensusWeighting {
		t.Fatal("peer reliability must never enable consensus weighting")
	}
	state.ConsensusWeighting = true
	if err := savePeerReliabilityStateAtomic(filepath.Join(t.TempDir(), "reliability.json"), state); err == nil {
		t.Fatal("expected persistence to reject consensus weighting")
	}
}

func TestPeerReliabilityCountsOnlyObjectiveSafetyFaults(t *testing.T) {
	cfg := testPeerSyncConfig()
	state := defaultPeerReliabilityState(cfg)
	now := time.Unix(100, 0).UTC()
	networkConflict, err := newPeerEvidence(cfg, "validator-b", "FINALIZED_HEAD_CONFLICT", 42, "", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "network disagreement", now)
	if err != nil {
		t.Fatal(err)
	}
	recordPeerSafetyFaultReliability(&state, networkConflict)
	if state.Peers["validator-b"].ObjectiveSafetyFaultCount != 0 {
		t.Fatal("network disagreement must not count as an objective peer safety fault")
	}
	objectiveFault, err := newPeerEvidence(cfg, "validator-b", "HEAD_EQUIVOCATION", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "same peer contradictory finalized head", now)
	if err != nil {
		t.Fatal(err)
	}
	recordPeerSafetyFaultReliability(&state, objectiveFault)
	entry := state.Peers["validator-b"]
	if entry.ObjectiveSafetyFaultCount != 1 || entry.LastOutcome != "HEAD_EQUIVOCATION" {
		t.Fatalf("unexpected reliability entry: %#v", entry)
	}
}

func TestPeerReliabilityTracksOperationalOutcomes(t *testing.T) {
	cfg := testPeerSyncConfig()
	state := defaultPeerReliabilityState(cfg)
	obs := authenticatedHeadObservation("validator-b", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", time.Unix(100, 0).UTC(), cfg)
	recordPeerHeadReliability(&state, obs)
	recordPeerAncestryReliability(&state, PeerAncestryPeerResult{PeerValidatorID: "validator-b", Classification: "PROVEN_LAG"}, time.Unix(200, 0).UTC())
	recordPeerAncestryReliability(&state, PeerAncestryPeerResult{PeerValidatorID: "validator-b", Classification: "ANCESTRY_UNVERIFIED"}, time.Unix(300, 0).UTC())
	entry := state.Peers["validator-b"]
	if entry.AuthenticatedHeadObservations != 1 || entry.ProvenAncestryCount != 1 || entry.AncestryUnverifiedCount != 1 {
		t.Fatalf("unexpected operational counters: %#v", entry)
	}
}
