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

func applyDeliveryReceiptForTest(t *testing.T, journal *PeerOperatorAlertDeliveryJournal, receipt PeerOperatorAlertDeliveryReceipt) {
	t.Helper()
	if receipt.ReceiptID == "" {
		receipt.ReceiptID = strings.Repeat("1", 64)
	}
	if receipt.AttemptedAt == "" {
		receipt.AttemptedAt = time.Unix(1, 0).UTC().Format(time.RFC3339Nano)
	}
	if err := applyPeerOperatorAlertDeliveryReceiptState(journal, receipt); err != nil {
		t.Fatal(err)
	}
	journal.Receipts = append(journal.Receipts, receipt)
}

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
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{ReceiptID: strings.Repeat("1", 64), AlertID: first.AlertID, EndpointHash: endpointHash, Succeeded: true, AttemptedAt: now.Format(time.RFC3339Nano)})
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{ReceiptID: strings.Repeat("2", 64), AlertID: third.AlertID, EndpointHash: endpointHash, Succeeded: false, AttemptedAt: now.Add(time.Second).Format(time.RFC3339Nano)})
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{ReceiptID: strings.Repeat("3", 64), AlertID: third.AlertID, EndpointHash: otherEndpointHash, Succeeded: true, AttemptedAt: now.Add(2 * time.Second).Format(time.RFC3339Nano)})
	pending := pendingPeerOperatorAlertsForWebhook(alerts, deliveries, endpointHash)
	if len(pending) != 1 || pending[0].AlertID != third.AlertID {
		t.Fatalf("expected only failed current-endpoint alert to remain pending, got %+v", pending)
	}
}

func TestEligiblePeerOperatorAlertsForWebhookAppliesBoundedBackoffWithoutDropping(t *testing.T) {
	cfg := testPeerSyncConfig()
	endpointHash := strings.Repeat("e", 64)
	now := time.Unix(10_000, 0).UTC()
	alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "retry-alert", "retry-alert", now.Add(-2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{alert}
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	lastFailure := now.Add(-30 * time.Second)
	applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{ReceiptID: strings.Repeat("1", 64), AlertID: alert.AlertID, EndpointHash: endpointHash, Succeeded: false, AttemptedAt: lastFailure.Format(time.RFC3339Nano)})

	eligible, err := eligiblePeerOperatorAlertsForWebhookAt(alerts, deliveries, endpointHash, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(eligible) != 0 {
		t.Fatalf("first failure should defer retry for %s", peerOperatorAlertRetryBaseDelay)
	}
	eligible, err = eligiblePeerOperatorAlertsForWebhookAt(alerts, deliveries, endpointHash, lastFailure.Add(peerOperatorAlertRetryBaseDelay))
	if err != nil {
		t.Fatal(err)
	}
	if len(eligible) != 1 || eligible[0].AlertID != alert.AlertID {
		t.Fatalf("alert must become retryable after bounded delay, got %+v", eligible)
	}

	for i := 0; i < 16; i++ {
		failureAt := now.Add(-peerOperatorAlertRetryMaxDelay).Add(-time.Duration(i) * time.Second)
		applyDeliveryReceiptForTest(t, &deliveries, PeerOperatorAlertDeliveryReceipt{
			ReceiptID:    strings.Repeat(string(rune('a'+i%6)), 64),
			AlertID:      alert.AlertID,
			EndpointHash: endpointHash,
			Succeeded:    false,
			AttemptedAt:  failureAt.Format(time.RFC3339Nano),
		})
	}
	if delay := peerOperatorAlertRetryDelay(100); delay != peerOperatorAlertRetryMaxDelay {
		t.Fatalf("retry delay must cap at %s, got %s", peerOperatorAlertRetryMaxDelay, delay)
	}
	eligible, err = eligiblePeerOperatorAlertsForWebhookAt(alerts, deliveries, endpointHash, now.Add(peerOperatorAlertRetryMaxDelay))
	if err != nil {
		t.Fatal(err)
	}
	if len(eligible) != 1 {
		t.Fatal("repeated failures must never dead-letter or permanently drop the alert")
	}
}

func TestEligiblePeerOperatorAlertsForWebhookRejectsMalformedCompactFailureTimestamp(t *testing.T) {
	cfg := testPeerSyncConfig()
	endpointHash := strings.Repeat("e", 64)
	now := time.Unix(20_000, 0).UTC()
	alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "bad-time", "bad-time", now)
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{alert}
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	deliveries.State[operatorAlertDeliveryStateKey(alert.AlertID, endpointHash)] = PeerOperatorAlertDeliveryState{
		AlertID:         alert.AlertID,
		EndpointHash:    endpointHash,
		FailureCount:    1,
		LatestFailureAt: "not-a-time",
	}
	if _, err := eligiblePeerOperatorAlertsForWebhookAt(alerts, deliveries, endpointHash, now); err == nil {
		t.Fatal("malformed compact retry timestamp must fail closed")
	}
}

func TestDeliveryStateSurvivesReceiptPruningForSuccessAndRetryDepth(t *testing.T) {
	cfg := testPeerSyncConfig()
	endpointHash := strings.Repeat("e", 64)
	now := time.Unix(25_000, 0).UTC()
	deliveredAlert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "delivered", "delivered", now)
	if err != nil {
		t.Fatal(err)
	}
	retryAlert, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "HEAD_EQUIVOCATION", "validator-b", strings.Repeat("a", 64), "retry", "retry", now)
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{deliveredAlert, retryAlert}
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	applyDeliveryReceiptForTest(t, &journal, PeerOperatorAlertDeliveryReceipt{ReceiptID: strings.Repeat("1", 64), AlertID: deliveredAlert.AlertID, EndpointHash: endpointHash, Succeeded: true, AttemptedAt: now.Add(-10 * time.Minute).Format(time.RFC3339Nano)})
	for i := 0; i < 3; i++ {
		applyDeliveryReceiptForTest(t, &journal, PeerOperatorAlertDeliveryReceipt{
			ReceiptID:    strings.Repeat(string(rune('2'+i)), 64),
			AlertID:      retryAlert.AlertID,
			EndpointHash: endpointHash,
			Succeeded:    false,
			AttemptedAt:  now.Add(time.Duration(-3+i) * time.Minute).Format(time.RFC3339Nano),
		})
	}
	pruned, removed, err := prunePeerOperatorAlertDeliveryReceipts(journal, 1)
	if err != nil {
		t.Fatal(err)
	}
	if removed != 3 || len(pruned.Receipts) != 1 {
		t.Fatalf("expected audit receipts to prune independently, removed=%d retained=%d", removed, len(pruned.Receipts))
	}
	deliveredState := pruned.State[operatorAlertDeliveryStateKey(deliveredAlert.AlertID, endpointHash)]
	if !deliveredState.Delivered {
		t.Fatal("successful delivery state must survive pruning of its receipt")
	}
	retryState := pruned.State[operatorAlertDeliveryStateKey(retryAlert.AlertID, endpointHash)]
	if retryState.FailureCount != 3 {
		t.Fatalf("retry depth must survive receipt pruning, got %d", retryState.FailureCount)
	}
	pending := pendingPeerOperatorAlertsForWebhook(alerts, pruned, endpointHash)
	if len(pending) != 1 || pending[0].AlertID != retryAlert.AlertID {
		t.Fatalf("pruning must not resurrect already-delivered alert: %+v", pending)
	}
	latestFailure, err := time.Parse(time.RFC3339Nano, retryState.LatestFailureAt)
	if err != nil {
		t.Fatal(err)
	}
	eligible, err := eligiblePeerOperatorAlertsForWebhookAt(alerts, pruned, endpointHash, latestFailure.Add(2*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if len(eligible) != 0 {
		t.Fatal("three-failure retry state should still enforce four-minute backoff after receipts are pruned")
	}
	eligible, err = eligiblePeerOperatorAlertsForWebhookAt(alerts, pruned, endpointHash, latestFailure.Add(4*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if len(eligible) != 1 || eligible[0].AlertID != retryAlert.AlertID {
		t.Fatal("retry must become eligible at preserved four-minute backoff boundary")
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

func TestAppendOperatorAlertDeliveryReceiptEnforcesHardCapAndPreservesState(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "deliveries.json")
	alertID := strings.Repeat("a", 64)
	endpointHash := strings.Repeat("b", 64)
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	for i := 0; i < peerOperatorAlertDeliveryMaxReceipts; i++ {
		attemptedAt := time.Unix(int64(i+1), 0).UTC()
		receipt := PeerOperatorAlertDeliveryReceipt{
			ReceiptID:    operatorAlertDeliveryReceiptID(cfg, alertID, endpointHash, attemptedAt),
			AlertID:      alertID,
			EndpointHash: endpointHash,
			HTTPStatus:   http.StatusOK,
			Succeeded:    true,
			AttemptedAt:  attemptedAt.Format(time.RFC3339Nano),
		}
		applyDeliveryReceiptForTest(t, &journal, receipt)
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
		t.Fatalf("expected oldest retained receipt to be second attempt, got %s", bounded.Receipts[0].AttemptedAt)
	}
	if bounded.Receipts[len(bounded.Receipts)-1].ReceiptID != latest.ReceiptID {
		t.Fatal("newest appended receipt must be retained")
	}
	state := bounded.State[operatorAlertDeliveryStateKey(alertID, endpointHash)]
	if !state.Delivered || state.LastSuccessAt != latestAt.Format(time.RFC3339Nano) {
		t.Fatalf("compact successful-delivery state must survive receipt cap: %+v", state)
	}
}
