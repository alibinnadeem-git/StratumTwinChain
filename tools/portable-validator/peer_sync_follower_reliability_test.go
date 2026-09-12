package main

import "testing"

func TestFollowerReliabilityOrderingOnlyReordersEligiblePeers(t *testing.T) {
	result := PeerResolveResult{
		Classification:     "EXACT_HEAD_AGREEMENT",
		AutoAdvanceAllowed: true,
		Survey: PeerHeadSurvey{Observations: []PeerHeadObservation{
			multiHead("validator-a", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
			multiHead("validator-b", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
		}},
	}
	state := PeerReliabilityState{
		ConsensusWeighting: false,
		Peers: map[string]PeerReliabilityEntry{
			"validator-a": {PeerValidatorID: "validator-a", ObjectiveSafetyFaultCount: 1, ProvenAncestryCount: 10},
			"validator-b": {PeerValidatorID: "validator-b", ObjectiveSafetyFaultCount: 0, ProvenAncestryCount: 1},
		},
	}
	selected, err := selectFollowerPeerWithReliability(result, state)
	if err != nil {
		t.Fatal(err)
	}
	if selected.PeerValidatorID != "validator-b" {
		t.Fatalf("selected %s; expected lower operational fault count validator-b", selected.PeerValidatorID)
	}
	if selected.Head.LatestHeight != 42 || selected.Head.LatestDIRHash != result.Survey.Observations[0].Head.LatestDIRHash {
		t.Fatal("reliability ordering must not change the already-resolved finalized history")
	}
}

func TestFollowerReliabilityOrderingRejectsConsensusWeighting(t *testing.T) {
	result := PeerResolveResult{
		Classification:     "EXACT_HEAD_AGREEMENT",
		AutoAdvanceAllowed: true,
		Survey: PeerHeadSurvey{Observations: []PeerHeadObservation{
			multiHead("validator-a", 42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
		}},
	}
	state := PeerReliabilityState{ConsensusWeighting: true, Peers: map[string]PeerReliabilityEntry{}}
	if _, err := selectFollowerPeerWithReliability(result, state); err == nil {
		t.Fatal("consensus-weighted reliability state must never influence follower selection")
	}
}

func TestFollowerReliabilityOrderingCannotUnblockResolution(t *testing.T) {
	result := PeerResolveResult{Classification: "FINALIZED_HEAD_CONFLICT", AutoAdvanceAllowed: false}
	state := PeerReliabilityState{
		ConsensusWeighting: false,
		Peers: map[string]PeerReliabilityEntry{
			"validator-a": {PeerValidatorID: "validator-a", ProvenAncestryCount: 999999},
		},
	}
	if _, err := selectFollowerPeerWithReliability(result, state); err == nil {
		t.Fatal("operational reliability must never turn a blocked resolution into an advance")
	}
}

func TestFollowerReliabilityOrderingForProvenLagCannotIntroduceUnprovenPeer(t *testing.T) {
	low := multiHead("validator-a", 41, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	highB := multiHead("validator-b", 42, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	highC := multiHead("validator-c", 42, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	result := PeerResolveResult{
		Classification:     "PROVEN_LAG",
		AutoAdvanceAllowed: true,
		LowerHead:          &low,
		HighestHeadPeers:   []PeerHeadObservation{highB, highC},
		AncestryResults: []PeerAncestryPeerResult{
			{PeerValidatorID: "validator-b", Classification: "PROVEN_LAG"},
			{PeerValidatorID: "validator-c", Classification: "ANCESTRY_UNVERIFIED"},
		},
	}
	state := PeerReliabilityState{
		ConsensusWeighting: false,
		Peers: map[string]PeerReliabilityEntry{
			"validator-b": {PeerValidatorID: "validator-b", ProvenAncestryCount: 1},
			"validator-c": {PeerValidatorID: "validator-c", ProvenAncestryCount: 1000000},
		},
	}
	selected, err := selectFollowerPeerWithReliability(result, state)
	if err != nil {
		t.Fatal(err)
	}
	if selected.PeerValidatorID != "validator-b" {
		t.Fatalf("selected %s; unproven peer must never enter the eligible set", selected.PeerValidatorID)
	}
}
