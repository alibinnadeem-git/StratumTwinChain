package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// This test models a crash/restart boundary where the canonical signing intent
// is already durably journaled, but the private key is unavailable when the
// process retries the outbound signature. Recovery must preserve that intent.
func TestConsensusIntentPersistsBeforePrivateKeyFailure(t *testing.T) {
	f := makeConsensusTransportFixture(t, true)
	proposal := strings.Repeat("b", 64)

	vote := VerifyVoteProof{
		Domain:           poviVerifyDomain,
		ChainID:          f.cfg.ChainID,
		Height:           1,
		Round:            0,
		Step:             "VERIFY",
		ProposalHash:     proposal,
		ValidatorID:      f.cfg.ValidatorID,
		ValidatorSetRoot: f.root,
		ProtocolVersion:  f.cfg.ProtocolVersion,
		KeyID:            "validator-a:consensus:v1",
		Algorithm:        "Ed25519",
	}
	messageHash, err := verifyVoteMessageHashPortable(vote)
	if err != nil {
		t.Fatal(err)
	}
	decision := ConsensusSafetyDecision{
		Height:       1,
		Round:        0,
		Step:         "VERIFY",
		ProposalHash: proposal,
		MessageHash:  messageHash,
	}

	if _, err := recordConsensusSafetyDecision(f.dir, decision); err != nil {
		t.Fatalf("persist canonical VERIFY intent: %v", err)
	}

	keyPath := filepath.Join(f.dir, "keys", "private", "consensus.pk8")
	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(keyPath); err != nil {
		t.Fatal(err)
	}

	_, _, err = prepareConsensusTransportSignature(f.dir, decision)
	if err == nil {
		t.Fatal("expected signing retry to fail while private key is unavailable")
	}

	_, latest, records, err := latestConsensusSafetyRecord(f.dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 || latest.Step != "VERIFY" || latest.ProposalHash != proposal || latest.MessageHash != messageHash {
		t.Fatalf("durable VERIFY intent was not preserved across signing failure: %+v", latest)
	}

	if err := os.WriteFile(keyPath, keyBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	_, err = signVerifyWireMessage(f.dir, f.set, 1, 0, strings.Repeat("c", 64), f.root, "POVI/1", "", nil)
	if err == nil || !strings.Contains(err.Error(), "EQUIVOCATION_BLOCKED") {
		t.Fatalf("persisted unsigned intent did not block conflicting vote after recovery: %v", err)
	}

	_, latest, records, err = latestConsensusSafetyRecord(f.dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 || latest.ProposalHash != proposal || latest.MessageHash != messageHash {
		t.Fatalf("conflicting recovery attempt mutated durable safety history: %+v", latest)
	}
}
