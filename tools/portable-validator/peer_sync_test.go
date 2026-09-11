package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testPeerSyncConfig() BootstrapConfig {
	return BootstrapConfig{
		BootstrapVersion: bootstrapVersion,
		ValidatorID:      "validator-d",
		FriendlyLabel:    "Validator D",
		ChainID:          "stratum-test",
		NetworkName:      "STRATUM Test",
		GenesisDIRHash:   strings.Repeat("a", 64),
		ProtocolVersion:  "POVI/1",
		State:            candidateState,
		VoteAuthority:    false,
		ActivationBlockedReasons: []string{
			"GOVERNANCE_ACTIVATION_REQUIRED",
			"LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED",
		},
	}
}

func TestPeerSyncRuntimeStartsAtPinnedGenesisWithoutVoteAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	r, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json"))
	if err != nil {
		t.Fatal(err)
	}
	if r.trustedHead.Height != 0 {
		t.Fatalf("expected genesis height 0, got %d", r.trustedHead.Height)
	}
	if r.trustedHead.DIRHash != cfg.GenesisDIRHash {
		t.Fatalf("expected pinned Genesis DIR hash, got %s", r.trustedHead.DIRHash)
	}
	if r.cfg.State != candidateState || r.cfg.VoteAuthority {
		t.Fatal("peer sync runtime crossed the CANDIDATE/voteAuthority=false boundary")
	}
}

func TestPeerSyncRuntimeRejectsVoteAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.VoteAuthority = true
	if _, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json")); err == nil {
		t.Fatal("expected vote-authority runtime to be rejected")
	}
}

func TestPeerSyncRuntimeRejectsActiveState(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = "ACTIVE"
	if _, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json")); err == nil {
		t.Fatal("expected ACTIVE runtime to be rejected")
	}
}

func TestPeerSyncTrustedHeadRejectsForeignTrustContext(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-sync-head.json")
	foreign := defaultPeerSyncTrustedHead(cfg)
	foreign.ChainID = "foreign-chain"
	b, _ := json.Marshal(foreign)
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadPeerSyncTrustedHead(path, cfg); err == nil {
		t.Fatal("expected foreign persisted head to be rejected")
	}
}

func TestSyncHeadAdvertisementDoesNotAdvanceTrust(t *testing.T) {
	cfg := testPeerSyncConfig()
	r, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json"))
	if err != nil {
		t.Fatal(err)
	}
	before := r.trustedHead
	_ = PeerSyncHeadResponse{
		ProfileVersion:  peerSyncProfile,
		ResponseType:    "SYNC_HEAD",
		ChainID:         cfg.ChainID,
		GenesisDIRHash:  cfg.GenesisDIRHash,
		ProtocolVersion: cfg.ProtocolVersion,
		LatestHeight:    999,
		LatestDIRHash:   strings.Repeat("b", 64),
	}
	if r.trustedHead != before {
		t.Fatal("SYNC_HEAD advertisement mutated trusted state")
	}
}

func TestRejectedProofBundleDoesNotPersistOrAdvance(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-sync-head.json")
	r, err := newPeerSyncRuntime(cfg, path)
	if err != nil {
		t.Fatal(err)
	}
	bundle := PeerSyncProofBundle{
		ProfileVersion:  peerSyncProfile,
		ResponseType:    "SYNC_PROOF",
		ChainID:         "wrong-chain",
		GenesisDIRHash:  cfg.GenesisDIRHash,
		ProtocolVersion: cfg.ProtocolVersion,
		ValidatorSet: SnapshotValidatorSet{
			SetVersion: validatorSetProfile,
			ChainID:    cfg.ChainID,
		},
		FinalityProofs: []DIRFinalityProof{{}},
	}
	if _, err := r.applyProofBundle(bundle, "validator-a", time.Now().UTC()); err == nil {
		t.Fatal("expected invalid proof bundle to be rejected")
	}
	if r.trustedHead.Height != 0 || r.trustedHead.DIRHash != cfg.GenesisDIRHash {
		t.Fatal("rejected bundle advanced in-memory trusted head")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("rejected bundle wrote durable trusted-head state")
	}
}

func TestProofBundleCannotExceedDurableVerifiedHead(t *testing.T) {
	cfg := testPeerSyncConfig()
	r, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json"))
	if err != nil {
		t.Fatal(err)
	}
	set := SnapshotValidatorSet{SetVersion: validatorSetProfile, ChainID: cfg.ChainID}
	if err := r.configureServingData(set, nil, nil); err != nil {
		t.Fatal(err)
	}
	_, err = r.proofBundle(PeerSyncProofRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_PROOF", FromHeight: 0, ToHeight: 1}, time.Now().UTC())
	if err == nil {
		t.Fatal("server attempted to serve proof beyond durable verified head")
	}
}

func TestReadOnlySyncEndpointRejectsConsensusBearingTraffic(t *testing.T) {
	cfg := testPeerSyncConfig()
	syncRuntime, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json"))
	if err != nil {
		t.Fatal(err)
	}
	session := &PeerSessionRuntime{cfg: cfg}
	handler := peerSyncHandler(session, syncRuntime)
	for _, messageType := range []string{"PROPOSE", "VERIFY", "COMMIT", "ROUND_CHANGE", "PLC", "PFC"} {
		envelope := PeerEnvelope{MessageType: messageType}
		body, _ := json.Marshal(envelope)
		req := httptest.NewRequest(http.MethodPost, "/v1/peer/message", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("%s should be forbidden at sync boundary; got HTTP %d", messageType, w.Code)
		}
	}
}

func TestPeerSyncHealthExplicitlyReportsNoConsensusParticipation(t *testing.T) {
	cfg := testPeerSyncConfig()
	syncRuntime, err := newPeerSyncRuntime(cfg, filepath.Join(t.TempDir(), "peer-sync-head.json"))
	if err != nil {
		t.Fatal(err)
	}
	session := &PeerSessionRuntime{cfg: cfg}
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	peerSyncHandler(session, syncRuntime).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("unexpected health status %d", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["voteAuthority"] != false || body["consensusParticipation"] != false || body["state"] != candidateState {
		t.Fatalf("health endpoint crossed read-only boundary: %#v", body)
	}
}
