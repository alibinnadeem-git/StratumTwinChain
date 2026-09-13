package main

import (
	"os"
	"path/filepath"
	"testing"
)

func healthEntryByName(t *testing.T, report PeerStateHealthReport, name string) PeerStateHealthEntry {
	t.Helper()
	for _, entry := range report.Entries {
		if entry.Name == name {
			return entry
		}
	}
	t.Fatalf("health report missing entry %q", name)
	return PeerStateHealthEntry{}
}

func TestPeerStateHealthDistinguishesMissingSafeDefaults(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	report := inspectPeerStateHealth(dir, cfg)
	if report.OverallStatus != "HEALTHY" || report.InvalidCount != 0 || report.MutationPerformed {
		t.Fatalf("unexpected empty-state health report: %+v", report)
	}
	if report.VoteAuthority || report.ConsensusParticipation {
		t.Fatal("state health report crossed the non-participation boundary")
	}
	for _, name := range []string{"trusted-head", "peer-session-replay", "peer-evidence", "peer-quarantine", "authenticated-peer-heads", "peer-reliability", "proof-cache-manifest"} {
		entry := healthEntryByName(t, report, name)
		if entry.Status != "MISSING_SAFE_DEFAULT" || !entry.SafeDefault {
			t.Fatalf("expected safe-default missing state for %s, got %+v", name, entry)
		}
	}
	follower := healthEntryByName(t, report, "follower-status")
	if follower.Status != "MISSING_OPTIONAL" || follower.SafeDefault {
		t.Fatalf("follower status should be optional missing observability state, got %+v", follower)
	}
}

func TestPeerStateHealthReportsCorruptionWithoutMutation(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	path := filepath.Join(dir, "state", "peer-sync-head.json")
	writeCorruptStateFile(t, path)
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	report := inspectPeerStateHealth(dir, cfg)
	entry := healthEntryByName(t, report, "trusted-head")
	if report.OverallStatus != "INVALID_PERSISTED_STATE" || report.InvalidCount != 1 || entry.Status != "INVALID" || entry.Error == "" {
		t.Fatalf("corrupt trusted head was not surfaced correctly: report=%+v entry=%+v", report, entry)
	}
	if !entry.Authoritative {
		t.Fatal("trusted-head health entry must remain marked authority-bearing")
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) || report.MutationPerformed {
		t.Fatal("peer-state-health mutated corrupt persisted state")
	}
}

func TestPeerStateHealthRejectsAuthorityEscalationMetadata(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	stateDir := filepath.Join(dir, "state")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	reliability := defaultPeerReliabilityState(cfg)
	reliability.ConsensusWeighting = true
	if err := writeJSON(filepath.Join(stateDir, "peer-reliability.json"), reliability, 0o600); err != nil {
		t.Fatal(err)
	}
	report := inspectPeerStateHealth(dir, cfg)
	entry := healthEntryByName(t, report, "peer-reliability")
	if entry.Status != "INVALID" || report.OverallStatus != "INVALID_PERSISTED_STATE" {
		t.Fatalf("consensus-weighting escalation was not surfaced as invalid: %+v", report)
	}
	if entry.Authoritative {
		t.Fatal("advisory reliability state must not be marked authority-bearing")
	}
}
