package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"
)

func peerFixture(t *testing.T) (PeerTransportRegistry, PeerEnvelope, string) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatal(err)
	}
	genesis := "a" + string(make([]byte, 0))
	_ = genesis
	genesis = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	registry := PeerTransportRegistry{RegistryVersion: peerTransportRegistryProfile, ChainID: "stratum-devnet-1", GenesisDIRHash: genesis, ProtocolVersion: "POVI/1", Members: []PeerTransportMember{{ValidatorID: "validator-a", Keys: []PeerTransportKey{{KeyID: "validator-a:transport:v1", Purpose: "TRANSPORT", Algorithm: "ED25519_TRANSPORT_IDENTITY", PublicKeyDerB64: base64.StdEncoding.EncodeToString(der), ActiveFromHeight: 0, RetiredAtHeight: nil}}}}}
	root, err := peerRegistryRootAtHeight(registry, 12)
	if err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]any{"state": "CANDIDATE", "voteAuthority": false, "latestDIRHeight": 11})
	now := time.Now().UTC()
	e := PeerEnvelope{ProfileVersion: peerTransportProfile, Domain: peerTransportEnvelopeDomain, ChainID: registry.ChainID, NetworkName: "STRATUM Devnet", GenesisDIRHash: genesis, ProtocolVersion: registry.ProtocolVersion, SenderValidatorID: "validator-a", SenderKeyID: "validator-a:transport:v1", Sequence: 1, Nonce: "nonce-0001", IssuedAt: now.Add(-time.Second).Format(time.RFC3339Nano), ExpiresAt: now.Add(time.Minute).Format(time.RFC3339Nano), MessageType: "STATUS", Payload: payload}
	e.PayloadHash, err = peerPayloadHash(e.Payload)
	if err != nil {
		t.Fatal(err)
	}
	e.MessageHash, err = peerEnvelopeMessageHash(e)
	if err != nil {
		t.Fatal(err)
	}
	msg, err := hex.DecodeString(e.MessageHash)
	if err != nil {
		t.Fatal(err)
	}
	e.SignatureB64 = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, msg))
	return registry, e, root
}

func TestPeerEnvelopeVerifiesReadOnlyStatus(t *testing.T) {
	registry, e, root := peerFixture(t)
	result, err := verifyPeerEnvelope(registry, e, 12, root, time.Now().UTC(), 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Valid || !result.ReadOnly || result.SenderValidatorID != "validator-a" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestPeerEnvelopeRejectsWrongChainGenesisAndUnknownPeer(t *testing.T) {
	registry, e, root := peerFixture(t)
	e.ChainID = "other-chain"
	if _, err := verifyPeerEnvelope(registry, e, 12, root, time.Now().UTC(), 30*time.Second); err == nil {
		t.Fatal("expected wrong chain rejection")
	}
	_, e, root = peerFixture(t)
	e.GenesisDIRHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	if _, err := verifyPeerEnvelope(registry, e, 12, root, time.Now().UTC(), 30*time.Second); err == nil {
		t.Fatal("expected wrong Genesis rejection")
	}
	registry, e, root = peerFixture(t)
	e.SenderValidatorID = "validator-z"
	if _, err := verifyPeerEnvelope(registry, e, 12, root, time.Now().UTC(), 30*time.Second); err == nil {
		t.Fatal("expected unknown peer rejection")
	}
}

func TestPeerEnvelopeRejectsTamperingAndConsensusMessage(t *testing.T) {
	registry, e, root := peerFixture(t)
	e.Payload = json.RawMessage(`{"state":"ACTIVE"}`)
	if _, err := verifyPeerEnvelope(registry, e, 12, root, time.Now().UTC(), 30*time.Second); err == nil {
		t.Fatal("expected payload tamper rejection")
	}
	registry, e, root = peerFixture(t)
	e.MessageType = "VERIFY"
	if _, err := verifyPeerEnvelope(registry, e, 12, root, time.Now().UTC(), 30*time.Second); err == nil {
		t.Fatal("expected consensus-bearing message rejection")
	}
}

func TestPeerEnvelopeRejectsExpiredAndFutureMessages(t *testing.T) {
	registry, e, root := peerFixture(t)
	now := time.Now().UTC()
	e.ExpiresAt = now.Add(-2 * time.Minute).Format(time.RFC3339Nano)
	if _, err := verifyPeerEnvelope(registry, e, 12, root, now, 30*time.Second); err == nil {
		t.Fatal("expected stale envelope rejection")
	}
	registry, e, root = peerFixture(t)
	e.IssuedAt = now.Add(2 * time.Minute).Format(time.RFC3339Nano)
	e.ExpiresAt = now.Add(3 * time.Minute).Format(time.RFC3339Nano)
	if _, err := verifyPeerEnvelope(registry, e, 12, root, now, 30*time.Second); err == nil {
		t.Fatal("expected future envelope rejection")
	}
}

func TestPeerReplayProtectionSurvivesStateRoundTrip(t *testing.T) {
	registry, e, _ := peerFixture(t)
	state := PeerReplayState{ProfileVersion: peerTransportProfile, ChainID: registry.ChainID, LastSequence: map[string]uint64{}, SeenNonces: map[string]string{}}
	if err := applyPeerReplayProtection(&state, e); err != nil {
		t.Fatal(err)
	}
	if err := applyPeerReplayProtection(&state, e); err == nil {
		t.Fatal("expected duplicate sequence/nonce rejection")
	}
	b, err := json.Marshal(state)
	if err != nil {
		t.Fatal(err)
	}
	var recovered PeerReplayState
	if err := json.Unmarshal(b, &recovered); err != nil {
		t.Fatal(err)
	}
	e.Sequence = 2
	e.Nonce = "nonce-0002"
	if err := applyPeerReplayProtection(&recovered, e); err != nil {
		t.Fatal(err)
	}
	e.Sequence = 1
	e.Nonce = "nonce-0003"
	if err := applyPeerReplayProtection(&recovered, e); err == nil {
		t.Fatal("expected sequence rollback rejection after restart")
	}
}
