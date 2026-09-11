package main

import (
	"strings"
	"testing"
)

func multiHead(peer string, height int64, hash string) PeerHeadObservation {
	return PeerHeadObservation{
		PeerValidatorID: peer,
		TargetURL:       "https://" + peer + ".example",
		Head: PeerSyncHeadResponse{
			ProfileVersion:   peerSyncProfile,
			ResponseType:     "SYNC_HEAD",
			ChainID:          "stratum-test",
			GenesisDIRHash:   strings.Repeat("a", 64),
			ProtocolVersion:  "POVI/1",
			LatestHeight:     height,
			LatestDIRHash:    hash,
			LatestStateRoot:  strings.Repeat("c", 64),
			ValidatorSetRoot: strings.Repeat("d", 64),
		},
	}
}

func TestMultiPeerSurveyExactAgreementAllowsAdvance(t *testing.T) {
	h := strings.Repeat("b", 64)
	s := classifyPeerHeads([]PeerHeadObservation{
		multiHead("validator-a", 42, h),
		multiHead("validator-b", 42, h),
		multiHead("validator-c", 42, h),
	})
	if s.Classification != "EXACT_HEAD_AGREEMENT" || !s.AutoAdvanceAllowed {
		t.Fatalf("expected exact agreement, got %#v", s)
	}
}

func TestMultiPeerSurveySameHeightDifferentHashIsConflict(t *testing.T) {
	s := classifyPeerHeads([]PeerHeadObservation{
		multiHead("validator-a", 42, strings.Repeat("b", 64)),
		multiHead("validator-b", 42, strings.Repeat("e", 64)),
		multiHead("validator-c", 42, strings.Repeat("b", 64)),
	})
	if s.Classification != "FINALIZED_HEAD_CONFLICT" || s.AutoAdvanceAllowed {
		t.Fatalf("expected finalized-head conflict, got %#v", s)
	}
	if len(s.Conflicts) != 1 || s.Conflicts[0].Height != 42 {
		t.Fatalf("expected one conflict at height 42, got %#v", s.Conflicts)
	}
}

func TestMultiPeerSurveyHeightSkewRequiresProofAncestry(t *testing.T) {
	s := classifyPeerHeads([]PeerHeadObservation{
		multiHead("validator-a", 41, strings.Repeat("b", 64)),
		multiHead("validator-b", 42, strings.Repeat("e", 64)),
		multiHead("validator-c", 42, strings.Repeat("e", 64)),
	})
	if s.Classification != "UNRESOLVED_HEIGHT_SKEW" || s.AutoAdvanceAllowed {
		t.Fatalf("height skew must not be treated as harmless lag from head claims alone: %#v", s)
	}
}

func TestMultiPeerSurveyNoPeersBlocksAdvance(t *testing.T) {
	s := classifyPeerHeads(nil)
	if s.Classification != "NO_AUTHENTICATED_PEERS" || s.AutoAdvanceAllowed {
		t.Fatalf("expected no-peer block, got %#v", s)
	}
}

func TestValidateRemoteSyncHeadRejectsForeignChain(t *testing.T) {
	cfg := testPeerSyncConfig()
	head := PeerSyncHeadResponse{
		ProfileVersion:   peerSyncProfile,
		ResponseType:     "SYNC_HEAD",
		ChainID:          "foreign-chain",
		GenesisDIRHash:   cfg.GenesisDIRHash,
		ProtocolVersion:  cfg.ProtocolVersion,
		LatestHeight:     1,
		LatestDIRHash:    strings.Repeat("b", 64),
		LatestStateRoot:  strings.Repeat("c", 64),
		ValidatorSetRoot: strings.Repeat("d", 64),
	}
	if err := validateRemoteSyncHead(cfg, head); err == nil {
		t.Fatal("expected foreign-chain head to be rejected")
	}
}
