package main

import (
	"strings"
	"testing"
	"time"
)

func TestPrunePeerOperatorAlertDeliveryReceiptsKeepsNewest(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	for i := 0; i < 5; i++ {
		journal.Receipts = append(journal.Receipts, PeerOperatorAlertDeliveryReceipt{
			ReceiptID:    strings.Repeat(string(rune('a'+i)), 64),
			AlertID:      strings.Repeat("f", 64),
			EndpointHash: strings.Repeat("e", 64),
			HTTPStatus:   200,
			Succeeded:    true,
			AttemptedAt:  time.Unix(int64(i+1), 0).UTC().Format(time.RFC3339Nano),
		})
	}
	pruned, removed, err := prunePeerOperatorAlertDeliveryReceipts(journal, 3)
	if err != nil {
		t.Fatal(err)
	}
	if removed != 2 || len(pruned.Receipts) != 3 {
		t.Fatalf("unexpected retention result: removed=%d retained=%d", removed, len(pruned.Receipts))
	}
	if pruned.Receipts[0].AttemptedAt != time.Unix(3, 0).UTC().Format(time.RFC3339Nano) {
		t.Fatalf("expected oldest retained receipt to be third attempt, got %s", pruned.Receipts[0].AttemptedAt)
	}
}

func TestPrunePeerOperatorAlertDeliveryReceiptsDoesNotTouchOtherSafetyState(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	journal.Receipts = []PeerOperatorAlertDeliveryReceipt{
		{ReceiptID: strings.Repeat("a", 64), AlertID: strings.Repeat("b", 64), EndpointHash: strings.Repeat("c", 64), AttemptedAt: time.Unix(1, 0).UTC().Format(time.RFC3339Nano)},
		{ReceiptID: strings.Repeat("d", 64), AlertID: strings.Repeat("b", 64), EndpointHash: strings.Repeat("c", 64), AttemptedAt: time.Unix(2, 0).UTC().Format(time.RFC3339Nano)},
	}
	pruned, removed, err := prunePeerOperatorAlertDeliveryReceipts(journal, 1)
	if err != nil {
		t.Fatal(err)
	}
	if removed != 1 || len(pruned.Receipts) != 1 {
		t.Fatalf("unexpected retention result: %+v", pruned)
	}
	if pruned.ConsensusAuthority {
		t.Fatal("retention must never grant consensus authority")
	}
}

func TestPrunePeerOperatorAlertDeliveryReceiptsRejectsForbiddenAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	journal.ConsensusAuthority = true
	if _, _, err := prunePeerOperatorAlertDeliveryReceipts(journal, 1); err == nil {
		t.Fatal("retention must reject authority-bearing journal")
	}
	journal.ConsensusAuthority = false
	journal.Receipts = []PeerOperatorAlertDeliveryReceipt{{
		ReceiptID:           strings.Repeat("a", 64),
		AlertID:             strings.Repeat("b", 64),
		EndpointHash:        strings.Repeat("c", 64),
		AttemptedAt:         time.Unix(1, 0).UTC().Format(time.RFC3339Nano),
		SafetyStateMutation: true,
	}}
	if _, _, err := prunePeerOperatorAlertDeliveryReceipts(journal, 1); err == nil {
		t.Fatal("retention must reject safety-mutating receipt")
	}
}

func TestPrunePeerOperatorAlertDeliveryReceiptsRejectsMalformedTimestamp(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	journal.Receipts = []PeerOperatorAlertDeliveryReceipt{
		{ReceiptID: strings.Repeat("a", 64), AlertID: strings.Repeat("b", 64), EndpointHash: strings.Repeat("c", 64), AttemptedAt: "bad-time"},
		{ReceiptID: strings.Repeat("d", 64), AlertID: strings.Repeat("b", 64), EndpointHash: strings.Repeat("c", 64), AttemptedAt: time.Unix(2, 0).UTC().Format(time.RFC3339Nano)},
	}
	if _, _, err := prunePeerOperatorAlertDeliveryReceipts(journal, 1); err == nil {
		t.Fatal("retention must fail closed on malformed receipt timestamp")
	}
}
