package main

import (
	"os"
	"path/filepath"
	"testing"
)

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
