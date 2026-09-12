package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConsensusIntentPersistsBeforePrivateKeyFailure(t *testing.T) {
	f := makeConsensusTransportFixture(t, true)
	proposal := strings.Repeat("b", 64)
	keyPath := filepath.Join(f.dir, "keys", "private", "consensus.pk8")
	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(keyPath); err != nil {
		t.Fatal(err)
	}

	_, err = signVerifyWireMessage(f.dir, f.set, 1, 0, proposal, f.root, "POVI/1", "", nil)
	if err == nil {
		t.Fatal("expected signing failure after durable safety intent")
	}

	_, latest, records, err := latestConsensusSafetyRecord(f.dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 || latest.Step != "VERIFY" || latest.ProposalHash != proposal || latest.MessageHash == "" {
		t.Fatalf("VERIFY intent was not durably recorded before key failure: %+v", latest)
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
	if len(records) != 2 || latest.ProposalHash != proposal {
		t.Fatalf("conflicting recovery attempt mutated durable safety history: %+v", latest)
	}
}
