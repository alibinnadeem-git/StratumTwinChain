package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type peerSyncGovernanceVector struct {
	ExpectedGovernancePolicyHash     string                  `json:"expectedGovernancePolicyHash"`
	ExpectedPreviousValidatorSetRoot string                  `json:"expectedPreviousValidatorSetRoot"`
	Proof                            ValidatorSetChangeProof `json:"proof"`
}

func loadValidatorGovernanceVectorForSyncTest(t *testing.T) peerSyncGovernanceVector {
	t.Helper()
	path := filepath.Join("..", "..", "lib", "redbook", "test-vectors", "validator-governance-v1.json")
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var vector peerSyncGovernanceVector
	if err := json.Unmarshal(b, &vector); err != nil {
		t.Fatal(err)
	}
	return vector
}

func TestPeerSyncGovernanceTransitionAcceptsIndependentlyTrustedProof(t *testing.T) {
	vector := loadValidatorGovernanceVectorForSyncTest(t)
	candidate := PeerSyncTrustedHead{ValidatorSetRoot: vector.ExpectedPreviousValidatorSetRoot}
	next, nextRoot, err := verifySyncValidatorTransition(vector.Proof, candidate, vector.Proof.Action.ChainID, vector.ExpectedGovernancePolicyHash, vector.Proof.Action.EffectiveHeight)
	if err != nil {
		t.Fatal(err)
	}
	if nextRoot != vector.Proof.Action.NextValidatorSetRoot {
		t.Fatalf("expected next validator-set root %s, got %s", vector.Proof.Action.NextValidatorSetRoot, nextRoot)
	}
	computed, err := snapshotValidatorSetRoot(next, vector.Proof.Action.EffectiveHeight)
	if err != nil {
		t.Fatal(err)
	}
	if computed != nextRoot {
		t.Fatalf("verified next set root mismatch: %s != %s", computed, nextRoot)
	}
}

func TestPeerSyncGovernanceTransitionRejectsUntrustedPolicy(t *testing.T) {
	vector := loadValidatorGovernanceVectorForSyncTest(t)
	candidate := PeerSyncTrustedHead{ValidatorSetRoot: vector.ExpectedPreviousValidatorSetRoot}
	wrong := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, _, err := verifySyncValidatorTransition(vector.Proof, candidate, vector.Proof.Action.ChainID, wrong, vector.Proof.Action.EffectiveHeight); err == nil {
		t.Fatal("expected validator-set transition signed under an untrusted policy to be rejected")
	}
}

func TestPeerSyncGovernanceTransitionRejectsWrongPreviousRoot(t *testing.T) {
	vector := loadValidatorGovernanceVectorForSyncTest(t)
	candidate := PeerSyncTrustedHead{ValidatorSetRoot: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
	if _, _, err := verifySyncValidatorTransition(vector.Proof, candidate, vector.Proof.Action.ChainID, vector.ExpectedGovernancePolicyHash, vector.Proof.Action.EffectiveHeight); err == nil {
		t.Fatal("expected validator-set transition that does not continue the trusted root to be rejected")
	}
}

func TestPeerSyncGovernanceTransitionRejectsWrongEffectiveHeight(t *testing.T) {
	vector := loadValidatorGovernanceVectorForSyncTest(t)
	candidate := PeerSyncTrustedHead{ValidatorSetRoot: vector.ExpectedPreviousValidatorSetRoot}
	if _, _, err := verifySyncValidatorTransition(vector.Proof, candidate, vector.Proof.Action.ChainID, vector.ExpectedGovernancePolicyHash, vector.Proof.Action.EffectiveHeight+1); err == nil {
		t.Fatal("expected transition applied at the wrong DIR height to be rejected")
	}
}
