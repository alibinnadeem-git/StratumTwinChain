package main

import (
	"testing"
	"time"
)

func TestFollowerProfileIsReadOnlyCandidateProfile(t *testing.T) {
	if peerFollowerProfile != "STRATUM-PEER-FOLLOWER/1" {
		t.Fatalf("unexpected follower profile %q", peerFollowerProfile)
	}
}

func TestFollowerBackoffIsBounded(t *testing.T) {
	base := 5 * time.Second
	max := 40 * time.Second
	cases := []struct {
		failures int
		want     time.Duration
	}{
		{0, 5 * time.Second},
		{1, 5 * time.Second},
		{2, 10 * time.Second},
		{3, 20 * time.Second},
		{4, 40 * time.Second},
		{20, 40 * time.Second},
	}
	for _, tc := range cases {
		if got := followerBackoff(base, max, tc.failures); got != tc.want {
			t.Fatalf("failures=%d: got %s want %s", tc.failures, got, tc.want)
		}
	}
}

func TestFollowerSafetyHaltOnlyForVerifiedSafetyConflicts(t *testing.T) {
	if !followerSafetyHalt("FINALIZED_HEAD_CONFLICT") {
		t.Fatal("same-height finalized conflict must halt follower")
	}
	if !followerSafetyHalt("HISTORICAL_DIVERGENCE") {
		t.Fatal("cryptographic historical divergence must halt follower")
	}
	for _, classification := range []string{"NO_AUTHENTICATED_PEERS", "ANCESTRY_UNVERIFIED", "UNRESOLVED_HEIGHT_SKEW", "EXACT_HEAD_AGREEMENT", "PROVEN_LAG"} {
		if followerSafetyHalt(classification) {
			t.Fatalf("classification %s must not be treated as an irreversible safety halt", classification)
		}
	}
}

func TestSelectFollowerPeerUsesExactAgreementDeterministically(t *testing.T) {
	result := PeerResolveResult{
		Classification:     "EXACT_HEAD_AGREEMENT",
		AutoAdvanceAllowed: true,
		Survey: PeerHeadSurvey{Observations: []PeerHeadObservation{
			{PeerValidatorID: "validator-c", TargetURL: "https://c.example", Head: multiHead(42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")},
			{PeerValidatorID: "validator-a", TargetURL: "https://a.example", Head: multiHead(42, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")},
		}},
	}
	selected, err := selectFollowerPeer(result)
	if err != nil {
		t.Fatal(err)
	}
	if selected.PeerValidatorID != "validator-a" {
		t.Fatalf("selected %s; expected deterministic validator-a", selected.PeerValidatorID)
	}
}

func TestSelectFollowerPeerForProvenLagOnlyUsesProvenHighestPeer(t *testing.T) {
	low := PeerHeadObservation{PeerValidatorID: "validator-a", TargetURL: "https://a.example", Head: multiHead(41, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")}
	highB := PeerHeadObservation{PeerValidatorID: "validator-b", TargetURL: "https://b.example", Head: multiHead(42, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")}
	highC := PeerHeadObservation{PeerValidatorID: "validator-c", TargetURL: "https://c.example", Head: multiHead(42, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")}
	result := PeerResolveResult{
		Classification:     "PROVEN_LAG",
		AutoAdvanceAllowed: true,
		LowerHead:          &low,
		HighestHeadPeers:   []PeerHeadObservation{highB, highC},
		AncestryResults: []PeerAncestryPeerResult{
			{PeerValidatorID: "validator-b", Classification: "ANCESTRY_UNVERIFIED"},
			{PeerValidatorID: "validator-c", Classification: "PROVEN_LAG"},
		},
	}
	selected, err := selectFollowerPeer(result)
	if err != nil {
		t.Fatal(err)
	}
	if selected.PeerValidatorID != "validator-c" {
		t.Fatalf("selected %s; expected only proof-eligible validator-c", selected.PeerValidatorID)
	}
}

func TestSelectFollowerPeerRejectsBlockedResolution(t *testing.T) {
	_, err := selectFollowerPeer(PeerResolveResult{Classification: "FINALIZED_HEAD_CONFLICT", AutoAdvanceAllowed: false})
	if err == nil {
		t.Fatal("blocked resolution must not yield a follower target")
	}
}
