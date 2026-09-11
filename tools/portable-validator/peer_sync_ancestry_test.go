package main

import (
	"strings"
	"testing"
	"time"
)

func ancestryConfig() BootstrapConfig {
	cfg := testPeerSyncConfig()
	cfg.ChainID = "stratum-devnet-1"
	cfg.ProtocolVersion = "POVI/1"
	return cfg
}

func finalityAncestryFixture(t *testing.T) (BootstrapConfig, PeerHeadObservation, PeerHeadObservation, PeerSyncGovernedProofBundle) {
	t.Helper()
	v := loadFinalityVector(t)
	cfg := ancestryConfig()
	lower := PeerHeadObservation{
		PeerValidatorID: "validator-a",
		Head: PeerSyncHeadResponse{
			ProfileVersion:   peerSyncProfile,
			ResponseType:     "SYNC_HEAD",
			ChainID:          cfg.ChainID,
			GenesisDIRHash:   cfg.GenesisDIRHash,
			ProtocolVersion:  cfg.ProtocolVersion,
			LatestHeight:     v.TrustedPreviousHeight,
			LatestDIRHash:    v.TrustedPreviousDIRHash,
			LatestStateRoot:  strings.Repeat("2", 64),
			ValidatorSetRoot: v.ExpectedValidatorSetRoot,
		},
	}
	higher := PeerHeadObservation{
		PeerValidatorID: "validator-b",
		Head: PeerSyncHeadResponse{
			ProfileVersion:   peerSyncProfile,
			ResponseType:     "SYNC_HEAD",
			ChainID:          cfg.ChainID,
			GenesisDIRHash:   cfg.GenesisDIRHash,
			ProtocolVersion:  cfg.ProtocolVersion,
			LatestHeight:     v.Proof.Header.Height,
			LatestDIRHash:    v.Proof.PFC.DIRHash,
			LatestStateRoot:  v.Proof.Header.StateRoot,
			ValidatorSetRoot: v.Proof.Header.ValidatorSetRoot,
		},
	}
	bundle := PeerSyncGovernedProofBundle{
		ProfileVersion:      peerSyncProfile,
		ResponseType:        "SYNC_PROOF",
		ChainID:             cfg.ChainID,
		GenesisDIRHash:      cfg.GenesisDIRHash,
		ProtocolVersion:     cfg.ProtocolVersion,
		ValidatorSet:        v.ValidatorSet,
		FinalityProofs:      []DIRFinalityProof{v.Proof},
		GeneratedAt:         time.Now().UTC().Format(time.RFC3339Nano),
	}
	return cfg, lower, higher, bundle
}

func TestPeerAncestryClassifiesProvenLagFromRedbookFinalityVector(t *testing.T) {
	cfg, lower, higher, bundle := finalityAncestryFixture(t)
	result, err := verifyPeerHeadAncestry(cfg, lower, higher, bundle, strings.Repeat("f", 64), time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if result.Classification != "PROVEN_LAG" || !result.AutoAdvanceAllowed {
		t.Fatalf("expected PROVEN_LAG, got %#v", result)
	}
	if result.VerifiedHeight != higher.Head.LatestHeight || result.VerifiedDIRHash != higher.Head.LatestDIRHash {
		t.Fatalf("unexpected verified terminal head: %#v", result)
	}
}

func TestPeerAncestryDetectsHistoricalDivergence(t *testing.T) {
	cfg, lower, higher, bundle := finalityAncestryFixture(t)
	lower.Head.LatestDIRHash = strings.Repeat("9", 64)
	result, err := verifyPeerHeadAncestry(cfg, lower, higher, bundle, strings.Repeat("f", 64), time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if result.Classification != "HISTORICAL_DIVERGENCE" || result.AutoAdvanceAllowed {
		t.Fatalf("expected historical divergence, got %#v", result)
	}
}

func TestPeerAncestryRejectsSnapshotLeapOverLowerHead(t *testing.T) {
	cfg, lower, higher, bundle := finalityAncestryFixture(t)
	bundle.SnapshotCertificate = &SnapshotTrustCertificate{SnapshotHeight: lower.Head.LatestHeight + 1}
	if _, err := verifyPeerHeadAncestry(cfg, lower, higher, bundle, strings.Repeat("f", 64), time.Now().UTC()); err == nil {
		t.Fatal("snapshot above the lower head must not substitute for ancestry proof")
	}
}

func TestPeerAncestryRequiresProofToBeginAtLowerPlusOne(t *testing.T) {
	cfg, lower, higher, bundle := finalityAncestryFixture(t)
	bundle.FinalityProofs[0].Header.Height = lower.Head.LatestHeight + 2
	if _, err := verifyPeerHeadAncestry(cfg, lower, higher, bundle, strings.Repeat("f", 64), time.Now().UTC()); err == nil {
		t.Fatal("ancestry proof with a missing first height must be rejected")
	}
}
