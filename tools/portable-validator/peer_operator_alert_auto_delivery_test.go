package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestPendingPeerOperatorAlertsForWebhookSkipsAcknowledgedAndSuccessful(t *testing.T) {
	cfg := testPeerSyncConfig()
	endpointHash := strings.Repeat("e", 64)
	otherEndpointHash := strings.Repeat("d", 64)
	now := time.Unix(1000, 0).UTC()
	first, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "first", "first", now)
	if err != nil {
		t.Fatal(err)
	}
	second, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "HEAD_EQUIVOCATION", "validator-b", strings.Repeat("a", 64), "second", "second", now)
	if err != nil {
		t.Fatal(err)
	}
	third, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "PROOF_HEAD_MISMATCH", "validator-c", strings.Repeat("b", 64), "third", "third", now)
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{first, second, third}
	alerts.Acknowledgements = []PeerOperatorAlertAcknowledgement{{AlertID: second.AlertID}}
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	deliveries.Receipts = []PeerOperatorAlertDeliveryReceipt{
		{AlertID: first.AlertID, EndpointHash: endpointHash, Succeeded: true},
		{AlertID: third.AlertID, EndpointHash: endpointHash, Succeeded: false},
		{AlertID: third.AlertID, EndpointHash: otherEndpointHash, Succeeded: true},
	}
	pending := pendingPeerOperatorAlertsForWebhook(alerts, deliveries, endpointHash)
	if len(pending) != 1 || pending[0].AlertID != third.AlertID {
		t.Fatalf("expected only failed current-endpoint alert to remain pending, got %+v", pending)
	}
}

func TestAutoDeliverPendingPeerOperatorAlertsRetriesFailuresWithoutMutatingSafetyState(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = false
	dir := t.TempDir()
	alertPath := filepath.Join(dir, "alerts.json")
	deliveryPath := filepath.Join(dir, "deliveries.json")
	now := time.Unix(2000, 0).UTC()
	for i, key := range []string{"alert-one", "alert-two"} {
		alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", key, key, now.Add(time.Duration(i)*time.Second))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := appendPeerOperatorAlert(alertPath, cfg, alert); err != nil {
			t.Fatal(err)
		}
	}
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			http.Error(w, "temporary failure", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	webhook, err := validateOperatorAlertWebhookURL(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	receipts, deliveryErr := autoDeliverPendingPeerOperatorAlertsContext(context.Background(), server.Client(), cfg, alertPath, deliveryPath, webhook, "", now.Add(time.Minute))
	if deliveryErr == nil {
		t.Fatal("expected joined best-effort error when one automatic delivery fails")
	}
	if len(receipts) != 2 {
		t.Fatalf("expected both delivery attempts to be journaled, got %d", len(receipts))
	}
	journal, err := loadPeerOperatorAlertDeliveryJournal(deliveryPath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(journal.Receipts) != 2 || journal.Receipts[0].Succeeded || !journal.Receipts[1].Succeeded {
		t.Fatalf("unexpected automatic delivery receipts: %+v", journal.Receipts)
	}
	alerts, err := loadPeerOperatorAlertJournal(alertPath, cfg)
	if err != nil {
		t.Fatal(err)
	}
	pending := pendingPeerOperatorAlertsForWebhook(alerts, journal, operatorAlertEndpointHash(webhook))
	if len(pending) != 1 || pending[0].AlertID != journal.Receipts[0].AlertID {
		t.Fatalf("failed alert should remain retryable while successful alert is suppressed: %+v", pending)
	}
	if journal.ConsensusAuthority || journal.Receipts[0].SafetyStateMutation || journal.Receipts[1].SafetyStateMutation {
		t.Fatal("automatic delivery must remain non-authoritative and non-mutating")
	}
}

func TestAppendOperatorAlertDeliveryReceiptEnforcesHardCap(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "deliveries.json")
	alertID := strings.Repeat("a", 64)
	endpointHash := strings.Repeat("b", 64)
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	for i := 0; i < peerOperatorAlertDeliveryMaxReceipts; i++ {
		attemptedAt := time.Unix(int64(i+1), 0).UTC()
		journal.Receipts = append(journal.Receipts, PeerOperatorAlertDeliveryReceipt{
			ReceiptID:    operatorAlertDeliveryReceiptID(cfg, alertID, endpointHash, attemptedAt),
			AlertID:      alertID,
			EndpointHash: endpointHash,
			HTTPStatus:   http.StatusOK,
			Succeeded:    true,
			AttemptedAt:  attemptedAt.Format(time.RFC3339Nano),
		})
	}
	if err := savePeerOperatorAlertDeliveryJournalAtomic(path, journal, cfg); err != nil {
		t.Fatal(err)
	}
	latestAt := time.Unix(int64(peerOperatorAlertDeliveryMaxReceipts+1), 0).UTC()
	latest := PeerOperatorAlertDeliveryReceipt{
		ReceiptID:    operatorAlertDeliveryReceiptID(cfg, alertID, endpointHash, latestAt),
		AlertID:      alertID,
		EndpointHash: endpointHash,
		HTTPStatus:   http.StatusOK,
		Succeeded:    true,
		AttemptedAt:  latestAt.Format(time.RFC3339Nano),
	}
	if err := appendPeerOperatorAlertDeliveryReceipt(path, cfg, latest); err != nil {
		t.Fatal(err)
	}
	bounded, err := loadPeerOperatorAlertDeliveryJournal(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(bounded.Receipts) != peerOperatorAlertDeliveryMaxReceipts {
		t.Fatalf("expected hard cap %d, got %d", peerOperatorAlertDeliveryMaxReceipts, len(bounded.Receipts))
	}
	if bounded.Receipts[0].AttemptedAt != time.Unix(2, 0).UTC().Format(time.RFC3339Nano) {
		t.Fatalf("expected oldest receipt to be pruned, got first timestamp %s", bounded.Receipts[0].AttemptedAt)
	}
	if bounded.Receipts[len(bounded.Receipts)-1].ReceiptID != latest.ReceiptID {
		t.Fatal("newest appended receipt must be retained")
	}
}
