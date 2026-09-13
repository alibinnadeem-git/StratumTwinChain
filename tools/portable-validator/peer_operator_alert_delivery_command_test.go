package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPeerOperatorAlertDeliveryStatusReadsWithoutMutation(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = false
	dir := t.TempDir()
	if err := writeJSON(filepath.Join(dir, "config.json"), cfg, 0o600); err != nil {
		t.Fatal(err)
	}
	journalPath := filepath.Join(dir, "state", "peer-operator-alert-deliveries.json")
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	journal.Receipts = []PeerOperatorAlertDeliveryReceipt{
		{
			ReceiptID:    strings.Repeat("a", 64),
			AlertID:      strings.Repeat("b", 64),
			EndpointHash: strings.Repeat("c", 64),
			HTTPStatus:   200,
			Succeeded:    true,
			AttemptedAt:  time.Unix(1, 0).UTC().Format(time.RFC3339Nano),
		},
		{
			ReceiptID:    strings.Repeat("d", 64),
			AlertID:      strings.Repeat("e", 64),
			EndpointHash: strings.Repeat("f", 64),
			HTTPStatus:   503,
			Succeeded:    false,
			AttemptedAt:  time.Unix(2, 0).UTC().Format(time.RFC3339Nano),
		},
	}
	if err := savePeerOperatorAlertDeliveryJournalAtomic(journalPath, journal, cfg); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(journalPath)
	if err != nil {
		t.Fatal(err)
	}

	loaded, err := loadPeerOperatorAlertDeliveryJournal(journalPath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	status := PeerOperatorAlertDeliveryStatus{
		ProfileVersion:      loaded.ProfileVersion,
		ChainID:             loaded.ChainID,
		GenesisDIRHash:      loaded.GenesisDIRHash,
		ProtocolVersion:     loaded.ProtocolVersion,
		ConsensusAuthority:  false,
		SafetyStateMutation: false,
		Receipts:            append([]PeerOperatorAlertDeliveryReceipt(nil), loaded.Receipts...),
	}
	for _, receipt := range status.Receipts {
		status.TotalAttempts++
		if receipt.Succeeded {
			status.Successful++
		} else {
			status.Failed++
		}
	}
	if status.TotalAttempts != 2 || status.Successful != 1 || status.Failed != 1 || status.ConsensusAuthority || status.SafetyStateMutation {
		t.Fatalf("unexpected delivery status: %+v", status)
	}
	if _, err := json.Marshal(status); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(journalPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("reading delivery status must not mutate the delivery journal")
	}
}

func TestDeliveryStatusFilterIsReadOnlyAndExact(t *testing.T) {
	wanted := strings.Repeat("a", 64)
	other := strings.Repeat("b", 64)
	receipts := []PeerOperatorAlertDeliveryReceipt{
		{AlertID: wanted, Succeeded: true},
		{AlertID: other, Succeeded: false},
	}
	var matches []PeerOperatorAlertDeliveryReceipt
	for _, receipt := range receipts {
		if strings.EqualFold(receipt.AlertID, wanted) {
			matches = append(matches, receipt)
		}
	}
	if len(matches) != 1 || matches[0].AlertID != wanted {
		t.Fatalf("unexpected filtered receipts: %+v", matches)
	}
}

func TestPeerOperatorAlertDeliveryRetryStatusIsEndpointScopedAndReadOnly(t *testing.T) {
	cfg := testPeerSyncConfig()
	now := time.Unix(30_000, 0).UTC()
	endpointHash := strings.Repeat("c", 64)
	otherEndpointHash := strings.Repeat("d", 64)
	first, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "retry-first", "retry-first", now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	second, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "HEAD_EQUIVOCATION", "validator-b", strings.Repeat("e", 64), "delivered-second", "delivered-second", now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	third, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "PROOF_HEAD_MISMATCH", "validator-c", strings.Repeat("f", 64), "ack-third", "ack-third", now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{first, second, third}
	alerts.Acknowledgements = []PeerOperatorAlertAcknowledgement{{AlertID: third.AlertID}}
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{
		ReceiptID:    strings.Repeat("1", 64),
		AlertID:      first.AlertID,
		EndpointHash: endpointHash,
		HTTPStatus:   503,
		Succeeded:    false,
		AttemptedAt:  now.Add(-30 * time.Second).Format(time.RFC3339Nano),
	})
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{
		ReceiptID:    strings.Repeat("2", 64),
		AlertID:      second.AlertID,
		EndpointHash: endpointHash,
		HTTPStatus:   204,
		Succeeded:    true,
		AttemptedAt:  now.Add(-time.Minute).Format(time.RFC3339Nano),
	})
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{
		ReceiptID:    strings.Repeat("3", 64),
		AlertID:      first.AlertID,
		EndpointHash: otherEndpointHash,
		HTTPStatus:   204,
		Succeeded:    true,
		AttemptedAt:  now.Add(-time.Minute).Format(time.RFC3339Nano),
	})

	status, err := peerOperatorAlertDeliveryRetryStatus(alerts, deliveries, endpointHash, "", now)
	if err != nil {
		t.Fatal(err)
	}
	if len(status) != 3 {
		t.Fatalf("expected three alert retry status entries, got %d", len(status))
	}
	if status[0].Delivered || status[0].Acknowledged || status[0].FailureCount != 1 || status[0].RetryEligible || status[0].NextRetryAt == "" {
		t.Fatalf("unexpected deferred retry status: %+v", status[0])
	}
	if !status[1].Delivered || status[1].RetryEligible {
		t.Fatalf("successful endpoint delivery must suppress retry: %+v", status[1])
	}
	if !status[2].Acknowledged || status[2].RetryEligible {
		t.Fatalf("acknowledged alert must suppress automatic retry: %+v", status[2])
	}

	filtered, err := peerOperatorAlertDeliveryRetryStatus(alerts, deliveries, endpointHash, first.AlertID, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if len(filtered) != 1 || filtered[0].AlertID != first.AlertID || !filtered[0].RetryEligible {
		t.Fatalf("expected first alert to become retry eligible after delay: %+v", filtered)
	}
	if deliveries.ConsensusAuthority {
		t.Fatal("retry status must not alter delivery authority")
	}
}
