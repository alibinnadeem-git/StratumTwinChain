package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	peerOperatorAlertAutoDeliveryMaxPerCycle = 16
	peerOperatorAlertRetryBaseDelay          = time.Minute
	peerOperatorAlertRetryMaxDelay           = time.Hour
)

func pendingPeerOperatorAlertsForWebhook(alerts PeerOperatorAlertJournal, deliveries PeerOperatorAlertDeliveryJournal, endpointHash string) []PeerOperatorAlert {
	endpointHash = strings.ToLower(strings.TrimSpace(endpointHash))
	acknowledged := map[string]bool{}
	for _, acknowledgement := range alerts.Acknowledgements {
		acknowledged[strings.ToLower(acknowledgement.AlertID)] = true
	}
	delivered := map[string]bool{}
	for _, receipt := range deliveries.Receipts {
		if receipt.Succeeded && strings.EqualFold(receipt.EndpointHash, endpointHash) {
			delivered[strings.ToLower(receipt.AlertID)] = true
		}
	}
	pending := make([]PeerOperatorAlert, 0, len(alerts.Entries))
	for _, alert := range alerts.Entries {
		id := strings.ToLower(alert.AlertID)
		if acknowledged[id] || delivered[id] {
			continue
		}
		pending = append(pending, alert)
	}
	return pending
}

func peerOperatorAlertRetryDelay(failureCount int) time.Duration {
	if failureCount <= 0 {
		return 0
	}
	delay := peerOperatorAlertRetryBaseDelay
	for i := 1; i < failureCount && delay < peerOperatorAlertRetryMaxDelay; i++ {
		if delay >= peerOperatorAlertRetryMaxDelay/2 {
			return peerOperatorAlertRetryMaxDelay
		}
		delay *= 2
	}
	if delay > peerOperatorAlertRetryMaxDelay {
		return peerOperatorAlertRetryMaxDelay
	}
	return delay
}

func eligiblePeerOperatorAlertsForWebhookAt(alerts PeerOperatorAlertJournal, deliveries PeerOperatorAlertDeliveryJournal, endpointHash string, now time.Time) ([]PeerOperatorAlert, error) {
	endpointHash = strings.ToLower(strings.TrimSpace(endpointHash))
	pending := pendingPeerOperatorAlertsForWebhook(alerts, deliveries, endpointHash)
	if len(pending) == 0 {
		return pending, nil
	}

	type retryState struct {
		failureCount int
		latestFailure time.Time
	}
	retries := map[string]retryState{}
	for _, receipt := range deliveries.Receipts {
		if receipt.Succeeded || !strings.EqualFold(receipt.EndpointHash, endpointHash) {
			continue
		}
		attemptedAt, err := time.Parse(time.RFC3339Nano, receipt.AttemptedAt)
		if err != nil {
			return nil, fmt.Errorf("invalid failed delivery receipt timestamp for alert %s: %w", receipt.AlertID, err)
		}
		id := strings.ToLower(receipt.AlertID)
		state := retries[id]
		state.failureCount++
		if state.latestFailure.IsZero() || attemptedAt.After(state.latestFailure) {
			state.latestFailure = attemptedAt
		}
		retries[id] = state
	}

	eligible := make([]PeerOperatorAlert, 0, len(pending))
	for _, alert := range pending {
		state := retries[strings.ToLower(alert.AlertID)]
		if state.failureCount == 0 {
			eligible = append(eligible, alert)
			continue
		}
		nextAttempt := state.latestFailure.Add(peerOperatorAlertRetryDelay(state.failureCount))
		if !now.UTC().Before(nextAttempt) {
			eligible = append(eligible, alert)
		}
	}
	return eligible, nil
}

func newOperatorAlertWebhookHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func autoDeliverPendingPeerOperatorAlertsContext(ctx context.Context, client *http.Client, cfg BootstrapConfig, alertPath, deliveryPath string, webhook *url.URL, bearerToken string, now time.Time) ([]PeerOperatorAlertDeliveryReceipt, error) {
	if ctx == nil {
		return nil, errors.New("automatic operator alert delivery context is required")
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return nil, errors.New("refusing automatic operator alert delivery outside CANDIDATE/voteAuthority=false state")
	}
	if webhook == nil {
		return nil, errors.New("automatic operator alert webhook is required")
	}
	alerts, err := loadPeerOperatorAlertJournal(alertPath, cfg)
	if err != nil {
		return nil, err
	}
	deliveries, err := loadPeerOperatorAlertDeliveryJournal(deliveryPath, cfg)
	if err != nil {
		return nil, err
	}
	pending, err := eligiblePeerOperatorAlertsForWebhookAt(alerts, deliveries, operatorAlertEndpointHash(webhook), now)
	if err != nil {
		return nil, err
	}
	if len(pending) > peerOperatorAlertAutoDeliveryMaxPerCycle {
		pending = pending[:peerOperatorAlertAutoDeliveryMaxPerCycle]
	}
	receipts := make([]PeerOperatorAlertDeliveryReceipt, 0, len(pending))
	var deliveryErrors []error
	for i, alert := range pending {
		if err := ctx.Err(); err != nil {
			deliveryErrors = append(deliveryErrors, err)
			break
		}
		attemptedAt := now.UTC().Add(time.Duration(i) * time.Nanosecond)
		receipt, deliveryErr := deliverPeerOperatorAlertWebhookContext(ctx, client, cfg, alert, webhook, bearerToken, attemptedAt)
		if receipt.ReceiptID != "" {
			if err := appendPeerOperatorAlertDeliveryReceipt(deliveryPath, cfg, receipt); err != nil {
				deliveryErrors = append(deliveryErrors, fmt.Errorf("persist automatic operator alert delivery receipt: %w", err))
			} else {
				receipts = append(receipts, receipt)
			}
		}
		if deliveryErr != nil {
			deliveryErrors = append(deliveryErrors, fmt.Errorf("automatic operator alert %s delivery failed: %w", alert.AlertID, deliveryErr))
		}
	}
	return receipts, errors.Join(deliveryErrors...)
}
