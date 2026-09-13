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
	pending := pendingPeerOperatorAlertsForWebhook(alerts, deliveries, operatorAlertEndpointHash(webhook))
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
