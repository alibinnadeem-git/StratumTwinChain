package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type PeerSyncGovernedProofBundle struct {
	ProfileVersion          string                    `json:"profileVersion"`
	ResponseType            string                    `json:"responseType"`
	ChainID                 string                    `json:"chainId"`
	GenesisDIRHash          string                    `json:"GenesisDIRHash"`
	ProtocolVersion         string                    `json:"protocolVersion"`
	ValidatorSet            SnapshotValidatorSet      `json:"validatorSet"`
	SnapshotCertificate     *SnapshotTrustCertificate `json:"snapshotCertificate"`
	ValidatorSetTransitions []ValidatorSetChangeProof `json:"validatorSetTransitions"`
	FinalityProofs          []DIRFinalityProof        `json:"finalityProofs"`
	GeneratedAt             string                    `json:"generatedAt"`
}

type GovernedSyncServingData struct {
	BaseValidatorSet  SnapshotValidatorSet
	Snapshot          *SnapshotTrustCertificate
	Proofs            map[int64]DIRFinalityProof
	Transitions       []ValidatorSetChangeProof
	TrustedPolicyHash string
}

func verifySyncValidatorTransition(proof ValidatorSetChangeProof, candidate PeerSyncTrustedHead, expectedChainID, trustedPolicyHash string, nextDIRHeight int64) (SnapshotValidatorSet, string, error) {
	if !isSHA256(strings.ToLower(trustedPolicyHash)) {
		return SnapshotValidatorSet{}, "", errors.New("independently trusted governance policy hash is required for validator-set transition")
	}
	if proof.Action.EffectiveHeight != nextDIRHeight {
		return SnapshotValidatorSet{}, "", fmt.Errorf("validator-set transition effective height %d does not match next DIR height %d", proof.Action.EffectiveHeight, nextDIRHeight)
	}
	verification, err := verifyValidatorSetChangeProof(proof, expectedChainID, strings.ToLower(trustedPolicyHash), candidate.ValidatorSetRoot)
	if err != nil {
		return SnapshotValidatorSet{}, "", fmt.Errorf("validator governance continuity verification failed: %w", err)
	}
	if verification.EffectiveHeight != nextDIRHeight || verification.PreviousValidatorSetRoot != candidate.ValidatorSetRoot {
		return SnapshotValidatorSet{}, "", errors.New("validator governance proof does not continue the locally trusted validator-set root")
	}
	root, err := snapshotValidatorSetRoot(proof.NextValidatorSet, nextDIRHeight)
	if err != nil {
		return SnapshotValidatorSet{}, "", err
	}
	if root != verification.NextValidatorSetRoot || root != proof.Action.NextValidatorSetRoot {
		return SnapshotValidatorSet{}, "", errors.New("governance-authorized next validator-set root does not match next validator set")
	}
	return proof.NextValidatorSet, root, nil
}

func (r *PeerSyncRuntime) applyGovernedProofBundle(bundle PeerSyncGovernedProofBundle, trustedPolicyHash, sourcePeerValidatorID string, now time.Time) (PeerSyncTrustedHead, error) {
	if bundle.ProfileVersion != peerSyncProfile || bundle.ResponseType != "SYNC_PROOF" {
		return PeerSyncTrustedHead{}, errors.New("invalid governed SYNC_PROOF bundle")
	}
	if bundle.ChainID != r.cfg.ChainID || !strings.EqualFold(bundle.GenesisDIRHash, r.cfg.GenesisDIRHash) || bundle.ProtocolVersion != r.cfg.ProtocolVersion {
		return PeerSyncTrustedHead{}, errors.New("governed SYNC_PROOF bundle trust context mismatch")
	}
	if bundle.ValidatorSet.ChainID != r.cfg.ChainID {
		return PeerSyncTrustedHead{}, errors.New("governed SYNC_PROOF validator set chainId mismatch")
	}
	if len(bundle.FinalityProofs) == 0 || len(bundle.FinalityProofs) > maxSyncProofsPerBundle {
		return PeerSyncTrustedHead{}, errors.New("governed SYNC_PROOF bundle must contain 1..512 finality proofs")
	}

	transitions := map[int64]ValidatorSetChangeProof{}
	for _, transition := range bundle.ValidatorSetTransitions {
		height := transition.Action.EffectiveHeight
		if height <= 0 {
			return PeerSyncTrustedHead{}, errors.New("validator-set transition effective height must be positive")
		}
		if _, exists := transitions[height]; exists {
			return PeerSyncTrustedHead{}, fmt.Errorf("duplicate validator-set transition at height %d", height)
		}
		transitions[height] = transition
	}
	usedTransitions := map[int64]bool{}
	candidate := r.trustedHead
	currentSet := bundle.ValidatorSet

	if bundle.SnapshotCertificate != nil && bundle.SnapshotCertificate.SnapshotHeight > candidate.Height {
		cert := *bundle.SnapshotCertificate
		root, err := snapshotValidatorSetRoot(currentSet, cert.SnapshotHeight)
		if err != nil {
			return PeerSyncTrustedHead{}, err
		}
		verified, err := verifySnapshotCertificate(currentSet, cert, r.cfg.ChainID, root, r.cfg.ProtocolVersion)
		if err != nil {
			return PeerSyncTrustedHead{}, fmt.Errorf("snapshot verification failed: %w", err)
		}
		candidate = PeerSyncTrustedHead{ProfileVersion: peerSyncProfile, ChainID: r.cfg.ChainID, GenesisDIRHash: strings.ToLower(r.cfg.GenesisDIRHash), ProtocolVersion: r.cfg.ProtocolVersion, Height: verified.SnapshotHeight, DIRHash: verified.DIRHash, StateRoot: verified.StateRoot, ValidatorSetRoot: verified.ValidatorSetRoot, VerifiedAt: now.UTC().Format(time.RFC3339Nano), SourcePeerValidatorID: sourcePeerValidatorID}
	}

	if candidate.Height > 0 {
		rootAtHead, err := snapshotValidatorSetRoot(currentSet, candidate.Height)
		if err != nil {
			return PeerSyncTrustedHead{}, err
		}
		if rootAtHead != candidate.ValidatorSetRoot {
			return PeerSyncTrustedHead{}, errors.New("bundle starting validator set does not match locally trusted validator-set root")
		}
	}

	for index, proof := range bundle.FinalityProofs {
		if proof.Header.Height <= candidate.Height {
			continue
		}
		if proof.Header.Height != candidate.Height+1 {
			return PeerSyncTrustedHead{}, fmt.Errorf("DIR proof discontinuity at bundle index %d: expected height %d, received %d", index, candidate.Height+1, proof.Header.Height)
		}
		nextHeight := proof.Header.Height
		expectedRoot, err := snapshotValidatorSetRoot(currentSet, nextHeight)
		if err != nil {
			return PeerSyncTrustedHead{}, err
		}
		root := expectedRoot
		if proof.Header.ValidatorSetRoot != expectedRoot {
			transition, ok := transitions[nextHeight]
			if !ok {
				return PeerSyncTrustedHead{}, fmt.Errorf("DIR at height %d binds a validator-set root not derivable from the trusted set and no governance transition proof was supplied", nextHeight)
			}
			currentSet, root, err = verifySyncValidatorTransition(transition, candidate, r.cfg.ChainID, trustedPolicyHash, nextHeight)
			if err != nil {
				return PeerSyncTrustedHead{}, err
			}
			usedTransitions[nextHeight] = true
		}
		if proof.Header.ValidatorSetRoot != root {
			return PeerSyncTrustedHead{}, fmt.Errorf("DIR at height %d does not bind the trusted or governance-authorized validator-set root", nextHeight)
		}
		verified, err := verifyDIRFinalityProof(currentSet, proof, r.cfg.ChainID, candidate.Height, candidate.DIRHash, root, r.cfg.ProtocolVersion)
		if err != nil {
			return PeerSyncTrustedHead{}, fmt.Errorf("DIR finality verification failed at height %d: %w", nextHeight, err)
		}
		candidate = PeerSyncTrustedHead{ProfileVersion: peerSyncProfile, ChainID: r.cfg.ChainID, GenesisDIRHash: strings.ToLower(r.cfg.GenesisDIRHash), ProtocolVersion: verified.ProtocolVersion, Height: verified.Height, DIRHash: verified.DIRHash, StateRoot: verified.StateRoot, ValidatorSetRoot: verified.ValidatorSetRoot, VerifiedAt: now.UTC().Format(time.RFC3339Nano), SourcePeerValidatorID: sourcePeerValidatorID}
	}
	for height := range transitions {
		if !usedTransitions[height] && height > r.trustedHead.Height && height <= candidate.Height {
			return PeerSyncTrustedHead{}, fmt.Errorf("unused validator-set transition proof at height %d", height)
		}
	}
	if candidate.Height <= r.trustedHead.Height {
		return r.trustedHead, nil
	}
	if err := savePeerSyncTrustedHeadAtomic(r.statePath, candidate); err != nil {
		return PeerSyncTrustedHead{}, err
	}
	r.trustedHead = candidate
	return candidate, nil
}

func loadValidatorSetTransitions(dir string) ([]ValidatorSetChangeProof, error) {
	if dir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	proofs := []ValidatorSetChangeProof{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}
		var proof ValidatorSetChangeProof
		if err := readJSON(filepath.Join(dir, entry.Name()), &proof); err != nil {
			return nil, fmt.Errorf("read validator-set transition %s: %w", entry.Name(), err)
		}
		proofs = append(proofs, proof)
	}
	sort.Slice(proofs, func(i, j int) bool { return proofs[i].Action.EffectiveHeight < proofs[j].Action.EffectiveHeight })
	return proofs, nil
}

func governedValidatorSetAtHeight(base SnapshotValidatorSet, transitions []ValidatorSetChangeProof, trustedPolicyHash, chainID string, height int64) (SnapshotValidatorSet, error) {
	current := base
	for _, transition := range transitions {
		if transition.Action.EffectiveHeight > height {
			break
		}
		previousRoot, err := snapshotValidatorSetRoot(current, transition.Action.EffectiveHeight-1)
		if err != nil {
			return SnapshotValidatorSet{}, err
		}
		candidate := PeerSyncTrustedHead{ValidatorSetRoot: previousRoot}
		next, _, err := verifySyncValidatorTransition(transition, candidate, chainID, trustedPolicyHash, transition.Action.EffectiveHeight)
		if err != nil {
			return SnapshotValidatorSet{}, err
		}
		current = next
	}
	return current, nil
}

func buildGovernedServingBundle(data GovernedSyncServingData, cfg BootstrapConfig, trustedHead PeerSyncTrustedHead, req PeerSyncProofRequest, now time.Time) (PeerSyncGovernedProofBundle, error) {
	if req.FromHeight < 0 || req.ToHeight <= req.FromHeight || req.ToHeight-req.FromHeight > maxSyncProofsPerBundle {
		return PeerSyncGovernedProofBundle{}, errors.New("governed SYNC_PROOF range is invalid")
	}
	if req.ToHeight > trustedHead.Height {
		return PeerSyncGovernedProofBundle{}, errors.New("governed SYNC_PROOF request exceeds durable locally verified head")
	}
	baseHeight := req.FromHeight
	if data.Snapshot != nil && data.Snapshot.SnapshotHeight > baseHeight {
		baseHeight = data.Snapshot.SnapshotHeight
	}
	startSet, err := governedValidatorSetAtHeight(data.BaseValidatorSet, data.Transitions, data.TrustedPolicyHash, cfg.ChainID, baseHeight)
	if err != nil {
		return PeerSyncGovernedProofBundle{}, err
	}
	proofs := []DIRFinalityProof{}
	for height := baseHeight + 1; height <= req.ToHeight; height++ {
		proof, ok := data.Proofs[height]
		if !ok {
			return PeerSyncGovernedProofBundle{}, fmt.Errorf("missing locally verified finality proof at height %d", height)
		}
		proofs = append(proofs, proof)
	}
	if len(proofs) == 0 {
		return PeerSyncGovernedProofBundle{}, errors.New("governed SYNC_PROOF bundle has no post-checkpoint finality proofs")
	}
	includedTransitions := []ValidatorSetChangeProof{}
	for _, transition := range data.Transitions {
		if transition.Action.EffectiveHeight > baseHeight && transition.Action.EffectiveHeight <= req.ToHeight {
			includedTransitions = append(includedTransitions, transition)
		}
	}
	return PeerSyncGovernedProofBundle{ProfileVersion: peerSyncProfile, ResponseType: "SYNC_PROOF", ChainID: cfg.ChainID, GenesisDIRHash: strings.ToLower(cfg.GenesisDIRHash), ProtocolVersion: cfg.ProtocolVersion, ValidatorSet: startSet, SnapshotCertificate: data.Snapshot, ValidatorSetTransitions: includedTransitions, FinalityProofs: proofs, GeneratedAt: now.UTC().Format(time.RFC3339Nano)}, nil
}

func verifyGovernedServingData(runtime *PeerSyncRuntime, data GovernedSyncServingData, source string, now time.Time) error {
	if len(data.Proofs) == 0 {
		return errors.New("governed sync serving finality proofs are not configured")
	}
	heights := make([]int64, 0, len(data.Proofs))
	for height := range data.Proofs {
		heights = append(heights, height)
	}
	sort.Slice(heights, func(i, j int) bool { return heights[i] < heights[j] })
	last := heights[len(heights)-1]
	for runtime.trustedHead.Height < last {
		to := runtime.trustedHead.Height + defaultSyncProofBatch
		if to > last {
			to = last
		}
		req := PeerSyncProofRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_PROOF", FromHeight: runtime.trustedHead.Height, ToHeight: to}
		bundle, err := buildGovernedServingBundle(data, runtime.cfg, PeerSyncTrustedHead{Height: last}, req, now)
		if err != nil {
			return err
		}
		before := runtime.trustedHead.Height
		if _, err := runtime.applyGovernedProofBundle(bundle, data.TrustedPolicyHash, source, now); err != nil {
			return err
		}
		if runtime.trustedHead.Height <= before {
			return errors.New("governed sync data did not advance durable trusted head")
		}
	}
	return nil
}

func governedPeerSyncHandler(session *PeerSessionRuntime, syncRuntime *PeerSyncRuntime, data GovernedSyncServingData) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "peerSyncProfile": peerSyncProfile, "governanceAuthenticatedTransitions": true, "state": session.cfg.State, "voteAuthority": false, "consensusParticipation": false, "trustedHeight": syncRuntime.trustedHead.Height, "trustedDIRHash": syncRuntime.trustedHead.DIRHash})
	})
	mux.HandleFunc("/v1/peer/message", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		defer req.Body.Close()
		body, err := io.ReadAll(io.LimitReader(req.Body, maxPeerEnvelopeBytes+1))
		if err != nil || int64(len(body)) > maxPeerEnvelopeBytes {
			http.Error(w, "invalid peer envelope", http.StatusBadRequest)
			return
		}
		var envelope PeerEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			http.Error(w, "invalid peer envelope", http.StatusBadRequest)
			return
		}
		if envelope.MessageType != "SYNC_HEAD" && envelope.MessageType != "SYNC_PROOF" {
			http.Error(w, "governed sync endpoint accepts read-only sync traffic only", http.StatusForbidden)
			return
		}
		now := time.Now().UTC()
		session.mu.Lock()
		_, err = session.acceptInboundEnvelope(envelope, now)
		var response PeerEnvelope
		if err == nil && envelope.MessageType == "SYNC_HEAD" {
			_, err = decodePeerSyncHeadRequest(envelope.Payload)
			if err == nil {
				response, err = session.nextSignedEnvelope("SYNC_HEAD", syncRuntime.headResponse(), now)
			}
		}
		if err == nil && envelope.MessageType == "SYNC_PROOF" {
			var proofReq PeerSyncProofRequest
			proofReq, err = decodePeerSyncProofRequest(envelope.Payload)
			if err == nil {
				var bundle PeerSyncGovernedProofBundle
				bundle, err = buildGovernedServingBundle(data, session.cfg, syncRuntime.trustedHead, proofReq, now)
				if err == nil {
					response, err = session.nextSignedEnvelope("SYNC_PROOF", bundle, now)
				}
			}
		}
		session.mu.Unlock()
		if err != nil {
			http.Error(w, "governed peer sync envelope rejected", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(response)
	})
	return mux
}

func loadGovernedSyncServingData(validatorSetPath, snapshotPath, proofDir, transitionDir, trustedPolicyHash string) (GovernedSyncServingData, error) {
	if validatorSetPath == "" || proofDir == "" || !isSHA256(strings.ToLower(trustedPolicyHash)) {
		return GovernedSyncServingData{}, errors.New("--sync-validator-set, --sync-proof-dir and --governance-policy-hash are required")
	}
	var set SnapshotValidatorSet
	if err := readJSON(validatorSetPath, &set); err != nil {
		return GovernedSyncServingData{}, err
	}
	var snapshot *SnapshotTrustCertificate
	if snapshotPath != "" {
		var cert SnapshotTrustCertificate
		if err := readJSON(snapshotPath, &cert); err != nil {
			return GovernedSyncServingData{}, err
		}
		snapshot = &cert
	}
	entries, err := os.ReadDir(proofDir)
	if err != nil {
		return GovernedSyncServingData{}, err
	}
	proofs := map[int64]DIRFinalityProof{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}
		proof, err := readFinalityProof(filepath.Join(proofDir, entry.Name()))
		if err != nil {
			return GovernedSyncServingData{}, err
		}
		if _, exists := proofs[proof.Header.Height]; exists {
			return GovernedSyncServingData{}, fmt.Errorf("duplicate finality proof at height %d", proof.Header.Height)
		}
		proofs[proof.Header.Height] = proof
	}
	transitions, err := loadValidatorSetTransitions(transitionDir)
	if err != nil {
		return GovernedSyncServingData{}, err
	}
	return GovernedSyncServingData{BaseValidatorSet: set, Snapshot: snapshot, Proofs: proofs, Transitions: transitions, TrustedPolicyHash: strings.ToLower(trustedPolicyHash)}, nil
}

func peerSyncGovernedServerCommand(args []string) error {
	fs := newFlagSet("serve-readonly-peer-sync-governed")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	listen := fs.String("listen", "127.0.0.1:9443", "listen address")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	syncHeadPath := fs.String("sync-head-state", "", "durable proof-verified sync head path")
	validatorSetPath := fs.String("sync-validator-set", "", "base validator-set JSON")
	snapshotPath := fs.String("sync-snapshot-cert", "", "optional snapshot trust certificate JSON")
	proofDir := fs.String("sync-proof-dir", "", "directory containing DIR finality proof JSON files")
	transitionDir := fs.String("sync-governance-dir", "", "directory containing validator-set governance transition proofs")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned governance policy hash")
	allowPlaintextLAN := fs.Bool("allow-plaintext-lan", false, "explicitly allow non-loopback HTTP behind a trusted TLS/reverse-proxy boundary")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" {
		return errors.New("--peer-registry and --peer-registry-root are required")
	}
	if !*allowPlaintextLAN && !isLoopbackListenAddress(*listen) {
		return errors.New("non-loopback plaintext listen refused")
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	if *syncHeadPath == "" {
		*syncHeadPath = filepath.Join(*dir, "state", "peer-sync-head.json")
	}
	var registry PeerTransportRegistry
	if err := readJSON(*registryPath, &registry); err != nil {
		return err
	}
	session, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *sessionStatePath, *maxSkew)
	if err != nil {
		return err
	}
	syncRuntime, err := newPeerSyncRuntime(session.cfg, *syncHeadPath)
	if err != nil {
		return err
	}
	data, err := loadGovernedSyncServingData(*validatorSetPath, *snapshotPath, *proofDir, *transitionDir, *policyHash)
	if err != nil {
		return err
	}
	if err := verifyGovernedServingData(syncRuntime, data, session.cfg.ValidatorID, time.Now().UTC()); err != nil {
		return fmt.Errorf("refusing to serve unverified governed sync data: %w", err)
	}
	server := &http.Server{Addr: *listen, Handler: governedPeerSyncHandler(session, syncRuntime, data), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 32 * 1024}
	fmt.Printf("STRATUM governance-authenticated read-only peer sync listening on %s; validator=%s; trustedHeight=%d; voteAuthority=false\n", *listen, session.cfg.ValidatorID, syncRuntime.trustedHead.Height)
	return server.ListenAndServe()
}

func postGovernedPeerEnvelope(endpoint string, envelope PeerEnvelope) (PeerEnvelope, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return PeerEnvelope{}, err
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return PeerEnvelope{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return PeerEnvelope{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return PeerEnvelope{}, fmt.Errorf("peer returned HTTP %d", resp.StatusCode)
	}
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxPeerEnvelopeBytes+1))
	if err != nil {
		return PeerEnvelope{}, err
	}
	if int64(len(responseBody)) > maxPeerEnvelopeBytes {
		return PeerEnvelope{}, errors.New("peer sync response too large")
	}
	var response PeerEnvelope
	if err := json.Unmarshal(responseBody, &response); err != nil {
		return PeerEnvelope{}, err
	}
	return response, nil
}

func peerSyncGovernedCommand(args []string) error {
	fs := newFlagSet("peer-sync-governed")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	target := fs.String("target", "", "peer base URL")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	syncHeadPath := fs.String("sync-head-state", "", "durable proof-verified sync head path")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned governance policy hash")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	batchSize := fs.Int64("batch-size", defaultSyncProofBatch, "DIR finality proofs requested per bundle")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" || *target == "" || !isSHA256(strings.ToLower(*policyHash)) {
		return errors.New("--peer-registry, --peer-registry-root, --target and --governance-policy-hash are required")
	}
	if *batchSize < 1 || *batchSize > maxSyncProofsPerBundle {
		return fmt.Errorf("--batch-size must be between 1 and %d", maxSyncProofsPerBundle)
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	if *syncHeadPath == "" {
		*syncHeadPath = filepath.Join(*dir, "state", "peer-sync-head.json")
	}
	base, err := url.Parse(*target)
	if err != nil || (base.Scheme != "https" && base.Scheme != "http") || base.Hostname() == "" {
		return errors.New("--target must be an http(s) URL with a host")
	}
	if base.Scheme == "http" && !isSafePlainHTTPPeerTarget(base) {
		return errors.New("plaintext HTTP peer sync refused for non-loopback target")
	}
	var registry PeerTransportRegistry
	if err := readJSON(*registryPath, &registry); err != nil {
		return err
	}
	session, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *sessionStatePath, *maxSkew)
	if err != nil {
		return err
	}
	syncRuntime, err := newPeerSyncRuntime(session.cfg, *syncHeadPath)
	if err != nil {
		return err
	}
	endpoint := strings.TrimRight(base.String(), "/") + "/v1/peer/message"
	trustedHash := syncRuntime.trustedHead.DIRHash
	headReq := PeerSyncHeadRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_HEAD", TrustedHeight: syncRuntime.trustedHead.Height, TrustedDIRHash: &trustedHash}
	session.mu.Lock()
	headEnvelope, err := session.nextSignedEnvelope("SYNC_HEAD", headReq, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return err
	}
	headResponse, err := postGovernedPeerEnvelope(endpoint, headEnvelope)
	if err != nil {
		return err
	}
	session.mu.Lock()
	_, err = session.acceptInboundEnvelope(headResponse, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return err
	}
	var remoteHead PeerSyncHeadResponse
	if headResponse.MessageType != "SYNC_HEAD" || json.Unmarshal(headResponse.Payload, &remoteHead) != nil {
		return errors.New("invalid SYNC_HEAD response")
	}
	if remoteHead.ChainID != session.cfg.ChainID || !strings.EqualFold(remoteHead.GenesisDIRHash, session.cfg.GenesisDIRHash) || remoteHead.ProtocolVersion != session.cfg.ProtocolVersion {
		return errors.New("remote SYNC_HEAD trust context mismatch")
	}
	for syncRuntime.trustedHead.Height < remoteHead.LatestHeight {
		to := syncRuntime.trustedHead.Height + *batchSize
		if to > remoteHead.LatestHeight {
			to = remoteHead.LatestHeight
		}
		req := PeerSyncProofRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_PROOF", FromHeight: syncRuntime.trustedHead.Height, ToHeight: to}
		session.mu.Lock()
		envelope, err := session.nextSignedEnvelope("SYNC_PROOF", req, time.Now().UTC())
		session.mu.Unlock()
		if err != nil {
			return err
		}
		response, err := postGovernedPeerEnvelope(endpoint, envelope)
		if err != nil {
			return err
		}
		session.mu.Lock()
		verification, err := session.acceptInboundEnvelope(response, time.Now().UTC())
		session.mu.Unlock()
		if err != nil {
			return err
		}
		if response.MessageType != "SYNC_PROOF" {
			return errors.New("expected SYNC_PROOF response")
		}
		var bundle PeerSyncGovernedProofBundle
		if err := json.Unmarshal(response.Payload, &bundle); err != nil {
			return err
		}
		if _, err := syncRuntime.applyGovernedProofBundle(bundle, strings.ToLower(*policyHash), verification.SenderValidatorID, time.Now().UTC()); err != nil {
			return err
		}
	}
	fmt.Printf("Governance-authenticated sync complete: trustedHeight=%d DIR=%s validatorSetRoot=%s state=%s voteAuthority=false consensusParticipation=false\n", syncRuntime.trustedHead.Height, syncRuntime.trustedHead.DIRHash, syncRuntime.trustedHead.ValidatorSetRoot, session.cfg.State)
	return nil
}
