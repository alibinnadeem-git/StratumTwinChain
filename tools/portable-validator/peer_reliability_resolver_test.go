package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestResolverProvenLagUpdatesReliabilityWithoutSafetyEvidence(t *testing.T) {
	cfg := testPeerSyncConfig()
	root := t.TempDir()
	evidencePath := filepath.Join(root, "peer-evidence.json")
	quarantinePath := filepath.Join(root, "peer-quarantine.json")
	result := PeerResolveResult{
		Classification:     "PROVEN_LAG",
		AutoAdvanceAllowed: true,
		AncestryResults: []PeerAncestryPeerResult{
			{PeerValidatorID: "validator-b", Classification: "PROVEN_LAG"},
		},
	}
	evidence, err := persistResolverEvidence(evidencePath, quarantinePath, cfg, result, time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if len(evidence) != 0 {
		t.Fatalf("successful ancestry must not create safety evidence: %#v", evidence)
	}
	state, err := loadPeerReliabilityState(filepath.Join(root, "peer-reliability.json"), cfg)
	if err != nil {
		t.Fatal(err)
	}
	entry := state.Peers["validator-b"]
	if entry.ProvenAncestryCount != 1 || entry.ObjectiveSafetyFaultCount != 0 {
		t.Fatalf("unexpected reliability entry: %#v", entry)
	}
}
