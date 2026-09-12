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
		ProfileVersion:     loaded.ProfileVersion,
		ChainID:            loaded.ChainID,
		GenesisDIRHash:     loaded.GenesisDIRHash,
		ProtocolVersion:    loaded.ProtocolVersion,
		ConsensusAuthority: false,
		Receipts:           append([]PeerOperatorAlertDeliveryReceipt(nil), loaded.Receipts...),
	}
	for _, receipt := range status.Receipts {
		status.TotalAttempts++
		if receipt.Succeeded {
			status.Successful++
		} else {
			status.Failed++
		}
	}
	if status.TotalAttempts != 2 || status.Successful != 1 || status.Failed != 1 || status.ConsensusAuthority {
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
