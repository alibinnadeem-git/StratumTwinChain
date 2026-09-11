package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type peerSessionNodeFixture struct {
	dir       string
	statePath string
	cfg       BootstrapConfig
	priv      ed25519.PrivateKey
	keyID     string
}

func makePeerSessionFixture(t *testing.T) (PeerTransportRegistry, string, peerSessionNodeFixture, peerSessionNodeFixture) {
	t.Helper()
	genesis := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	chainID := "stratum-devnet-1"
	networkName := "STRATUM Devnet"
	protocol := "POVI/1"

	makeNode := func(validatorID, label string) (peerSessionNodeFixture, PeerTransportMember) {
		t.Helper()
		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
		pubDER, err := x509.MarshalPKIXPublicKey(pub)
		if err != nil {
			t.Fatal(err)
		}
		privDER, err := x509.MarshalPKCS8PrivateKey(priv)
		if err != nil {
			t.Fatal(err)
		}
		dir := t.TempDir()
		if err := os.MkdirAll(filepath.Join(dir, "keys", "private"), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Join(dir, "state"), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "keys", "private", "transport.pk8"), privDER, 0o600); err != nil {
			t.Fatal(err)
		}
		keyID := validatorID + ":transport:v1"
		pubB64 := base64.StdEncoding.EncodeToString(pubDER)
		cfg := BootstrapConfig{
			BootstrapVersion: bootstrapVersion,
			ValidatorID:      validatorID,
			FriendlyLabel:    label,
			ChainID:          chainID,
			NetworkName:      networkName,
			GenesisDIRHash:   genesis,
			ProtocolVersion:  protocol,
			State:            candidateState,
			VoteAuthority:    false,
			ActivationBlockedReasons: []string{
				"GOVERNANCE_ACTIVATION_REQUIRED",
				"VRF_CONFORMANCE_NOT_YET_IMPLEMENTED",
				"LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED",
			},
			Keys: map[string]KeyRef{
				"TRANSPORT": {
					Purpose:       "TRANSPORT",
					Algorithm:     "ED25519_TRANSPORT_IDENTITY",
					PublicKeyB64:  pubB64,
					PublicKeyHash: sha256Hex(pubDER),
					KeyVersion:    1,
				},
			},
		}
		if err := writeJSON(filepath.Join(dir, "config.json"), cfg, 0o600); err != nil {
			t.Fatal(err)
		}
		member := PeerTransportMember{ValidatorID: validatorID, Keys: []PeerTransportKey{{
			KeyID:            keyID,
			Purpose:          "TRANSPORT",
			Algorithm:        "ED25519_TRANSPORT_IDENTITY",
			PublicKeyDerB64:  pubB64,
			ActiveFromHeight: 0,
		}}}
		return peerSessionNodeFixture{dir: dir, statePath: filepath.Join(dir, "state", "peer-session.json"), cfg: cfg, priv: priv, keyID: keyID}, member
	}

	nodeA, memberA := makeNode("validator-a", "Validator A")
	nodeB, memberB := makeNode("validator-b", "Validator B")
	registry := PeerTransportRegistry{
		RegistryVersion: peerTransportRegistryProfile,
		ChainID:         chainID,
		GenesisDIRHash:  genesis,
		ProtocolVersion: protocol,
		Members:         []PeerTransportMember{memberA, memberB},
	}
	root, err := peerRegistryRootAtHeight(registry, 12)
	if err != nil {
		t.Fatal(err)
	}
	return registry, root, nodeA, nodeB
}

func newFixtureRuntime(t *testing.T, node peerSessionNodeFixture, registry PeerTransportRegistry, root string) *PeerSessionRuntime {
	t.Helper()
	r, err := newPeerSessionRuntime(node.dir, registry, 12, root, node.statePath, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestReadOnlyPeerSessionRoundTripAndReplayRejection(t *testing.T) {
	registry, root, nodeA, nodeB := makePeerSessionFixture(t)
	a := newFixtureRuntime(t, nodeA, registry, root)
	b := newFixtureRuntime(t, nodeB, registry, root)
	server := httptest.NewServer(b.handler())
	defer server.Close()

	a.mu.Lock()
	ping, err := a.nextSignedEnvelope("PING", map[string]any{"request": "STATUS", "readOnly": true}, time.Now().UTC())
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(ping)
	if err != nil {
		t.Fatal(err)
	}

	post := func() *http.Response {
		t.Helper()
		resp, err := http.Post(server.URL+"/v1/peer/message", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}

	resp := post()
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}
	var status PeerEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		resp.Body.Close()
		t.Fatal(err)
	}
	resp.Body.Close()
	if status.MessageType != "STATUS" {
		t.Fatalf("expected STATUS response, got %q", status.MessageType)
	}
	a.mu.Lock()
	verification, err := a.acceptInboundEnvelope(status, time.Now().UTC())
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if verification.SenderValidatorID != "validator-b" || !verification.ReadOnly {
		t.Fatalf("unexpected peer verification: %+v", verification)
	}

	replay := post()
	defer replay.Body.Close()
	if replay.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected replay rejection HTTP 401, got %d", replay.StatusCode)
	}
}

func TestPeerSessionSequenceAndReplayPersistAcrossRestart(t *testing.T) {
	registry, root, nodeA, nodeB := makePeerSessionFixture(t)
	a := newFixtureRuntime(t, nodeA, registry, root)
	b := newFixtureRuntime(t, nodeB, registry, root)
	now := time.Now().UTC()

	a.mu.Lock()
	first, err := a.nextSignedEnvelope("PING", map[string]any{"readOnly": true}, now)
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	b.mu.Lock()
	if _, err := b.acceptInboundEnvelope(first, now); err != nil {
		b.mu.Unlock()
		t.Fatal(err)
	}
	b.mu.Unlock()

	aRestarted := newFixtureRuntime(t, nodeA, registry, root)
	aRestarted.mu.Lock()
	second, err := aRestarted.nextSignedEnvelope("PING", map[string]any{"readOnly": true}, now.Add(time.Second))
	aRestarted.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if second.Sequence != first.Sequence+1 {
		t.Fatalf("expected outbound sequence %d after restart, got %d", first.Sequence+1, second.Sequence)
	}

	bRestarted := newFixtureRuntime(t, nodeB, registry, root)
	bRestarted.mu.Lock()
	_, replayErr := bRestarted.acceptInboundEnvelope(first, now.Add(time.Second))
	bRestarted.mu.Unlock()
	if replayErr == nil {
		t.Fatal("expected replay watermark to survive restart")
	}
}

func TestPeerSessionRefusesVoteAuthorityAndMissingExecutionBlocker(t *testing.T) {
	registry, root, nodeA, _ := makePeerSessionFixture(t)

	cfg := nodeA.cfg
	cfg.VoteAuthority = true
	if err := writeJSON(filepath.Join(nodeA.dir, "config.json"), cfg, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := newPeerSessionRuntime(nodeA.dir, registry, 12, root, nodeA.statePath, 30*time.Second); err == nil {
		t.Fatal("expected voteAuthority=true runtime refusal")
	}

	cfg = nodeA.cfg
	cfg.ActivationBlockedReasons = []string{"GOVERNANCE_ACTIVATION_REQUIRED"}
	if err := writeJSON(filepath.Join(nodeA.dir, "config.json"), cfg, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := newPeerSessionRuntime(nodeA.dir, registry, 12, root, nodeA.statePath, 30*time.Second); err == nil {
		t.Fatal("expected missing live-execution blocker refusal")
	}
}

func TestReadOnlySessionCannotSignConsensusTraffic(t *testing.T) {
	_, _, nodeA, _ := makePeerSessionFixture(t)
	if _, err := signReadOnlyPeerEnvelope(nodeA.cfg, nodeA.keyID, nodeA.priv, 1, "VERIFY", map[string]any{"proposalHash": "x"}, time.Minute, time.Now().UTC()); err == nil {
		t.Fatal("expected VERIFY signing refusal")
	}
	if _, err := signReadOnlyPeerEnvelope(nodeA.cfg, nodeA.keyID, nodeA.priv, 1, "COMMIT", map[string]any{"proposalHash": "x"}, time.Minute, time.Now().UTC()); err == nil {
		t.Fatal("expected COMMIT signing refusal")
	}
}

func TestPlainHTTPPolicyIsLoopbackOnly(t *testing.T) {
	for _, raw := range []string{"http://localhost:9443", "http://127.0.0.1:9443", "http://[::1]:9443"} {
		u, err := url.Parse(raw)
		if err != nil {
			t.Fatal(err)
		}
		if !isSafePlainHTTPPeerTarget(u) {
			t.Fatalf("expected loopback HTTP target to be allowed: %s", raw)
		}
	}
	for _, raw := range []string{"http://example.com", "http://validator-b.local", "http://192.168.1.10:9443"} {
		u, err := url.Parse(raw)
		if err != nil {
			t.Fatal(err)
		}
		if isSafePlainHTTPPeerTarget(u) {
			t.Fatalf("expected non-loopback HTTP target rejection: %s", raw)
		}
	}
}
