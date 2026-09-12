package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testOperatorAlert(t *testing.T, cfg BootstrapConfig) PeerOperatorAlert {
	t.Helper()
	alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", "FINALIZED_HEAD_CONFLICT", "", "", "automatic follower advancement halted for operator review", "test-safety-halt", time.Unix(100, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	return alert
}

func TestValidateOperatorAlertWebhookURLRejectsUnsafeTargets(t *testing.T) {
	for _, raw := range []string{
		"http://example.com/hook",
		"ftp://example.com/hook",
		"https://user:pass@example.com/hook",
		"/relative/hook",
	} {
		if _, err := validateOperatorAlertWebhookURL(raw); err == nil {
			t.Fatalf("expected webhook URL rejection for %q", raw)
		}
	}
	for _, raw := range []string{"https://example.com/hook", "http://127.0.0.1:8080/hook", "http://localhost:8080/hook"} {
		if _, err := validateOperatorAlertWebhookURL(raw); err != nil {
			t.Fatalf("expected webhook URL acceptance for %q: %v", raw, err)
		}
	}
}

func TestDeliverPeerOperatorAlertWebhookIsOneWayAndNonAuthoritative(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = false
	alert := testOperatorAlert(t, cfg)
	var received PeerOperatorAlertWebhookPayload
	var authHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Errorf("decode webhook payload: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"acknowledge":true,"releaseQuarantine":true,"resumeFollower":true,"canonicalHistory":"attacker-choice"}`))
	}))
	defer server.Close()

	webhook, err := validateOperatorAlertWebhookURL(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Unix(200, 0).UTC()
	receipt, err := deliverPeerOperatorAlertWebhook(server.Client(), cfg, alert, webhook, "secret-token", now)
	if err != nil {
		t.Fatal(err)
	}
	if !receipt.Succeeded || receipt.HTTPStatus != http.StatusOK {
		t.Fatalf("unexpected delivery receipt: %+v", receipt)
	}
	if receipt.ConsensusAuthority || receipt.SafetyStateMutation {
		t.Fatal("webhook delivery receipt must remain non-authoritative and non-mutating")
	}
	if authHeader != "Bearer secret-token" {
		t.Fatalf("unexpected Authorization header: %q", authHeader)
	}
	if received.ProfileVersion != peerOperatorAlertDeliveryProfile || received.ConsensusAuthority || received.Alert.AlertID != alert.AlertID {
		t.Fatalf("unexpected webhook payload: %+v", received)
	}
}

func TestFailedWebhookDeliveryProducesNonAuthoritativeReceipt(t *testing.T) {
	cfg := testPeerSyncConfig()
	alert := testOperatorAlert(t, cfg)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()
	webhook, err := validateOperatorAlertWebhookURL(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	receipt, err := deliverPeerOperatorAlertWebhook(server.Client(), cfg, alert, webhook, "", time.Unix(300, 0).UTC())
	if err == nil {
		t.Fatal("non-2xx webhook response must fail delivery")
	}
	if receipt.Succeeded || receipt.HTTPStatus != http.StatusServiceUnavailable || receipt.ConsensusAuthority || receipt.SafetyStateMutation {
		t.Fatalf("unexpected failed-delivery receipt: %+v", receipt)
	}
}

func TestOperatorAlertDeliveryJournalRejectsAuthorityAndSafetyMutation(t *testing.T) {
	cfg := testPeerSyncConfig()
	path := filepath.Join(t.TempDir(), "deliveries.json")
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	journal.ConsensusAuthority = true
	if err := savePeerOperatorAlertDeliveryJournalAtomic(path, journal, cfg); err == nil {
		t.Fatal("delivery journal must reject consensus authority")
	}
	journal.ConsensusAuthority = false
	journal.Receipts = []PeerOperatorAlertDeliveryReceipt{{
		ReceiptID:           strings.Repeat("a", 64),
		AlertID:             strings.Repeat("b", 64),
		EndpointHash:        strings.Repeat("c", 64),
		AttemptedAt:         time.Unix(1, 0).UTC().Format(time.RFC3339Nano),
		SafetyStateMutation: true,
	}}
	if err := savePeerOperatorAlertDeliveryJournalAtomic(path, journal, cfg); err == nil {
		t.Fatal("delivery journal must reject safety-state mutation")
	}
}

func TestAppendOperatorAlertDeliveryReceiptDoesNotTouchAlertJournal(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	alertPath := filepath.Join(dir, "alerts.json")
	deliveryPath := filepath.Join(dir, "deliveries.json")
	alert := testOperatorAlert(t, cfg)
	if _, err := appendPeerOperatorAlert(alertPath, cfg, alert); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(alertPath)
	if err != nil {
		t.Fatal(err)
	}
	receipt := PeerOperatorAlertDeliveryReceipt{
		ReceiptID:    strings.Repeat("a", 64),
		AlertID:      alert.AlertID,
		EndpointHash: strings.Repeat("c", 64),
		HTTPStatus:   200,
		Succeeded:    true,
		AttemptedAt:  time.Unix(400, 0).UTC().Format(time.RFC3339Nano),
	}
	if err := appendPeerOperatorAlertDeliveryReceipt(deliveryPath, cfg, receipt); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(alertPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("delivery receipt persistence must not mutate the operator alert journal")
	}
}

func TestBearerTokenFileRequiresOwnerOnlyPermissionsAndIsNotPersisted(t *testing.T) {
	cfg := testPeerSyncConfig()
	dir := t.TempDir()
	tokenPath := filepath.Join(dir, "token")
	if err := os.WriteFile(tokenPath, []byte("top-secret-token\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	token, err := readBearerTokenFile(tokenPath)
	if err != nil {
		t.Fatal(err)
	}
	if token != "top-secret-token" {
		t.Fatalf("unexpected token: %q", token)
	}
	journal := defaultPeerOperatorAlertDeliveryJournal(cfg)
	b, err := json.Marshal(journal)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), token) {
		t.Fatal("delivery journal must not persist webhook bearer token")
	}
	if err := os.Chmod(tokenPath, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := readBearerTokenFile(tokenPath); err == nil {
		t.Fatal("bearer token file with group/world permissions must be rejected")
	}
}

func TestPeerOperatorAlertByIDRejectsUnknownAlert(t *testing.T) {
	cfg := testPeerSyncConfig()
	journal := defaultPeerOperatorAlertJournal(cfg)
	if _, err := peerOperatorAlertByID(journal, strings.Repeat("d", 64)); err == nil {
		t.Fatal("unknown alert must not be deliverable")
	}
}
