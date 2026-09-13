package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const peerOperatorAlertDeliveryProfile = "STRATUM-PEER-ALERT-DELIVERY/1"

type PeerOperatorAlertWebhookPayload struct {
	ProfileVersion     string            `json:"profileVersion"`
	ChainID            string            `json:"chainId"`
	GenesisDIRHash     string            `json:"GenesisDIRHash"`
	ProtocolVersion    string            `json:"protocolVersion"`
	ConsensusAuthority bool              `json:"consensusAuthority"`
	Alert              PeerOperatorAlert `json:"alert"`
	DeliveredAt        string            `json:"deliveredAt"`
}

type PeerOperatorAlertDeliveryReceipt struct {
	ReceiptID           string `json:"receiptId"`
	AlertID             string `json:"alertId"`
	EndpointHash        string `json:"endpointHash"`
	HTTPStatus          int    `json:"httpStatus"`
	Succeeded           bool   `json:"succeeded"`
	AttemptedAt         string `json:"attemptedAt"`
	ConsensusAuthority  bool   `json:"consensusAuthority"`
	SafetyStateMutation bool   `json:"safetyStateMutation"`
}

type PeerOperatorAlertDeliveryState struct {
	AlertID             string `json:"alertId"`
	EndpointHash        string `json:"endpointHash"`
	Delivered           bool   `json:"delivered"`
	FailureCount        int    `json:"failureCount"`
	LatestFailureAt     string `json:"latestFailureAt,omitempty"`
	LastSuccessAt       string `json:"lastSuccessAt,omitempty"`
	ConsensusAuthority  bool   `json:"consensusAuthority"`
	SafetyStateMutation bool   `json:"safetyStateMutation"`
}

type PeerOperatorAlertDeliveryJournal struct {
	ProfileVersion     string                                    `json:"profileVersion"`
	ChainID            string                                    `json:"chainId"`
	GenesisDIRHash     string                                    `json:"GenesisDIRHash"`
	ProtocolVersion    string                                    `json:"protocolVersion"`
	ConsensusAuthority bool                                      `json:"consensusAuthority"`
	Receipts           []PeerOperatorAlertDeliveryReceipt        `json:"receipts"`
	State              map[string]PeerOperatorAlertDeliveryState `json:"state,omitempty"`
}

func operatorAlertDeliveryStateKey(alertID, endpointHash string) string {
	return strings.ToLower(strings.TrimSpace(endpointHash)) + ":" + strings.ToLower(strings.TrimSpace(alertID))
}

func validatePeerOperatorAlertDeliveryState(state PeerOperatorAlertDeliveryState) error {
	if !isSHA256(strings.ToLower(state.AlertID)) || !isSHA256(strings.ToLower(state.EndpointHash)) {
		return errors.New("invalid operator alert delivery state identifiers")
	}
	if state.FailureCount < 0 {
		return errors.New("operator alert delivery state failure count may not be negative")
	}
	if state.ConsensusAuthority || state.SafetyStateMutation {
		return errors.New("operator alert delivery state claims forbidden authority or safety-state mutation")
	}
	if state.LatestFailureAt != "" {
		if _, err := time.Parse(time.RFC3339Nano, state.LatestFailureAt); err != nil {
			return fmt.Errorf("invalid operator alert delivery state latest failure timestamp: %w", err)
		}
	}
	if state.LastSuccessAt != "" {
		if _, err := time.Parse(time.RFC3339Nano, state.LastSuccessAt); err != nil {
			return fmt.Errorf("invalid operator alert delivery state success timestamp: %w", err)
		}
	}
	return nil
}

func applyPeerOperatorAlertDeliveryReceiptState(journal *PeerOperatorAlertDeliveryJournal, receipt PeerOperatorAlertDeliveryReceipt) error {
	if journal == nil {
		return errors.New("operator alert delivery journal is required")
	}
	if !isSHA256(receipt.AlertID) || !isSHA256(receipt.EndpointHash) {
		return errors.New("invalid operator alert delivery receipt state identifiers")
	}
	if receipt.ConsensusAuthority || receipt.SafetyStateMutation {
		return errors.New("operator alert delivery receipt may not carry authority or mutate safety state")
	}
	attemptedAt, err := time.Parse(time.RFC3339Nano, receipt.AttemptedAt)
	if err != nil {
		return fmt.Errorf("invalid operator alert delivery receipt timestamp: %w", err)
	}
	if journal.State == nil {
		journal.State = map[string]PeerOperatorAlertDeliveryState{}
	}
	key := operatorAlertDeliveryStateKey(receipt.AlertID, receipt.EndpointHash)
	state := journal.State[key]
	if state.AlertID == "" {
		state = PeerOperatorAlertDeliveryState{
			AlertID:             strings.ToLower(receipt.AlertID),
			EndpointHash:        strings.ToLower(receipt.EndpointHash),
			ConsensusAuthority:  false,
			SafetyStateMutation: false,
		}
	}
	if receipt.Succeeded {
		state.Delivered = true
		state.LastSuccessAt = attemptedAt.UTC().Format(time.RFC3339Nano)
	} else if !state.Delivered {
		state.FailureCount++
		if state.LatestFailureAt == "" {
			state.LatestFailureAt = attemptedAt.UTC().Format(time.RFC3339Nano)
		} else {
			previous, parseErr := time.Parse(time.RFC3339Nano, state.LatestFailureAt)
			if parseErr != nil {
				return fmt.Errorf("invalid existing operator alert delivery state timestamp: %w", parseErr)
			}
			if attemptedAt.After(previous) {
				state.LatestFailureAt = attemptedAt.UTC().Format(time.RFC3339Nano)
			}
		}
	}
	if err := validatePeerOperatorAlertDeliveryState(state); err != nil {
		return err
	}
	journal.State[key] = state
	return nil
}

func defaultPeerOperatorAlertDeliveryJournal(cfg BootstrapConfig) PeerOperatorAlertDeliveryJournal {
	return PeerOperatorAlertDeliveryJournal{
		ProfileVersion:     peerOperatorAlertDeliveryProfile,
		ChainID:            cfg.ChainID,
		GenesisDIRHash:     strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:    cfg.ProtocolVersion,
		ConsensusAuthority: false,
		Receipts:           []PeerOperatorAlertDeliveryReceipt{},
		State:              map[string]PeerOperatorAlertDeliveryState{},
	}
}

func loadPeerOperatorAlertDeliveryJournal(path string, cfg BootstrapConfig) (PeerOperatorAlertDeliveryJournal, error) {
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	if path == "" {
		return journal, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return journal, nil
	} else if err != nil {
		return PeerOperatorAlertDeliveryJournal{}, err
	}
	if err := readJSON(path, &journal); err != nil {
		return PeerOperatorAlertDeliveryJournal{}, err
	}
	if journal.ProfileVersion != peerOperatorAlertDeliveryProfile || journal.ChainID != cfg.ChainID || !strings.EqualFold(journal.GenesisDIRHash, cfg.GenesisDIRHash) || journal.ProtocolVersion != cfg.ProtocolVersion {
		return PeerOperatorAlertDeliveryJournal{}, errors.New("peer operator alert delivery journal trust context mismatch")
	}
	if journal.ConsensusAuthority {
		return PeerOperatorAlertDeliveryJournal{}, errors.New("peer operator alert delivery must never carry consensus authority")
	}
	if journal.Receipts == nil {
		journal.Receipts = []PeerOperatorAlertDeliveryReceipt{}
	}
	for _, receipt := range journal.Receipts {
		if receipt.ConsensusAuthority || receipt.SafetyStateMutation {
			return PeerOperatorAlertDeliveryJournal{}, errors.New("peer operator alert delivery receipt claims forbidden authority or safety-state mutation")
		}
	}
	if journal.State == nil {
		journal.State = map[string]PeerOperatorAlertDeliveryState{}
	}
	if len(journal.State) == 0 && len(journal.Receipts) > 0 {
		for _, receipt := range journal.Receipts {
			if err := applyPeerOperatorAlertDeliveryReceiptState(&journal, receipt); err != nil {
				return PeerOperatorAlertDeliveryJournal{}, fmt.Errorf("reconstruct operator alert delivery state from retained receipts: %w", err)
			}
		}
	}
	for key, state := range journal.State {
		if key != operatorAlertDeliveryStateKey(state.AlertID, state.EndpointHash) {
			return PeerOperatorAlertDeliveryJournal{}, errors.New("operator alert delivery state key mismatch")
		}
		if err := validatePeerOperatorAlertDeliveryState(state); err != nil {
			return PeerOperatorAlertDeliveryJournal{}, err
		}
	}
	return journal, nil
}

func savePeerOperatorAlertDeliveryJournalAtomic(path string, journal PeerOperatorAlertDeliveryJournal, cfg BootstrapConfig) error {
	if path == "" {
		return nil
	}
	if journal.ProfileVersion != peerOperatorAlertDeliveryProfile || journal.ChainID != cfg.ChainID || !strings.EqualFold(journal.GenesisDIRHash, cfg.GenesisDIRHash) || journal.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("peer operator alert delivery journal trust context mismatch")
	}
	if journal.ConsensusAuthority {
		return errors.New("refusing peer operator alert delivery journal with consensus authority enabled")
	}
	for _, receipt := range journal.Receipts {
		if receipt.ConsensusAuthority || receipt.SafetyStateMutation {
			return errors.New("refusing peer operator alert delivery receipt with authority or safety-state mutation enabled")
		}
	}
	if journal.State == nil {
		journal.State = map[string]PeerOperatorAlertDeliveryState{}
	}
	for key, state := range journal.State {
		if key != operatorAlertDeliveryStateKey(state.AlertID, state.EndpointHash) {
			return errors.New("refusing operator alert delivery journal with mismatched state key")
		}
		if err := validatePeerOperatorAlertDeliveryState(state); err != nil {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(b, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func validateOperatorAlertWebhookURL(raw string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Hostname() == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return nil, errors.New("operator alert webhook requires an absolute HTTP(S) URL")
	}
	if u.User != nil {
		return nil, errors.New("operator alert webhook URL must not contain embedded credentials")
	}
	if u.Scheme == "http" && !isSafePlainHTTPPeerTarget(u) {
		return nil, errors.New("plaintext HTTP refused for non-loopback operator alert webhook")
	}
	return u, nil
}

func peerOperatorAlertByID(journal PeerOperatorAlertJournal, alertID string) (PeerOperatorAlert, error) {
	alertID = strings.ToLower(strings.TrimSpace(alertID))
	if !isSHA256(alertID) {
		return PeerOperatorAlert{}, errors.New("operator alert delivery requires a valid alert SHA-256 ID")
	}
	for _, alert := range journal.Entries {
		if strings.EqualFold(alert.AlertID, alertID) {
			return alert, nil
		}
	}
	return PeerOperatorAlert{}, errors.New("operator alert delivery references unknown alert")
}

func readBearerTokenFile(path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", errors.New("bearer token file must be a regular file")
	}
	if info.Mode().Perm()&0o077 != 0 {
		return "", errors.New("bearer token file permissions are too broad; require owner-only access")
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	token := strings.TrimSpace(string(b))
	if token == "" || strings.ContainsAny(token, "\r\n") {
		return "", errors.New("bearer token file must contain one non-empty token")
	}
	return token, nil
}

func operatorAlertEndpointHash(u *url.URL) string {
	copyURL := *u
	copyURL.RawQuery = ""
	copyURL.Fragment = ""
	digest := sha256.Sum256([]byte(copyURL.String()))
	return hex.EncodeToString(digest[:])
}

func operatorAlertDeliveryReceiptID(cfg BootstrapConfig, alertID, endpointHash string, attemptedAt time.Time) string {
	payload := strings.Join([]string{
		peerOperatorAlertDeliveryProfile,
		cfg.ChainID,
		strings.ToLower(cfg.GenesisDIRHash),
		cfg.ProtocolVersion,
		strings.ToLower(alertID),
		strings.ToLower(endpointHash),
		attemptedAt.UTC().Format(time.RFC3339Nano),
	}, "|")
	digest := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(digest[:])
}

func deliverPeerOperatorAlertWebhook(client *http.Client, cfg BootstrapConfig, alert PeerOperatorAlert, webhook *url.URL, bearerToken string, now time.Time) (PeerOperatorAlertDeliveryReceipt, error) {
	return deliverPeerOperatorAlertWebhookContext(context.Background(), client, cfg, alert, webhook, bearerToken, now)
}

func deliverPeerOperatorAlertWebhookContext(ctx context.Context, client *http.Client, cfg BootstrapConfig, alert PeerOperatorAlert, webhook *url.URL, bearerToken string, now time.Time) (PeerOperatorAlertDeliveryReceipt, error) {
	if client == nil {
		return PeerOperatorAlertDeliveryReceipt{}, errors.New("operator alert webhook HTTP client is required")
	}
	if ctx == nil {
		return PeerOperatorAlertDeliveryReceipt{}, errors.New("operator alert webhook context is required")
	}
	payload := PeerOperatorAlertWebhookPayload{
		ProfileVersion:     peerOperatorAlertDeliveryProfile,
		ChainID:            cfg.ChainID,
		GenesisDIRHash:     strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:    cfg.ProtocolVersion,
		ConsensusAuthority: false,
		Alert:              alert,
		DeliveredAt:        now.UTC().Format(time.RFC3339Nano),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return PeerOperatorAlertDeliveryReceipt{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhook.String(), bytes.NewReader(body))
	if err != nil {
		return PeerOperatorAlertDeliveryReceipt{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "STRATUM-Portable-Validator/peer-alert-delivery")
	if bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+bearerToken)
	}
	resp, err := client.Do(req)
	endpointHash := operatorAlertEndpointHash(webhook)
	receipt := PeerOperatorAlertDeliveryReceipt{
		ReceiptID:           operatorAlertDeliveryReceiptID(cfg, alert.AlertID, endpointHash, now),
		AlertID:             strings.ToLower(alert.AlertID),
		EndpointHash:        endpointHash,
		AttemptedAt:         now.UTC().Format(time.RFC3339Nano),
		ConsensusAuthority:  false,
		SafetyStateMutation: false,
	}
	if err != nil {
		return receipt, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	receipt.HTTPStatus = resp.StatusCode
	receipt.Succeeded = resp.StatusCode >= 200 && resp.StatusCode < 300
	if !receipt.Succeeded {
		return receipt, fmt.Errorf("operator alert webhook returned HTTP %d", resp.StatusCode)
	}
	return receipt, nil
}

func appendPeerOperatorAlertDeliveryReceipt(path string, cfg BootstrapConfig, receipt PeerOperatorAlertDeliveryReceipt) error {
	if !isSHA256(receipt.ReceiptID) || !isSHA256(receipt.AlertID) || !isSHA256(receipt.EndpointHash) {
		return errors.New("invalid operator alert delivery receipt identifiers")
	}
	if receipt.ConsensusAuthority || receipt.SafetyStateMutation {
		return errors.New("operator alert delivery receipt may not carry authority or mutate safety state")
	}
	journal, err := loadPeerOperatorAlertDeliveryJournal(path, cfg)
	if err != nil {
		return err
	}
	if err := applyPeerOperatorAlertDeliveryReceiptState(&journal, receipt); err != nil {
		return fmt.Errorf("update compact operator alert delivery state: %w", err)
	}
	journal.Receipts = append(journal.Receipts, receipt)
	journal, _, err = prunePeerOperatorAlertDeliveryReceipts(journal, peerOperatorAlertDeliveryMaxReceipts)
	if err != nil {
		return fmt.Errorf("enforce operator alert delivery receipt retention: %w", err)
	}
	return savePeerOperatorAlertDeliveryJournalAtomic(path, journal, cfg)
}

func peerOperatorAlertDeliverWebhookCommand(args []string) error {
	fs := newFlagSet("peer-alert-deliver-webhook")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	alertPath := fs.String("alert-state", "", "durable local peer operator alert journal path")
	deliveryPath := fs.String("delivery-state", "", "append-only local alert delivery receipt journal path")
	alertID := fs.String("alert-id", "", "existing local operator alert SHA-256 ID")
	webhookRaw := fs.String("webhook", "", "HTTPS webhook URL; loopback HTTP allowed only for local testing")
	bearerTokenFile := fs.String("bearer-token-file", "", "optional owner-only file containing webhook bearer token")
	timeout := fs.Duration("timeout", 10*time.Second, "webhook request timeout")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*alertID) == "" || strings.TrimSpace(*webhookRaw) == "" {
		return errors.New("--alert-id and --webhook are required")
	}
	if *timeout < time.Second || *timeout > time.Minute {
		return errors.New("--timeout must be between 1s and 1m")
	}
	if *alertPath == "" {
		*alertPath = filepath.Join(*dir, "state", "peer-operator-alerts.json")
	}
	if *deliveryPath == "" {
		*deliveryPath = filepath.Join(*dir, "state", "peer-operator-alert-deliveries.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing operator alert delivery outside CANDIDATE/voteAuthority=false state")
	}
	journal, err := loadPeerOperatorAlertJournal(*alertPath, cfg)
	if err != nil {
		return err
	}
	alert, err := peerOperatorAlertByID(journal, *alertID)
	if err != nil {
		return err
	}
	webhook, err := validateOperatorAlertWebhookURL(*webhookRaw)
	if err != nil {
		return err
	}
	token, err := readBearerTokenFile(*bearerTokenFile)
	if err != nil {
		return err
	}
	client := &http.Client{
		Timeout: *timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	now := time.Now().UTC()
	receipt, deliveryErr := deliverPeerOperatorAlertWebhook(client, cfg, alert, webhook, token, now)
	if receipt.ReceiptID != "" {
		if err := appendPeerOperatorAlertDeliveryReceipt(*deliveryPath, cfg, receipt); err != nil {
			return fmt.Errorf("persist operator alert delivery receipt: %w", err)
		}
	}
	if deliveryErr != nil {
		return deliveryErr
	}
	out, _ := json.MarshalIndent(receipt, "", "  ")
	fmt.Println(string(out))
	return nil
}
