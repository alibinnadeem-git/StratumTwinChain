package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const peerSessionProfile = "STRATUM-PEER-SESSION/1"

const maxPeerEnvelopeBytes int64 = 256 * 1024

type PeerSessionState struct {
	ProfileVersion   string          `json:"profileVersion"`
	ChainID          string          `json:"chainId"`
	OutboundSequence uint64          `json:"outboundSequence"`
	Replay           PeerReplayState `json:"replay"`
	UpdatedAt        string          `json:"updatedAt"`
}

type PeerSessionRuntime struct {
	mu                   sync.Mutex
	cfg                  BootstrapConfig
	registry             PeerTransportRegistry
	height               int64
	peerRegistryRoot     string
	statePath            string
	state                PeerSessionState
	transportPrivateKey  ed25519.PrivateKey
	localTransportKeyID  string
	maxClockSkew         time.Duration
}

func loadLocalTransportPrivateKey(dir string) (ed25519.PrivateKey, error) {
	b, err := os.ReadFile(filepath.Join(dir, "keys", "private", "transport.pk8"))
	if err != nil { return nil, err }
	parsed, err := x509.ParsePKCS8PrivateKey(b)
	if err != nil { return nil, fmt.Errorf("parse TRANSPORT private key: %w", err) }
	priv, ok := parsed.(ed25519.PrivateKey)
	if !ok { return nil, errors.New("TRANSPORT private key is not Ed25519") }
	return priv, nil
}

func validateLocalPeerTransportBinding(cfg BootstrapConfig, registry PeerTransportRegistry, height int64) (string, error) {
	if cfg.State != candidateState || cfg.VoteAuthority {
		return "", errors.New("read-only peer runtime requires CANDIDATE state with voteAuthority=false")
	}
	if !contains(cfg.ActivationBlockedReasons, "LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED") {
		return "", errors.New("read-only peer runtime requires LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED safety blocker")
	}
	if cfg.ChainID != registry.ChainID || !strings.EqualFold(cfg.GenesisDIRHash, registry.GenesisDIRHash) || cfg.ProtocolVersion != registry.ProtocolVersion {
		return "", errors.New("local validator trust context does not match peer registry")
	}
	key, err := activePeerTransportKey(registry, cfg.ValidatorID, height)
	if err != nil { return "", err }
	localRef, ok := cfg.Keys["TRANSPORT"]
	if !ok || localRef.Algorithm != "ED25519_TRANSPORT_IDENTITY" {
		return "", errors.New("local TRANSPORT key metadata missing or unsupported")
	}
	if localRef.PublicKeyB64 != key.PublicKeyDerB64 {
		return "", errors.New("local TRANSPORT public key does not match trusted peer registry")
	}
	return key.KeyID, nil
}

func defaultPeerSessionState(chainID string) PeerSessionState {
	return PeerSessionState{
		ProfileVersion: peerSessionProfile,
		ChainID: chainID,
		Replay: PeerReplayState{
			ProfileVersion: peerTransportProfile,
			ChainID: chainID,
			LastSequence: map[string]uint64{},
			SeenNonces: map[string]string{},
			UpdatedAt: time.Now().UTC().Format(time.RFC3339Nano),
		},
		UpdatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
}

func loadPeerSessionState(path, chainID string) (PeerSessionState, error) {
	state := defaultPeerSessionState(chainID)
	if path == "" { return state, nil }
	if _, err := os.Stat(path); os.IsNotExist(err) { return state, nil } else if err != nil { return PeerSessionState{}, err }
	if err := readJSON(path, &state); err != nil { return PeerSessionState{}, err }
	if state.ProfileVersion != peerSessionProfile || state.ChainID != chainID {
		return PeerSessionState{}, errors.New("peer session state trust context mismatch")
	}
	if state.Replay.LastSequence == nil { state.Replay.LastSequence = map[string]uint64{} }
	if state.Replay.SeenNonces == nil { state.Replay.SeenNonces = map[string]string{} }
	if state.Replay.ProfileVersion != peerTransportProfile || state.Replay.ChainID != chainID {
		return PeerSessionState{}, errors.New("embedded peer replay state trust context mismatch")
	}
	return state, nil
}

func savePeerSessionStateAtomic(path string, state PeerSessionState) error {
	if path == "" { return nil }
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil { return err }
	state.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	b, err := json.MarshalIndent(state, "", "  ")
	if err != nil { return err }
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(b, '\n'), 0o600); err != nil { return err }
	if err := os.Chmod(tmp, 0o600); err != nil { return err }
	if err := os.Rename(tmp, path); err != nil { return err }
	return nil
}

func randomPeerNonce() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil { return "", err }
	return hex.EncodeToString(b), nil
}

func signReadOnlyPeerEnvelope(cfg BootstrapConfig, keyID string, priv ed25519.PrivateKey, sequence uint64, messageType string, payload any, ttl time.Duration, now time.Time) (PeerEnvelope, error) {
	if !readOnlyPeerMessageTypes[messageType] { return PeerEnvelope{}, errors.New("read-only session cannot sign consensus-bearing message type") }
	if sequence == 0 { return PeerEnvelope{}, errors.New("peer envelope sequence must be positive") }
	if ttl <= 0 || ttl > 5*time.Minute { return PeerEnvelope{}, errors.New("peer envelope TTL must be >0 and <=5m") }
	payloadBytes, err := json.Marshal(payload)
	if err != nil { return PeerEnvelope{}, err }
	payloadHash, err := peerPayloadHash(payloadBytes)
	if err != nil { return PeerEnvelope{}, err }
	nonce, err := randomPeerNonce()
	if err != nil { return PeerEnvelope{}, err }
	now = now.UTC()
	e := PeerEnvelope{
		ProfileVersion: peerTransportProfile,
		Domain: peerTransportEnvelopeDomain,
		ChainID: cfg.ChainID,
		NetworkName: cfg.NetworkName,
		GenesisDIRHash: strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		SenderValidatorID: cfg.ValidatorID,
		SenderKeyID: keyID,
		Sequence: sequence,
		Nonce: nonce,
		IssuedAt: now.Format(time.RFC3339Nano),
		ExpiresAt: now.Add(ttl).Format(time.RFC3339Nano),
		MessageType: messageType,
		Payload: payloadBytes,
		PayloadHash: payloadHash,
	}
	msgHash, err := peerEnvelopeMessageHash(e)
	if err != nil { return PeerEnvelope{}, err }
	e.MessageHash = msgHash
	msgBytes, err := hex.DecodeString(msgHash)
	if err != nil { return PeerEnvelope{}, err }
	e.SignatureB64 = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, msgBytes))
	return e, nil
}

func newPeerSessionRuntime(dir string, registry PeerTransportRegistry, height int64, expectedRoot, statePath string, maxClockSkew time.Duration) (*PeerSessionRuntime, error) {
	if height < 0 { return nil, errors.New("height must be non-negative") }
	if !isSHA256(expectedRoot) { return nil, errors.New("peer registry root must be SHA-256") }
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil { return nil, err }
	root, err := peerRegistryRootAtHeight(registry, height)
	if err != nil { return nil, err }
	if root != expectedRoot { return nil, errors.New("trusted peer registry root mismatch") }
	keyID, err := validateLocalPeerTransportBinding(cfg, registry, height)
	if err != nil { return nil, err }
	priv, err := loadLocalTransportPrivateKey(dir)
	if err != nil { return nil, err }
	state, err := loadPeerSessionState(statePath, cfg.ChainID)
	if err != nil { return nil, err }
	return &PeerSessionRuntime{cfg:cfg, registry:registry, height:height, peerRegistryRoot:root, statePath:statePath, state:state, transportPrivateKey:priv, localTransportKeyID:keyID, maxClockSkew:maxClockSkew}, nil
}

func (r *PeerSessionRuntime) nextSignedEnvelope(messageType string, payload any, now time.Time) (PeerEnvelope, error) {
	r.state.OutboundSequence++
	e, err := signReadOnlyPeerEnvelope(r.cfg, r.localTransportKeyID, r.transportPrivateKey, r.state.OutboundSequence, messageType, payload, 90*time.Second, now)
	if err != nil { r.state.OutboundSequence--; return PeerEnvelope{}, err }
	if err := savePeerSessionStateAtomic(r.statePath, r.state); err != nil { r.state.OutboundSequence--; return PeerEnvelope{}, err }
	return e, nil
}

func (r *PeerSessionRuntime) acceptInboundEnvelope(e PeerEnvelope, now time.Time) (PeerEnvelopeVerification, error) {
	result, err := verifyPeerEnvelope(r.registry, e, r.height, r.peerRegistryRoot, now, r.maxClockSkew)
	if err != nil { return PeerEnvelopeVerification{}, err }
	prunePeerReplayState(&r.state.Replay, now)
	if err := applyPeerReplayProtection(&r.state.Replay, e); err != nil { return PeerEnvelopeVerification{}, err }
	if err := savePeerSessionStateAtomic(r.statePath, r.state); err != nil { return PeerEnvelopeVerification{}, err }
	return result, nil
}

func (r *PeerSessionRuntime) responseFor(e PeerEnvelope, verification PeerEnvelopeVerification, now time.Time) (PeerEnvelope, error) {
	switch e.MessageType {
	case "PING", "STATUS":
		return r.nextSignedEnvelope("STATUS", map[string]any{
			"validatorId": r.cfg.ValidatorID,
			"friendlyLabel": r.cfg.FriendlyLabel,
			"state": r.cfg.State,
			"voteAuthority": false,
			"readOnly": true,
			"peerSessionProfile": peerSessionProfile,
			"peerTransportProfile": peerTransportProfile,
			"acceptedMessageHash": verification.MessageHash,
			"height": r.height,
			"observedAt": now.UTC().Format(time.RFC3339Nano),
		}, now)
	case "TRUST_ROOTS":
		return r.nextSignedEnvelope("TRUST_ROOTS", map[string]any{
			"chainId": r.cfg.ChainID,
			"networkName": r.cfg.NetworkName,
			"GenesisDIRHash": strings.ToLower(r.cfg.GenesisDIRHash),
			"protocolVersion": r.cfg.ProtocolVersion,
			"peerRegistryRoot": r.peerRegistryRoot,
			"height": r.height,
			"readOnly": true,
		}, now)
	default:
		return PeerEnvelope{}, errors.New("unsupported read-only peer message type")
	}
}

func (r *PeerSessionRuntime) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodGet { http.Error(w, "method not allowed", http.StatusMethodNotAllowed); return }
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok":true,"profile":peerSessionProfile,"state":r.cfg.State,"voteAuthority":false,"readOnly":true})
	})
	mux.HandleFunc("/v1/peer/message", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost { http.Error(w, "method not allowed", http.StatusMethodNotAllowed); return }
		defer req.Body.Close()
		body, err := io.ReadAll(io.LimitReader(req.Body, maxPeerEnvelopeBytes+1))
		if err != nil || int64(len(body)) > maxPeerEnvelopeBytes { http.Error(w, "invalid peer envelope", http.StatusBadRequest); return }
		var e PeerEnvelope
		if err := json.Unmarshal(body, &e); err != nil { http.Error(w, "invalid peer envelope", http.StatusBadRequest); return }
		now := time.Now().UTC()
		r.mu.Lock()
		verification, err := r.acceptInboundEnvelope(e, now)
		if err == nil {
			var response PeerEnvelope
			response, err = r.responseFor(e, verification, now)
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Cache-Control", "no-store")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(response)
			}
		}
		r.mu.Unlock()
		if err != nil { http.Error(w, "peer envelope rejected", http.StatusUnauthorized); return }
	})
	return mux
}

func isLoopbackListenAddress(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil { return false }
	if host == "localhost" { return true }
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func peerSessionServerCommand(args []string) error {
	fs := newFlagSet("serve-readonly-peer")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted chain height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	listen := fs.String("listen", "127.0.0.1:9443", "listen address")
	statePath := fs.String("session-state", "", "durable peer session state path")
	allowPlaintextLAN := fs.Bool("allow-plaintext-lan", false, "explicitly allow non-loopback HTTP; use only behind a trusted TLS/reverse-proxy boundary")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	if err := fs.Parse(args); err != nil { return err }
	if *registryPath == "" || *expectedRoot == "" { return errors.New("--peer-registry and --peer-registry-root are required") }
	if !*allowPlaintextLAN && !isLoopbackListenAddress(*listen) { return errors.New("non-loopback plaintext listen refused; terminate TLS in front or pass --allow-plaintext-lan explicitly") }
	if *statePath == "" { *statePath = filepath.Join(*dir, "state", "peer-session.json") }
	var registry PeerTransportRegistry
	if err := readJSON(*registryPath, &registry); err != nil { return err }
	runtime, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *statePath, *maxSkew)
	if err != nil { return err }
	server := &http.Server{Addr:*listen, Handler:runtime.handler(), ReadHeaderTimeout:5*time.Second, ReadTimeout:10*time.Second, WriteTimeout:10*time.Second, IdleTimeout:30*time.Second, MaxHeaderBytes:32*1024}
	fmt.Printf("STRATUM read-only peer session listening on %s; validator=%s; voteAuthority=false\n", *listen, runtime.cfg.ValidatorID)
	fmt.Println("Allowed message types: PING, STATUS, TRUST_ROOTS. Consensus-bearing peer traffic is rejected.")
	return server.ListenAndServe()
}

func newFlagSet(name string) *flag.FlagSet { return flag.NewFlagSet(name, flag.ContinueOnError) }

func peerProbeCommand(args []string) error {
	fs := newFlagSet("peer-probe")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted chain height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	target := fs.String("target", "", "peer base URL, for example https://validator-b.example")
	statePath := fs.String("session-state", "", "durable peer session state path")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	if err := fs.Parse(args); err != nil { return err }
	if *registryPath == "" || *expectedRoot == "" || *target == "" { return errors.New("--peer-registry, --peer-registry-root and --target are required") }
	if *statePath == "" { *statePath = filepath.Join(*dir, "state", "peer-session.json") }
	base, err := url.Parse(*target); if err != nil || (base.Scheme != "https" && base.Scheme != "http") { return errors.New("--target must be an http(s) URL") }
	if base.Scheme == "http" && base.Hostname() != "localhost" && net.ParseIP(base.Hostname()) != nil && !net.ParseIP(base.Hostname()).IsLoopback() { return errors.New("plaintext HTTP peer probe refused for non-loopback target") }
	var registry PeerTransportRegistry; if err := readJSON(*registryPath, &registry); err != nil { return err }
	runtime, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *statePath, *maxSkew); if err != nil { return err }
	runtime.mu.Lock(); ping, err := runtime.nextSignedEnvelope("PING", map[string]any{"request":"STATUS","readOnly":true}, time.Now().UTC()); runtime.mu.Unlock(); if err != nil { return err }
	body, err := json.Marshal(ping); if err != nil { return err }
	endpoint := strings.TrimRight(base.String(), "/") + "/v1/peer/message"
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body)); if err != nil { return err }
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout:10*time.Second}
	resp, err := client.Do(req); if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK { return fmt.Errorf("peer returned HTTP %d", resp.StatusCode) }
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxPeerEnvelopeBytes+1)); if err != nil { return err }
	if int64(len(responseBody)) > maxPeerEnvelopeBytes { return errors.New("peer response too large") }
	var response PeerEnvelope; if err := json.Unmarshal(responseBody, &response); err != nil { return err }
	runtime.mu.Lock(); verification, err := runtime.acceptInboundEnvelope(response, time.Now().UTC()); runtime.mu.Unlock(); if err != nil { return err }
	if response.MessageType != "STATUS" { return fmt.Errorf("expected STATUS response, got %s", response.MessageType) }
	out, _ := json.MarshalIndent(map[string]any{"connected":true,"peerValidatorId":verification.SenderValidatorID,"messageHash":verification.MessageHash,"peerRegistryRoot":verification.PeerRegistryRoot,"readOnly":true,"voteAuthority":false}, "", "  ")
	fmt.Println(string(out))
	return nil
}
