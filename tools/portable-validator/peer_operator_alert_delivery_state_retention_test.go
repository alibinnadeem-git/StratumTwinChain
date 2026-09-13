package main

import (
	"strings"
	"testing"
	"time"
)

func TestPruneAcknowledgedPeerOperatorAlertDeliveryStateRemovesOnlyAcknowledged(t *testing.T) {
	cfg := testPeerSyncConfig()
	now := time.Unix(40_000, 0).UTC()
	ackedAlert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "acked", "acked", now)
	if err != nil {
		t.Fatal(err)
	}
	activeDeliveredAlert, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "HEAD_EQUIVOCATION", "validator-b", strings.Repeat("a", 64), "active-delivered", "active-delivered", now)
	if err != nil {
		t.Fatal(err)
	}
	activeRetryAlert, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", "PROOF_HEAD_MISMATCH", "validator-c", strings.Repeat("b", 64), "active-retry", "active-retry", now)
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{ackedAlert, activeDeliveredAlert, activeRetryAlert}
	alerts.Acknowledgements = []PeerOperatorAlertAcknowledgement{{
		AcknowledgementID: strings.Repeat("c", 64),
		AlertID:           ackedAlert.AlertID,
		Operator:          "operator-a",
		AcknowledgedAt:    now.Add(time.Minute).Format(time.RFC3339Nano),
	}}

	endpointA := strings.Repeat("d", 64)
	endpointB := strings.Repeat("e", 64)
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	states := []PeerOperatorAlertDeliveryState{
		{AlertID: ackedAlert.AlertID, EndpointHash: endpointA, Delivered: true, LastSuccessAt: now.Format(time.RFC3339Nano)},
		{AlertID: ackedAlert.AlertID, EndpointHash: endpointB, FailureCount: 2, LatestFailureAt: now.Format(time.RFC3339Nano)},
		{AlertID: activeDeliveredAlert.AlertID, EndpointHash: endpointA, Delivered: true, LastSuccessAt: now.Format(time.RFC3339Nano)},
		{AlertID: activeRetryAlert.AlertID, EndpointHash: endpointA, FailureCount: 3, LatestFailureAt: now.Format(time.RFC3339Nano)},
	}
	for _, state := range states {
		deliveries.State[operatorAlertDeliveryStateKey(state.AlertID, state.EndpointHash)] = state
	}
	deliveries.Receipts = []PeerOperatorAlertDeliveryReceipt{{
		ReceiptID:    strings.Repeat("1", 64),
		AlertID:      ackedAlert.AlertID,
		EndpointHash: endpointA,
		Succeeded:    true,
		AttemptedAt:  now.Format(time.RFC3339Nano),
	}}

	pruned, removed, err := pruneAcknowledgedPeerOperatorAlertDeliveryState(deliveries, alerts)
	if err != nil {
		t.Fatal(err)
	}
	if removed != 2 {
		t.Fatalf("expected both acknowledged endpoint states removed, got %d", removed)
	}
	if len(pruned.State) != 2 {
		t.Fatalf("expected two unacknowledged states pinned, got %d", len(pruned.State))
	}
	if _, ok := pruned.State[operatorAlertDeliveryStateKey(activeDeliveredAlert.AlertID, endpointA)]; !ok {
		t.Fatal("unacknowledged successful-delivery state must remain pinned to prevent resurrection")
	}
	if state, ok := pruned.State[operatorAlertDeliveryStateKey(activeRetryAlert.AlertID, endpointA)]; !ok || state.FailureCount != 3 {
		t.Fatal("unacknowledged retry state must remain pinned with retry depth intact")
	}
	if len(pruned.Receipts) != 1 || pruned.Receipts[0].AlertID != ackedAlert.AlertID {
		t.Fatal("compact-state cleanup must not prune or rewrite delivery receipt history")
	}
}

func TestPruneAcknowledgedPeerOperatorAlertDeliveryStateIsSafeBecauseAckSuppressesAutoDelivery(t *testing.T) {
	cfg := testPeerSyncConfig()
	now := time.Unix(41_000, 0).UTC()
	alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "ack-suppresses", "ack-suppresses", now)
	if err != nil {
		t.Fatal(err)
	}
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alerts.Entries = []PeerOperatorAlert{alert}
	alerts.Acknowledgements = []PeerOperatorAlertAcknowledgement{{
		AcknowledgementID: strings.Repeat("c", 64),
		AlertID:           alert.AlertID,
		Operator:          "operator-a",
		AcknowledgedAt:    now.Format(time.RFC3339Nano),
	}}
	endpointHash := strings.Repeat("d", 64)
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	deliveries.State[operatorAlertDeliveryStateKey(alert.AlertID, endpointHash)] = PeerOperatorAlertDeliveryState{
		AlertID:       alert.AlertID,
		EndpointHash:  endpointHash,
		Delivered:     true,
		LastSuccessAt: now.Format(time.RFC3339Nano),
	}
	pruned, removed, err := pruneAcknowledgedPeerOperatorAlertDeliveryState(deliveries, alerts)
	if err != nil {
		t.Fatal(err)
	}
	if removed != 1 || len(pruned.State) != 0 {
		t.Fatalf("expected acknowledged state cleanup, removed=%d state=%d", removed, len(pruned.State))
	}
	pending := pendingPeerOperatorAlertsForWebhook(alerts, pruned, endpointHash)
	if len(pending) != 0 {
		t.Fatal("acknowledgement must continue suppressing automatic delivery after compact state cleanup")
	}
}

func TestPruneAcknowledgedPeerOperatorAlertDeliveryStateRejectsAuthorityBearingState(t *testing.T) {
	cfg := testPeerSyncConfig()
	alerts := defaultPeerOperatorAlertJournal(cfg)
	alertID := strings.Repeat("a", 64)
	alerts.Acknowledgements = []PeerOperatorAlertAcknowledgement{{AlertID: alertID}}
	deliveries := defaultPeerOperatorAlertDeliveryJournal(cfg)
	endpointHash := strings.Repeat("b", 64)
	deliveries.State[operatorAlertDeliveryStateKey(alertID, endpointHash)] = PeerOperatorAlertDeliveryState{
		AlertID:            alertID,
		EndpointHash:       endpointHash,
		ConsensusAuthority: true,
	}
	if _, _, err := pruneAcknowledgedPeerOperatorAlertDeliveryState(deliveries, alerts); err == nil {
		t.Fatal("cleanup must fail closed on authority-bearing compact state")
	}
}
