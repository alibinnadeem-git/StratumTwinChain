package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLoadPeerOperatorAlertDeliveryJournalMigratesLegacyReceiptOnlyState(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alert-deliveries.json")
	endpointHash := strings.Repeat("e", 64)
	deliveredAlertID := strings.Repeat("a", 64)
	failedAlertID := strings.Repeat("b", 64)
	firstFailure := time.Unix(100, 0).UTC()
	secondFailure := time.Unix(200, 0).UTC()
	successAt := time.Unix(300, 0).UTC()

	legacy := struct {
		ProfileVersion     string                             `json:"profileVersion"`
		ChainID            string                             `json:"chainId"`
		GenesisDIRHash     string                             `json:"GenesisDIRHash"`
		ProtocolVersion    string                             `json:"protocolVersion"`
		ConsensusAuthority bool                               `json:"consensusAuthority"`
		Receipts           []PeerOperatorAlertDeliveryReceipt `json:"receipts"`
	}{
		ProfileVersion:     peerOperatorAlertDeliveryProfile,
		ChainID:            cfg.ChainID,
		GenesisDIRHash:     strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:    cfg.ProtocolVersion,
		ConsensusAuthority: false,
		Receipts: []PeerOperatorAlertDeliveryReceipt{
			{
				ReceiptID:           strings.Repeat("1", 64),
				AlertID:             failedAlertID,
				EndpointHash:        endpointHash,
				HTTPStatus:          503,
				Succeeded:           false,
				AttemptedAt:         firstFailure.Format(time.RFC3339Nano),
				ConsensusAuthority:  false,
				SafetyStateMutation: false,
			},
			{
				ReceiptID:           strings.Repeat("2", 64),
				AlertID:             failedAlertID,
				EndpointHash:        endpointHash,
				HTTPStatus:          503,
				Succeeded:           false,
				AttemptedAt:         secondFailure.Format(time.RFC3339Nano),
				ConsensusAuthority:  false,
				SafetyStateMutation: false,
			},
			{
				ReceiptID:           strings.Repeat("3", 64),
				AlertID:             deliveredAlertID,
				EndpointHash:        endpointHash,
				HTTPStatus:          204,
				Succeeded:           true,
				AttemptedAt:         successAt.Format(time.RFC3339Nano),
				ConsensusAuthority:  false,
				SafetyStateMutation: false,
			},
		},
	}
	b, err := json.MarshalIndent(legacy, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, append(b, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}

	journal, err := loadPeerOperatorAlertDeliveryJournal(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if journal.ConsensusAuthority {
		t.Fatal("legacy migration must not create consensus authority")
	}
	failedState := journal.State[operatorAlertDeliveryStateKey(failedAlertID, endpointHash)]
	if failedState.Delivered || failedState.FailureCount != 2 || failedState.LatestFailureAt != secondFailure.Format(time.RFC3339Nano) {
		t.Fatalf("unexpected migrated failed-delivery state: %+v", failedState)
	}
	if failedState.ConsensusAuthority || failedState.SafetyStateMutation {
		t.Fatal("migrated failed-delivery state must remain non-authoritative and non-mutating")
	}
	deliveredState := journal.State[operatorAlertDeliveryStateKey(deliveredAlertID, endpointHash)]
	if !deliveredState.Delivered || deliveredState.LastSuccessAt != successAt.Format(time.RFC3339Nano) {
		t.Fatalf("unexpected migrated success state: %+v", deliveredState)
	}
	if deliveredState.ConsensusAuthority || deliveredState.SafetyStateMutation {
		t.Fatal("migrated successful-delivery state must remain non-authoritative and non-mutating")
	}

	if err := savePeerOperatorAlertDeliveryJournalAtomic(path, journal, cfg); err != nil {
		t.Fatal(err)
	}
	reloaded, err := loadPeerOperatorAlertDeliveryJournal(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(reloaded.State) != 2 {
		t.Fatalf("expected persisted migrated compact state, got %d entries", len(reloaded.State))
	}
	if reloaded.State[operatorAlertDeliveryStateKey(failedAlertID, endpointHash)].FailureCount != 2 {
		t.Fatal("persisted migrated failure depth changed after reload")
	}
	if !reloaded.State[operatorAlertDeliveryStateKey(deliveredAlertID, endpointHash)].Delivered {
		t.Fatal("persisted migrated success state was lost after reload")
	}
}

func TestLoadPeerOperatorAlertDeliveryJournalDoesNotRebuildExistingCompactState(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "peer-operator-alert-deliveries.json")
	endpointHash := strings.Repeat("e", 64)
	alertID := strings.Repeat("a", 64)
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	journal.Receipts = []PeerOperatorAlertDeliveryReceipt{
		{
			ReceiptID:    strings.Repeat("1", 64),
			AlertID:      alertID,
			EndpointHash: endpointHash,
			HTTPStatus:   503,
			Succeeded:    false,
			AttemptedAt:  time.Unix(10, 0).UTC().Format(time.RFC3339Nano),
		},
	}
	journal.State[operatorAlertDeliveryStateKey(alertID, endpointHash)] = PeerOperatorAlertDeliveryState{
		AlertID:             alertID,
		EndpointHash:        endpointHash,
		FailureCount:        9,
		LatestFailureAt:     time.Unix(90, 0).UTC().Format(time.RFC3339Nano),
		ConsensusAuthority:  false,
		SafetyStateMutation: false,
	}
	if err := savePeerOperatorAlertDeliveryJournalAtomic(path, journal, cfg); err != nil {
		t.Fatal(err)
	}

	loaded, err := loadPeerOperatorAlertDeliveryJournal(path, cfg)
	if err != nil {
		t.Fatal(err)
	}
	state := loaded.State[operatorAlertDeliveryStateKey(alertID, endpointHash)]
	if state.FailureCount != 9 {
		t.Fatalf("existing compact state must remain authoritative over prunable receipts; got failureCount=%d", state.FailureCount)
	}
}
