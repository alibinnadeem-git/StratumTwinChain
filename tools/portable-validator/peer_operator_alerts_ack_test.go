package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPeerOperatorAlertAcknowledgementIsAppendOnlyAndIdempotent(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alerts.json")
	alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "operator review required", "conflict-ack-test", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := appendPeerOperatorAlert(path, cfg, alert); err != nil {
		t.Fatal(err)
	}
	journal, err := acknowledgePeerOperatorAlert(path, cfg, alert.AlertID, "operator-a", "reviewed", time.Unix(101, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Entries) != 1 || journal.Entries[0].AlertID != alert.AlertID {
		t.Fatal("acknowledgement must not replace or remove the original alert")
	}
	if len(journal.Acknowledgements) != 1 {
		t.Fatalf("expected one acknowledgement, got %+v", journal.Acknowledgements)
	}
	firstAck := journal.Acknowledgements[0]
	journal, err = acknowledgePeerOperatorAlert(path, cfg, alert.AlertID, "operator-b", "second acknowledgement attempt", time.Unix(102, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Acknowledgements) != 1 || journal.Acknowledgements[0].AcknowledgementID != firstAck.AcknowledgementID {
		t.Fatal("an already acknowledged alert must remain single-ack and append-only")
	}
}

func TestPeerOperatorAlertAcknowledgementRejectsUnknownAlert(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alerts.json")
	unknown := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := acknowledgePeerOperatorAlert(path, cfg, unknown, "operator-a", "", time.Unix(100, 0).UTC()); err == nil {
		t.Fatal("unknown alert acknowledgement must be rejected")
	}
}

func TestPeerOperatorAlertAcknowledgementDoesNotReleaseQuarantine(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	alertPath := filepath.Join(dir, "peer-operator-alerts.json")
	quarantinePath := filepath.Join(dir, "peer-quarantine.json")
	evidence, err := newPeerEvidence(cfg, "validator-d", "HEAD_EQUIVOCATION", 12, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "same authenticated peer reported incompatible finalized heads", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := quarantinePeerFromEvidence(quarantinePath, cfg, evidence, time.Unix(101, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	alert, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", evidence.EvidenceType, evidence.PeerValidatorID, evidence.EvidenceHash, evidence.Detail, evidence.EvidenceHash, time.Unix(101, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := appendPeerOperatorAlert(alertPath, cfg, alert); err != nil {
		t.Fatal(err)
	}
	if _, err := acknowledgePeerOperatorAlert(alertPath, cfg, alert.AlertID, "operator-a", "reviewed only", time.Unix(102, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	state, err := loadPeerQuarantineState(quarantinePath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	entry, ok := state.Peers["validator-d"]
	if !ok || entry.Status != "QUARANTINED" {
		t.Fatalf("alert acknowledgement must not release quarantine: %+v", state.Peers)
	}
}
