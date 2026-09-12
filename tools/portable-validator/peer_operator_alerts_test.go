package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPeerOperatorAlertJournalIsTrustBoundAndNonAuthoritative(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alerts.json")
	alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "operator review required", "conflict-42", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := appendPeerOperatorAlert(path, cfg, alert); err != nil {
		t.Fatal(err)
	}
	journal, err := loadPeerOperatorAlertJournal(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if journal.ConsensusAuthority {
		t.Fatal("operator alerts must never carry consensus authority")
	}
	if len(journal.Entries) != 1 || journal.Entries[0].AlertID != alert.AlertID {
		t.Fatalf("unexpected alert journal: %+v", journal)
	}
	foreign := cfg
	foreign.ChainID += "-foreign"
	if _, err := loadPeerOperatorAlertJournal(path, foreign); err == nil {
		t.Fatal("foreign trust context must be rejected")
	}
}

func TestPeerOperatorAlertJournalDeduplicatesDeterministicAlert(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alerts.json")
	first, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "operator review required", "same-source", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	second, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "operator review required", "same-source", time.Unix(200, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if first.AlertID != second.AlertID {
		t.Fatal("same safety source must derive the same deterministic alert ID")
	}
	if _, err := appendPeerOperatorAlert(path, cfg, first); err != nil {
		t.Fatal(err)
	}
	journal, err := appendPeerOperatorAlert(path, cfg, second)
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Entries) != 1 {
		t.Fatalf("duplicate alert must not be appended: %+v", journal.Entries)
	}
}

func TestPersistFollowerOperatorAlertsUsesObjectiveEvidence(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alerts.json")
	evidence, err := newPeerEvidence(cfg, "validator-d", "HEAD_EQUIVOCATION", 12, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "same authenticated peer reported incompatible finalized heads", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	result := PeerFollowerCycleResult{
		Resolution:             PeerResolveResult{Classification: "FINALIZED_HEAD_CONFLICT", AutoAdvanceAllowed: false},
		CrossRunSafetyEvidence: []PeerEvidence{evidence},
	}
	if err := persistFollowerOperatorAlerts(path, cfg, result, time.Unix(101, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	journal, err := loadPeerOperatorAlertJournal(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Entries) != 2 {
		t.Fatalf("expected quarantine and safety-halt alerts, got %+v", journal.Entries)
	}
	seenQuarantine := false
	seenHalt := false
	for _, alert := range journal.Entries {
		switch alert.AlertType {
		case "PEER_QUARANTINED":
			seenQuarantine = alert.EvidenceHash == evidence.EvidenceHash && alert.PeerValidatorID == "validator-d"
		case "FOLLOWER_SAFETY_HALT":
			seenHalt = alert.Classification == "FINALIZED_HEAD_CONFLICT"
		}
	}
	if !seenQuarantine || !seenHalt {
		t.Fatalf("missing expected operator alerts: %+v", journal.Entries)
	}
}

func TestPeerOperatorAlertJournalRejectsConsensusAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerOperatorAlertJournal(cfg)
	journal.ConsensusAuthority = true
	if err := savePeerOperatorAlertJournalAtomic(filepath.Join(t.TempDir(), "peer-operator-alerts.json"), journal, cfg); err == nil {
		t.Fatal("consensus-authoritative operator alert journal must be rejected")
	}
}
