package main

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestPeerFollowerStatusPersistsTrustBoundNonVotingState(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-follower-status.json")
	status := newPeerFollowerStatus(cfg, "IDLE", time.Unix(100, 0).UTC())
	status.TrustedHeight = 42
	status.TrustedDIRHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	status.LastClassification = "PROVEN_LAG"
	if err := savePeerFollowerStatusAtomic(path, status, cfg); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadPeerFollowerStatus(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.RuntimeState != "IDLE" || loaded.TrustedHeight != 42 || loaded.LastClassification != "PROVEN_LAG" {
		t.Fatalf("unexpected loaded follower status: %+v", loaded)
	}
	if loaded.VoteAuthority || loaded.ConsensusParticipation {
		t.Fatal("follower status must remain non-voting")
	}
}

func TestPeerFollowerStatusRejectsForeignTrustContext(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-follower-status.json")
	status := newPeerFollowerStatus(cfg, "RUNNING", time.Now().UTC())
	if err := savePeerFollowerStatusAtomic(path, status, cfg); err != nil {
		t.Fatal(err)
	}
	foreign := cfg
	foreign.ChainID = cfg.ChainID + "-foreign"
	if _, err := loadPeerFollowerStatus(path, foreign); err == nil {
		t.Fatal("foreign chain trust context must be rejected")
	}
}

func TestPeerFollowerStatusRejectsConsensusParticipation(t *testing.T) {
	cfg := testPeerSyncConfig()
	status := newPeerFollowerStatus(cfg, "RUNNING", time.Now().UTC())
	status.ConsensusParticipation = true
	if err := savePeerFollowerStatusAtomic(filepath.Join(t.TempDir(), "peer-follower-status.json"), status, cfg); err == nil {
		t.Fatal("consensus-participating follower status must be rejected")
	}
}

func TestWaitFollowerContextCancelsPromptly(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	started := time.Now()
	if waitFollowerContext(ctx, time.Minute) {
		t.Fatal("cancelled context must interrupt follower wait")
	}
	if time.Since(started) > time.Second {
		t.Fatal("cancelled follower wait did not return promptly")
	}
}
