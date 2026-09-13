package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

type PeerOperatorAlertDeliveryRetryStatus struct {
	AlertID       string `json:"alertId"`
	AlertType     string `json:"alertType"`
	Severity      string `json:"severity"`
	Acknowledged  bool   `json:"acknowledged"`
	Delivered     bool   `json:"delivered"`
	FailureCount  int    `json:"failureCount"`
	RetryEligible bool   `json:"retryEligible"`
	NextRetryAt   string `json:"nextRetryAt,omitempty"`
}

type PeerOperatorAlertDeliveryStatus struct {
	ProfileVersion      string                                 `json:"profileVersion"`
	ChainID             string                                 `json:"chainId"`
	GenesisDIRHash      string                                 `json:"GenesisDIRHash"`
	ProtocolVersion     string                                 `json:"protocolVersion"`
	ConsensusAuthority  bool                                   `json:"consensusAuthority"`
	SafetyStateMutation bool                                   `json:"safetyStateMutation"`
	EndpointHash        string                                 `json:"endpointHash,omitempty"`
	TotalAttempts       int                                    `json:"totalAttempts"`
	Successful          int                                    `json:"successful"`
	Failed              int                                    `json:"failed"`
	Receipts            []PeerOperatorAlertDeliveryReceipt     `json:"receipts"`
	RetryStatus         []PeerOperatorAlertDeliveryRetryStatus `json:"retryStatus,omitempty"`
}

func peerOperatorAlertDeliveryRetryStatus(alerts PeerOperatorAlertJournal, deliveries PeerOperatorAlertDeliveryJournal, endpointHash, alertFilter string, now time.Time) ([]PeerOperatorAlertDeliveryRetryStatus, error) {
	endpointHash = strings.ToLower(strings.TrimSpace(endpointHash))
	alertFilter = strings.ToLower(strings.TrimSpace(alertFilter))
	acknowledged := map[string]bool{}
	for _, acknowledgement := range alerts.Acknowledgements {
		acknowledged[strings.ToLower(acknowledgement.AlertID)] = true
	}
	type attemptState struct {
		delivered     bool
		failureCount  int
		latestFailure time.Time
	}
	attempts := map[string]attemptState{}
	for _, receipt := range deliveries.Receipts {
		if !strings.EqualFold(receipt.EndpointHash, endpointHash) {
			continue
		}
		id := strings.ToLower(receipt.AlertID)
		state := attempts[id]
		if receipt.Succeeded {
			state.delivered = true
			attempts[id] = state
			continue
		}
		attemptedAt, err := time.Parse(time.RFC3339Nano, receipt.AttemptedAt)
		if err != nil {
			return nil, fmt.Errorf("invalid failed delivery receipt timestamp for alert %s: %w", receipt.AlertID, err)
		}
		state.failureCount++
		if state.latestFailure.IsZero() || attemptedAt.After(state.latestFailure) {
			state.latestFailure = attemptedAt
		}
		attempts[id] = state
	}

	status := make([]PeerOperatorAlertDeliveryRetryStatus, 0, len(alerts.Entries))
	for _, alert := range alerts.Entries {
		id := strings.ToLower(alert.AlertID)
		if alertFilter != "" && id != alertFilter {
			continue
		}
		state := attempts[id]
		entry := PeerOperatorAlertDeliveryRetryStatus{
			AlertID:      alert.AlertID,
			AlertType:    alert.AlertType,
			Severity:     alert.Severity,
			Acknowledged: acknowledged[id],
			Delivered:    state.delivered,
			FailureCount: state.failureCount,
		}
		if !entry.Acknowledged && !entry.Delivered {
			if state.failureCount == 0 {
				entry.RetryEligible = true
			} else {
				nextRetry := state.latestFailure.Add(peerOperatorAlertRetryDelay(state.failureCount))
				entry.NextRetryAt = nextRetry.UTC().Format(time.RFC3339Nano)
				entry.RetryEligible = !now.UTC().Before(nextRetry)
			}
		}
		status = append(status, entry)
	}
	return status, nil
}

func peerOperatorAlertDeliveryStatusCommand(args []string) error {
	fs := newFlagSet("peer-alert-delivery-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	deliveryPath := fs.String("delivery-state", "", "local alert delivery receipt journal path")
	alertPath := fs.String("alert-state", "", "local operator alert journal path used for optional retry status")
	alertID := fs.String("alert-id", "", "optional alert SHA-256 ID filter")
	webhookRaw := fs.String("webhook", "", "optional webhook URL used only to compute endpoint-scoped retry status; no network request is made")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *deliveryPath == "" {
		*deliveryPath = filepath.Join(*dir, "state", "peer-operator-alert-deliveries.json")
	}
	if *alertPath == "" {
		*alertPath = filepath.Join(*dir, "state", "peer-operator-alerts.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing operator alert delivery status outside CANDIDATE/voteAuthority=false state")
	}
	journal, err := loadPeerOperatorAlertDeliveryJournal(*deliveryPath, cfg)
	if err != nil {
		return err
	}
	filter := strings.ToLower(strings.TrimSpace(*alertID))
	if filter != "" && !isSHA256(filter) {
		return errors.New("--alert-id must be a valid SHA-256 ID")
	}
	status := PeerOperatorAlertDeliveryStatus{
		ProfileVersion:      journal.ProfileVersion,
		ChainID:             journal.ChainID,
		GenesisDIRHash:      journal.GenesisDIRHash,
		ProtocolVersion:     journal.ProtocolVersion,
		ConsensusAuthority:  false,
		SafetyStateMutation: false,
		Receipts:            []PeerOperatorAlertDeliveryReceipt{},
	}
	for _, receipt := range journal.Receipts {
		if filter != "" && !strings.EqualFold(receipt.AlertID, filter) {
			continue
		}
		status.TotalAttempts++
		if receipt.Succeeded {
			status.Successful++
		} else {
			status.Failed++
		}
		status.Receipts = append(status.Receipts, receipt)
	}
	if strings.TrimSpace(*webhookRaw) != "" {
		webhook, err := validateOperatorAlertWebhookURL(*webhookRaw)
		if err != nil {
			return err
		}
		alerts, err := loadPeerOperatorAlertJournal(*alertPath, cfg)
		if err != nil {
			return err
		}
		status.EndpointHash = operatorAlertEndpointHash(webhook)
		status.RetryStatus, err = peerOperatorAlertDeliveryRetryStatus(alerts, journal, status.EndpointHash, filter, time.Now().UTC())
		if err != nil {
			return err
		}
	}
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
