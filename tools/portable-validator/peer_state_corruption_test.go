package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeCorruptStateFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"truncated":`), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestPeerSessionStateCorruptionFailsClosed(t *testing.T) {
	for _, tc := range []struct {
		name    string
		content string
	}{
		{name: "malformed", content: `{not-json}`},
		{name: "truncated", content: `{"profileVersion":"STRATUM-PEER-SESSION/1","chainId":"stratum-devnet-1","outboundSequence":42`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "peer-session.json")
			if err := os.WriteFile(path, []byte(tc.content), 0o600); err != nil {
				t.Fatal(err)
			}
			state, err := loadPeerSessionState(path, "stratum-devnet-1")
			if err == nil {
				t.Fatalf("existing corrupt peer session state must fail closed, got state: %+v", state)
			}
		}
	}
}

func TestPeerSessionStateTrustContextCorruptionFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "peer-session.json")
	state := defaultPeerSessionState("stratum-devnet-1")
	state.ProfileVersion = "STRATUM-PEER-SESSION/999"
	if err := writeJSON(path, state, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadPeerSessionState(path, "stratum-devnet-1"); err == nil {
		t.Fatal("existing peer session state with an unsupported profile must fail closed")
	}
}

func TestPeerSessionReplayTrustContextCorruptionFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "peer-session.json")
	state := defaultPeerSessionState("stratum-devnet-1")
	state.OutboundSequence = 77
	state.Replay.ChainID = "foreign-chain"
	if err := writeJSON(path, state, 0o600); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadPeerSessionState(path, "stratum-devnet-1")
	if err == nil {
		t.Fatalf("embedded replay trust-context corruption must fail closed instead of returning sequence %d", loaded.OutboundSequence)
	}
}

func TestPeerSyncTrustedHeadCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	for _, tc := range []struct {
		name    string
		content string
	}{
		{name: "malformed", content: `{not-json}`},
		{name: "truncated", content: `{"profileVersion":"STRATUM-PEER-SYNC/1","chainId":"stratum-test","height":27`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "peer-sync-head.json")
			if err := os.WriteFile(path, []byte(tc.content), 0o600); err != nil {
				t.Fatal(err)
			}
			head, err := loadPeerSyncTrustedHead(path, cfg)
			if err == nil {
				t.Fatalf("existing corrupt trusted head must fail closed rather than fall back to Genesis: %+v", head)
			}
		}
	}
}

func TestPeerSyncTrustedHeadInvalidRecordFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-sync-head.json")
	head := defaultPeerSyncTrustedHead(cfg)
	head.Height = 12
	head.DIRHash = "not-a-sha256"
	if err := writeJSON(path, head, 0o600); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadPeerSyncTrustedHead(path, cfg)
	if err == nil {
		t.Fatalf("invalid existing trusted-head record must fail closed instead of returning %+v", loaded)
	}
}

func TestPeerEvidenceJournalCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-evidence.json")
	writeCorruptStateFile(t, path)
	if journal, err := loadPeerEvidenceJournal(path, cfg); err == nil {
		t.Fatalf("existing corrupt evidence journal must fail closed, got %+v", journal)
	}
}

func TestPeerQuarantineStateCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-quarantine.json")
	writeCorruptStateFile(t, path)
	if state, err := loadPeerQuarantineState(path, cfg); err == nil {
		t.Fatalf("existing corrupt quarantine state must fail closed, got %+v", state)
	}
}

func TestPeerHeadStateCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-heads.json")
	writeCorruptStateFile(t, path)
	if state, err := loadPeerHeadState(path, cfg); err == nil {
		t.Fatalf("existing corrupt authenticated peer-head state must fail closed, got %+v", state)
	}
}

func TestPeerFollowerStatusCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-follower-status.json")
	writeCorruptStateFile(t, path)
	if status, err := loadPeerFollowerStatus(path, cfg); err == nil {
		t.Fatalf("existing corrupt follower status must fail closed, got %+v", status)
	}
}

func TestPeerFollowerStatusAuthorityEscalationFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-follower-status.json")
	status := newPeerFollowerStatus(cfg, "RUNNING", time.Unix(1_800_000_000, 0).UTC())
	status.VoteAuthority = true
	if err := writeJSON(path, status, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadPeerFollowerStatus(path, cfg); err == nil {
		t.Fatal("persisted follower status claiming vote authority must fail closed")
	}
}

func TestPeerReliabilityCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-reliability.json")
	writeCorruptStateFile(t, path)
	if state, err := loadPeerReliabilityState(path, cfg); err == nil {
		t.Fatalf("existing corrupt reliability state must fail closed, got %+v", state)
	}
}

func TestPeerReliabilityConsensusWeightingEscalationFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-reliability.json")
	state := defaultPeerReliabilityState(cfg)
	state.ConsensusWeighting = true
	if err := writeJSON(path, state, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadPeerReliabilityState(path, cfg); err == nil {
		t.Fatal("persisted reliability state claiming consensus weighting must fail closed")
	}
}

func TestProofCacheManifestCorruptionFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	cacheDir := filepath.Join(t.TempDir(), "peer-proof-cache")
	path := filepath.Join(cacheDir, peerProofCacheManifestName)
	writeCorruptStateFile(t, path)
	if manifest, err := loadPeerProofCacheManifest(cacheDir, cfg); err == nil {
		t.Fatalf("existing corrupt proof-cache manifest must fail closed, got %+v", manifest)
	}
}

func TestProofCacheAuthorityEscalationFailsClosed(t *testing.T) {
	cfg := testPeerSyncConfig()
	cacheDir := filepath.Join(t.TempDir(), "peer-proof-cache")
	if err := os.MkdirAll(cacheDir, 0o700); err != nil {
		t.Fatal(err)
	}
	manifest := defaultPeerProofCacheManifest(cfg)
	manifest.ConsensusAuthority = true
	if err := writeJSON(filepath.Join(cacheDir, peerProofCacheManifestName), manifest, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadPeerProofCacheManifest(cacheDir, cfg); err == nil {
		t.Fatal("proof-cache manifest claiming consensus authority must fail closed")
	}
}
