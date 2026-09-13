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
	"runtime"
	"sort"
	"strings"
	"time"
)

const peerSyncProfile = "STRATUM-PEER-SYNC/1"
const maxSyncProofsPerBundle = 512
const defaultSyncProofBatch = 32

type PeerSyncTrustedHead struct {
	ProfileVersion        string `json:"profileVersion"`
	ChainID               string `json:"chainId"`
	GenesisDIRHash        string `json:"GenesisDIRHash"`
	ProtocolVersion       string `json:"protocolVersion"`
	Height                int64  `json:"height"`
	DIRHash               string `json:"DIRHash"`
	StateRoot             string `json:"stateRoot"`
	ValidatorSetRoot      string `json:"validatorSetRoot"`
	VerifiedAt            string `json:"verifiedAt"`
	SourcePeerValidatorID string `json:"sourcePeerValidatorId"`
}

type PeerSyncHeadRequest struct {
	ProfileVersion string  `json:"profileVersion"`
	RequestType    string  `json:"requestType"`
	TrustedHeight  int64   `json:"trustedHeight"`
	TrustedDIRHash *string `json:"trustedDIRHash"`
}

type PeerSyncHeadResponse struct {
	ProfileVersion   string `json:"profileVersion"`
	ResponseType     string `json:"responseType"`
	ChainID          string `json:"chainId"`
	GenesisDIRHash   string `json:"GenesisDIRHash"`
	ProtocolVersion  string `json:"protocolVersion"`
	LatestHeight     int64  `json:"latestHeight"`
	LatestDIRHash    string `json:"latestDIRHash"`
	LatestStateRoot  string `json:"latestStateRoot"`
	ValidatorSetRoot string `json:"validatorSetRoot"`
	SnapshotHeight   *int64 `json:"snapshotHeight"`
}

type PeerSyncProofRequest struct {
	ProfileVersion string `json:"profileVersion"`
	RequestType    string `json:"requestType"`
	FromHeight     int64  `json:"fromHeight"`
	ToHeight       int64  `json:"toHeight"`
}

type PeerSyncProofBundle struct {
	ProfileVersion      string                    `json:"profileVersion"`
	ResponseType        string                    `json:"responseType"`
	ChainID             string                    `json:"chainId"`
	GenesisDIRHash      string                    `json:"GenesisDIRHash"`
	ProtocolVersion     string                    `json:"protocolVersion"`
	ValidatorSet        SnapshotValidatorSet      `json:"validatorSet"`
	SnapshotCertificate *SnapshotTrustCertificate `json:"snapshotCertificate"`
	FinalityProofs      []DIRFinalityProof        `json:"finalityProofs"`
	GeneratedAt         string                    `json:"generatedAt"`
}

type PeerSyncRuntime struct {
	cfg                 BootstrapConfig
	statePath           string
	trustedHead         PeerSyncTrustedHead
	validatorSet        *SnapshotValidatorSet
	snapshotCertificate *SnapshotTrustCertificate
	proofs              map[int64]DIRFinalityProof
}

func defaultPeerSyncTrustedHead(cfg BootstrapConfig) PeerSyncTrustedHead {
	return PeerSyncTrustedHead{
		ProfileVersion:        peerSyncProfile,
		ChainID:               cfg.ChainID,
		GenesisDIRHash:        strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:       cfg.ProtocolVersion,
		Height:                0,
		DIRHash:               strings.ToLower(cfg.GenesisDIRHash),
		VerifiedAt:            time.Now().UTC().Format(time.RFC3339Nano),
		SourcePeerValidatorID: "GENESIS",
	}
}

func validatePeerSyncTrustContext(cfg BootstrapConfig, head PeerSyncTrustedHead) error {
	if head.ProfileVersion != peerSyncProfile {
		return errors.New("unsupported trusted-head profile")
	}
	if head.ChainID != cfg.ChainID || !strings.EqualFold(head.GenesisDIRHash, cfg.GenesisDIRHash) || head.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("peer sync trusted-head trust context mismatch")
	}
	if head.Height < 0 {
		return errors.New("trusted-head height must be non-negative")
	}
	if !isSHA256(strings.ToLower(head.DIRHash)) {
		return errors.New("trusted-head DIRHash must be SHA-256")
	}
	if head.Height > 0 {
		if !isSHA256(strings.ToLower(head.StateRoot)) || !isSHA256(strings.ToLower(head.ValidatorSetRoot)) {
			return errors.New("non-genesis trusted head requires stateRoot and validatorSetRoot")
		}
	}
	return nil
}

func loadPeerSyncTrustedHead(path string, cfg BootstrapConfig) (PeerSyncTrustedHead, error) {
	head := defaultPeerSyncTrustedHead(cfg)
	if path == "" {
		return head, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return head, nil
	} else if err != nil {
		return PeerSyncTrustedHead{}, err
	}
	if err := readJSON(path, &head); err != nil {
		return PeerSyncTrustedHead{}, err
	}
	if err := validatePeerSyncTrustContext(cfg, head); err != nil {
		return PeerSyncTrustedHead{}, err
	}
	return head, nil
}

func savePeerSyncTrustedHeadAtomic(path string, head PeerSyncTrustedHead) error {
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(head, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	cleanup := func() { _ = os.Remove(tmp) }
	if _, err := f.Write(append(b, '\n')); err != nil {
		_ = f.Close()
		cleanup()
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		cleanup()
		return err
	}
	if err := f.Close(); err != nil {
		cleanup()
		return err
	}
	if runtime.GOOS == "windows" {
		_ = os.Remove(path)
	}
	if err := os.Rename(tmp, path); err != nil {
		cleanup()
		return err
	}
	if err := syncParentDirectoryAfterRename(path); err != nil {
		return err
	}
	return nil
}

func newPeerSyncRuntime(cfg BootstrapConfig, statePath string) (*PeerSyncRuntime, error) {
	if cfg.State != candidateState || cfg.VoteAuthority {
		return nil, errors.New("proof-verifying sync runtime requires CANDIDATE state with voteAuthority=false")
	}
	head, err := loadPeerSyncTrustedHead(statePath, cfg)
	if err != nil {
		return nil, err
	}
	return &PeerSyncRuntime{cfg: cfg, statePath: statePath, trustedHead: head, proofs: map[int64]DIRFinalityProof{}}, nil
}

func (r *PeerSyncRuntime) configureServingData(set SnapshotValidatorSet, cert *SnapshotTrustCertificate, proofs []DIRFinalityProof) error {
	if set.ChainID != r.cfg.ChainID {
		return errors.New("sync serving validator set chainId mismatch")
	}
	byHeight := map[int64]DIRFinalityProof{}
	for _, proof := range proofs {
		if proof.Header.Height <= 0 {
			return errors.New("sync serving proof height must be positive")
		}
		if _, exists := byHeight[proof.Header.Height]; exists {
			return fmt.Errorf("duplicate finality proof at height %d", proof.Header.Height)
		}
		byHeight[proof.Header.Height] = proof
	}
	r.validatorSet = &set
	r.snapshotCertificate = cert
	r.proofs = byHeight
	return nil
}

func (r *PeerSyncRuntime) headResponse() PeerSyncHeadResponse {
	var snapshotHeight *int64
	if r.snapshotCertificate != nil {
		h := r.snapshotCertificate.SnapshotHeight
		snapshotHeight = &h
	}
	return PeerSyncHeadResponse{
		ProfileVersion:   peerSyncProfile,
		ResponseType:     "SYNC_HEAD",
		ChainID:          r.cfg.ChainID,
		GenesisDIRHash:   strings.ToLower(r.cfg.GenesisDIRHash),
		ProtocolVersion:  r.cfg.ProtocolVersion,
		LatestHeight:     r.trustedHead.Height,
		LatestDIRHash:    r.trustedHead.DIRHash,
		LatestStateRoot:  r.trustedHead.StateRoot,
		ValidatorSetRoot: r.trustedHead.ValidatorSetRoot,
		SnapshotHeight:   snapshotHeight,
	}
}

func (r *PeerSyncRuntime) proofBundle(req PeerSyncProofRequest, now time.Time) (PeerSyncProofBundle, error) {
	if req.ProfileVersion != peerSyncProfile || req.RequestType != "SYNC_PROOF" {
		return PeerSyncProofBundle{}, errors.New("invalid SYNC_PROOF request")
	}
	if req.FromHeight < 0 || req.ToHeight <= req.FromHeight {
		return PeerSyncProofBundle{}, errors.New("SYNC_PROOF range is invalid")
	}
	if req.ToHeight-req.FromHeight > maxSyncProofsPerBundle {
		return PeerSyncProofBundle{}, fmt.Errorf("SYNC_PROOF range exceeds %d proofs", maxSyncProofsPerBundle)
	}
	if req.ToHeight > r.trustedHead.Height {
		return PeerSyncProofBundle{}, errors.New("SYNC_PROOF request exceeds durable locally verified head")
	}
	if r.validatorSet == nil {
		return PeerSyncProofBundle{}, errors.New("SYNC_PROOF serving data is not configured")
	}
	proofs := make([]DIRFinalityProof, 0, req.ToHeight-req.FromHeight)
	for height := req.FromHeight + 1; height <= req.ToHeight; height++ {
		proof, ok := r.proofs[height]
		if !ok {
			return PeerSyncProofBundle{}, fmt.Errorf("missing locally verified finality proof at height %d", height)
		}
		proofs = append(proofs, proof)
	}
	return PeerSyncProofBundle{
		ProfileVersion:      peerSyncProfile,
		ResponseType:        "SYNC_PROOF",
		ChainID:             r.cfg.ChainID,
		GenesisDIRHash:      strings.ToLower(r.cfg.GenesisDIRHash),
		ProtocolVersion:     r.cfg.ProtocolVersion,
		ValidatorSet:        *r.validatorSet,
		SnapshotCertificate: r.snapshotCertificate,
		FinalityProofs:      proofs,
		GeneratedAt:         now.UTC().Format(time.RFC3339Nano),
	}, nil
}

func (r *PeerSyncRuntime) applyProofBundle(bundle PeerSyncProofBundle, sourcePeerValidatorID string, now time.Time) (PeerSyncTrustedHead, error) {
	if bundle.ProfileVersion != peerSyncProfile || bundle.ResponseType != "SYNC_PROOF" {
		return PeerSyncTrustedHead{}, errors.New("invalid SYNC_PROOF bundle")
	}
	if bundle.ChainID != r.cfg.ChainID || !strings.EqualFold(bundle.GenesisDIRHash, r.cfg.GenesisDIRHash) || bundle.ProtocolVersion != r.cfg.ProtocolVersion {
		return PeerSyncTrustedHead{}, errors.New("SYNC_PROOF bundle trust context mismatch")
	}
	if bundle.ValidatorSet.ChainID != r.cfg.ChainID {
		return PeerSyncTrustedHead{}, errors.New("SYNC_PROOF validator set chainId mismatch")
	}
	if len(bundle.FinalityProofs) == 0 || len(bundle.FinalityProofs) > maxSyncProofsPerBundle {
		return PeerSyncTrustedHead{}, errors.New("SYNC_PROOF bundle must contain 1..512 finality proofs")
	}

	candidate := r.trustedHead
	if bundle.SnapshotCertificate != nil && bundle.SnapshotCertificate.SnapshotHeight > candidate.Height {
		cert := *bundle.SnapshotCertificate
		root, err := snapshotValidatorSetRoot(bundle.ValidatorSet, cert.SnapshotHeight)
		if err != nil {
			return PeerSyncTrustedHead{}, err
		}
		verified, err := verifySnapshotCertificate(bundle.ValidatorSet, cert, r.cfg.ChainID, root, r.cfg.ProtocolVersion)
		if err != nil {
			return PeerSyncTrustedHead{}, fmt.Errorf("snapshot verification failed: %w", err)
		}
		candidate = PeerSyncTrustedHead{
			ProfileVersion:        peerSyncProfile,
			ChainID:               r.cfg.ChainID,
			GenesisDIRHash:        strings.ToLower(r.cfg.GenesisDIRHash),
			ProtocolVersion:       r.cfg.ProtocolVersion,
			Height:                verified.SnapshotHeight,
			DIRHash:               verified.DIRHash,
			StateRoot:             verified.StateRoot,
			ValidatorSetRoot:      verified.ValidatorSetRoot,
			VerifiedAt:            now.UTC().Format(time.RFC3339Nano),
			SourcePeerValidatorID: sourcePeerValidatorID,
		}
	}

	for index, proof := range bundle.FinalityProofs {
		if proof.Header.Height <= candidate.Height {
			continue
		}
		if proof.Header.Height != candidate.Height+1 {
			return PeerSyncTrustedHead{}, fmt.Errorf("DIR proof discontinuity at bundle index %d: expected height %d, received %d", index, candidate.Height+1, proof.Header.Height)
		}
		root, err := snapshotValidatorSetRoot(bundle.ValidatorSet, proof.Header.Height)
		if err != nil {
			return PeerSyncTrustedHead{}, err
		}
		if candidate.ValidatorSetRoot != "" && root != candidate.ValidatorSetRoot {
			return PeerSyncTrustedHead{}, errors.New("validator-set root transition requires separately verified governance continuity")
		}
		verified, err := verifyDIRFinalityProof(bundle.ValidatorSet, proof, r.cfg.ChainID, candidate.Height, candidate.DIRHash, root, r.cfg.ProtocolVersion)
		if err != nil {
			return PeerSyncTrustedHead{}, fmt.Errorf("DIR finality verification failed at height %d: %w", proof.Header.Height, err)
		}
		candidate = PeerSyncTrustedHead{
			ProfileVersion:        peerSyncProfile,
			ChainID:               r.cfg.ChainID,
			GenesisDIRHash:        strings.ToLower(r.cfg.GenesisDIRHash),
			ProtocolVersion:       verified.ProtocolVersion,
			Height:                verified.Height,
			DIRHash:               verified.DIRHash,
			StateRoot:             verified.StateRoot,
			ValidatorSetRoot:      verified.ValidatorSetRoot,
			VerifiedAt:            now.UTC().Format(time.RFC3339Nano),
			SourcePeerValidatorID: sourcePeerValidatorID,
		}
	}
	if candidate.Height <= r.trustedHead.Height {
		return r.trustedHead, nil
	}

	// Transaction boundary: nothing mutates in-memory or on disk until every
	// snapshot/PFC/DIR continuity check above has succeeded.
	if err := savePeerSyncTrustedHeadAtomic(r.statePath, candidate); err != nil {
		return PeerSyncTrustedHead{}, err
	}
	r.trustedHead = candidate
	return candidate, nil
}

func loadPeerSyncServingData(validatorSetPath, snapshotCertificatePath, proofDir string) (SnapshotValidatorSet, *SnapshotTrustCertificate, []DIRFinalityProof, error) {
	var set SnapshotValidatorSet
	if validatorSetPath == "" {
		return set, nil, nil, errors.New("--sync-validator-set is required to serve SYNC_PROOF")
	}
	if err := readJSON(validatorSetPath, &set); err != nil {
		return set, nil, nil, err
	}
	var cert *SnapshotTrustCertificate
	if snapshotCertificatePath != "" {
		var value SnapshotTrustCertificate
		if err := readJSON(snapshotCertificatePath, &value); err != nil {
			return set, nil, nil, err
		}
		cert = &value
	}
	if proofDir == "" {
		return set, cert, nil, errors.New("--sync-proof-dir is required to serve SYNC_PROOF")
	}
	entries, err := os.ReadDir(proofDir)
	if err != nil {
		return set, cert, nil, err
	}
	proofs := []DIRFinalityProof{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}
		proof, err := readFinalityProof(filepath.Join(proofDir, entry.Name()))
		if err != nil {
			return set, cert, nil, fmt.Errorf("read sync proof %s: %w", entry.Name(), err)
		}
		proofs = append(proofs, proof)
	}
	sort.Slice(proofs, func(i, j int) bool { return proofs[i].Header.Height < proofs[j].Header.Height })
	return set, cert, proofs, nil
}

func decodePeerSyncHeadRequest(payload json.RawMessage) (PeerSyncHeadRequest, error) {
	var req PeerSyncHeadRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return req, err
	}
	if req.ProfileVersion != peerSyncProfile || req.RequestType != "SYNC_HEAD" || req.TrustedHeight < 0 {
		return req, errors.New("invalid SYNC_HEAD request")
	}
	return req, nil
}

func decodePeerSyncProofRequest(payload json.RawMessage) (PeerSyncProofRequest, error) {
	var req PeerSyncProofRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return req, err
	}
	if req.ProfileVersion != peerSyncProfile || req.RequestType != "SYNC_PROOF" || req.FromHeight < 0 || req.ToHeight <= req.FromHeight {
		return req, errors.New("invalid SYNC_PROOF request")
	}
	return req, nil
}

func postPeerEnvelope(endpoint string, envelope PeerEnvelope) (PeerEnvelope, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return PeerEnvelope{}, err
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return PeerEnvelope{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
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

func peerSyncCommand(args []string) error {
	fs := newFlagSet("peer-sync")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	target := fs.String("target", "", "peer base URL")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	syncHeadPath := fs.String("sync-head-state", "", "durable proof-verified sync head path")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	batchSize := fs.Int64("batch-size", defaultSyncProofBatch, "DIR finality proofs requested per bundle")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" || *target == "" {
		return errors.New("--peer-registry, --peer-registry-root and --target are required")
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
	headResponseEnvelope, err := postPeerEnvelope(endpoint, headEnvelope)
	if err != nil {
		return err
	}
	session.mu.Lock()
	headVerification, err := session.acceptInboundEnvelope(headResponseEnvelope, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return err
	}
	if headResponseEnvelope.MessageType != "SYNC_HEAD" {
		return fmt.Errorf("expected SYNC_HEAD response, got %s", headResponseEnvelope.MessageType)
	}
	var remoteHead PeerSyncHeadResponse
	if err := json.Unmarshal(headResponseEnvelope.Payload, &remoteHead); err != nil {
		return err
	}
	if remoteHead.ProfileVersion != peerSyncProfile || remoteHead.ResponseType != "SYNC_HEAD" || remoteHead.ChainID != session.cfg.ChainID || !strings.EqualFold(remoteHead.GenesisDIRHash, session.cfg.GenesisDIRHash) || remoteHead.ProtocolVersion != session.cfg.ProtocolVersion {
		return errors.New("remote SYNC_HEAD trust context mismatch")
	}
	if remoteHead.LatestHeight <= syncRuntime.trustedHead.Height {
		out, _ := json.MarshalIndent(map[string]any{"synced": true, "height": syncRuntime.trustedHead.Height, "DIRHash": syncRuntime.trustedHead.DIRHash, "peerValidatorId": headVerification.SenderValidatorID, "voteAuthority": false}, "", "  ")
		fmt.Println(string(out))
		return nil
	}

	for syncRuntime.trustedHead.Height < remoteHead.LatestHeight {
		toHeight := syncRuntime.trustedHead.Height + *batchSize
		if toHeight > remoteHead.LatestHeight {
			toHeight = remoteHead.LatestHeight
		}
		proofReq := PeerSyncProofRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_PROOF", FromHeight: syncRuntime.trustedHead.Height, ToHeight: toHeight}
		session.mu.Lock()
		proofEnvelope, err := session.nextSignedEnvelope("SYNC_PROOF", proofReq, time.Now().UTC())
		session.mu.Unlock()
		if err != nil {
			return err
		}
		proofResponseEnvelope, err := postPeerEnvelope(endpoint, proofEnvelope)
		if err != nil {
			return err
		}
		session.mu.Lock()
		proofVerification, err := session.acceptInboundEnvelope(proofResponseEnvelope, time.Now().UTC())
		session.mu.Unlock()
		if err != nil {
			return err
		}
		if proofResponseEnvelope.MessageType != "SYNC_PROOF" {
			return fmt.Errorf("expected SYNC_PROOF response, got %s", proofResponseEnvelope.MessageType)
		}
		var bundle PeerSyncProofBundle
		if err := json.Unmarshal(proofResponseEnvelope.Payload, &bundle); err != nil {
			return err
		}
		if _, err := syncRuntime.applyProofBundle(bundle, proofVerification.SenderValidatorID, time.Now().UTC()); err != nil {
			return err
		}
	}

	out, _ := json.MarshalIndent(map[string]any{
		"synced":                 true,
		"profileVersion":         peerSyncProfile,
		"height":                 syncRuntime.trustedHead.Height,
		"DIRHash":                syncRuntime.trustedHead.DIRHash,
		"stateRoot":              syncRuntime.trustedHead.StateRoot,
		"validatorSetRoot":       syncRuntime.trustedHead.ValidatorSetRoot,
		"sourcePeerValidatorId":  syncRuntime.trustedHead.SourcePeerValidatorID,
		"state":                  session.cfg.State,
		"voteAuthority":          false,
		"consensusParticipation": false,
	}, "", "  ")
	fmt.Println(string(out))
	return nil
}
