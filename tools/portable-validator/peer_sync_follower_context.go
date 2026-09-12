package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

func syncGovernedFollowerToObservedHeadContext(ctx context.Context, session *PeerSessionRuntime, runtime *PeerSyncRuntime, selected PeerHeadObservation, trustedPolicyHash string, batchSize int64) (PeerSyncTrustedHead, error) {
	if err := ctx.Err(); err != nil {
		return runtime.trustedHead, err
	}
	base, err := url.Parse(selected.TargetURL)
	if err != nil || (base.Scheme != "https" && base.Scheme != "http") || base.Hostname() == "" {
		return runtime.trustedHead, errors.New("selected follower peer has invalid target URL")
	}
	if base.Scheme == "http" && !isSafePlainHTTPPeerTarget(base) {
		return runtime.trustedHead, errors.New("plaintext HTTP follower sync refused for non-loopback target")
	}
	endpoint := strings.TrimRight(base.String(), "/") + "/v1/peer/message"
	trustedHash := runtime.trustedHead.DIRHash
	headReq := PeerSyncHeadRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_HEAD", TrustedHeight: runtime.trustedHead.Height, TrustedDIRHash: &trustedHash}
	session.mu.Lock()
	headEnvelope, err := session.nextSignedEnvelope("SYNC_HEAD", headReq, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return runtime.trustedHead, err
	}
	headResponse, err := postGovernedPeerEnvelopeContext(ctx, endpoint, headEnvelope)
	if err != nil {
		return runtime.trustedHead, err
	}
	session.mu.Lock()
	verification, err := session.acceptInboundEnvelope(headResponse, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return runtime.trustedHead, err
	}
	if verification.SenderValidatorID != selected.PeerValidatorID {
		return runtime.trustedHead, fmt.Errorf("selected peer identity changed from %s to %s", selected.PeerValidatorID, verification.SenderValidatorID)
	}
	if headResponse.MessageType != "SYNC_HEAD" {
		return runtime.trustedHead, errors.New("selected peer returned non-SYNC_HEAD response")
	}
	var refreshed PeerSyncHeadResponse
	if err := json.Unmarshal(headResponse.Payload, &refreshed); err != nil {
		return runtime.trustedHead, err
	}
	if err := validateRemoteSyncHead(session.cfg, refreshed); err != nil {
		return runtime.trustedHead, err
	}
	if refreshed.LatestHeight != selected.Head.LatestHeight || !strings.EqualFold(refreshed.LatestDIRHash, selected.Head.LatestDIRHash) || !strings.EqualFold(refreshed.LatestStateRoot, selected.Head.LatestStateRoot) || !strings.EqualFold(refreshed.ValidatorSetRoot, selected.Head.ValidatorSetRoot) {
		return runtime.trustedHead, errors.New("selected peer finalized head changed after survey; resurvey required before advancement")
	}
	if runtime.trustedHead.Height > refreshed.LatestHeight {
		return runtime.trustedHead, nil
	}
	if runtime.trustedHead.Height == refreshed.LatestHeight {
		if !strings.EqualFold(runtime.trustedHead.DIRHash, refreshed.LatestDIRHash) {
			return runtime.trustedHead, errors.New("local proof-verified head conflicts with selected peer at the same finalized height")
		}
		return runtime.trustedHead, nil
	}
	for runtime.trustedHead.Height < refreshed.LatestHeight {
		if err := ctx.Err(); err != nil {
			return runtime.trustedHead, err
		}
		to := runtime.trustedHead.Height + batchSize
		if to > refreshed.LatestHeight {
			to = refreshed.LatestHeight
		}
		req := PeerSyncProofRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_PROOF", FromHeight: runtime.trustedHead.Height, ToHeight: to}
		session.mu.Lock()
		envelope, err := session.nextSignedEnvelope("SYNC_PROOF", req, time.Now().UTC())
		session.mu.Unlock()
		if err != nil {
			return runtime.trustedHead, err
		}
		response, err := postGovernedPeerEnvelopeContext(ctx, endpoint, envelope)
		if err != nil {
			return runtime.trustedHead, err
		}
		session.mu.Lock()
		proofVerification, err := session.acceptInboundEnvelope(response, time.Now().UTC())
		session.mu.Unlock()
		if err != nil {
			return runtime.trustedHead, err
		}
		if proofVerification.SenderValidatorID != selected.PeerValidatorID {
			return runtime.trustedHead, errors.New("SYNC_PROOF response identity does not match selected authenticated peer")
		}
		if response.MessageType != "SYNC_PROOF" {
			return runtime.trustedHead, errors.New("expected SYNC_PROOF response")
		}
		var bundle PeerSyncGovernedProofBundle
		if err := json.Unmarshal(response.Payload, &bundle); err != nil {
			return runtime.trustedHead, err
		}
		before := runtime.trustedHead.Height
		if _, err := runtime.applyGovernedProofBundle(bundle, trustedPolicyHash, proofVerification.SenderValidatorID, time.Now().UTC()); err != nil {
			return runtime.trustedHead, err
		}
		if runtime.trustedHead.Height <= before {
			return runtime.trustedHead, errors.New("governed follower proof bundle did not advance durable trusted head")
		}
	}
	if runtime.trustedHead.Height != refreshed.LatestHeight || !strings.EqualFold(runtime.trustedHead.DIRHash, refreshed.LatestDIRHash) {
		return runtime.trustedHead, errors.New("proof-verified follower head does not match surveyed finalized head")
	}
	return runtime.trustedHead, nil
}

func runPeerFollowerCycleContext(ctx context.Context, cfg PeerFollowerConfig) (PeerFollowerCycleResult, error) {
	if err := ctx.Err(); err != nil {
		return PeerFollowerCycleResult{}, err
	}
	var registry PeerTransportRegistry
	if err := readJSON(cfg.RegistryPath, &registry); err != nil {
		return PeerFollowerCycleResult{}, err
	}
	session, err := newPeerSessionRuntime(cfg.Dir, registry, cfg.RegistryHeight, cfg.RegistryRoot, cfg.SessionStatePath, cfg.MaxClockSkew)
	if err != nil {
		return PeerFollowerCycleResult{}, err
	}
	if session.cfg.State != candidateState || session.cfg.VoteAuthority {
		return PeerFollowerCycleResult{}, errors.New("peer follower requires CANDIDATE state with voteAuthority=false")
	}
	runtime, err := newPeerSyncRuntime(session.cfg, cfg.SyncHeadPath)
	if err != nil {
		return PeerFollowerCycleResult{}, err
	}
	observations, failures := surveyPeerTargetsContext(ctx, session, cfg.Targets)
	if err := ctx.Err(); err != nil {
		return PeerFollowerCycleResult{}, err
	}
	crossRunEvidence, err := persistAuthenticatedPeerHeads(cfg.PeerHeadStatePath, cfg.EvidenceJournalPath, cfg.QuarantineStatePath, session.cfg, observations)
	if err != nil {
		return PeerFollowerCycleResult{}, fmt.Errorf("persist authenticated peer heads: %w", err)
	}
	quarantineState, err := loadPeerQuarantineState(cfg.QuarantineStatePath, session.cfg)
	if err != nil {
		return PeerFollowerCycleResult{}, err
	}
	observations, blockedPeers := filterQuarantinedPeerHeads(quarantineState, observations)
	for _, peerValidatorID := range blockedPeers {
		failures["validator:"+peerValidatorID] = "authenticated peer is locally quarantined from read-only follower sync selection"
	}
	resolution := resolvePeerSurveyContext(ctx, session, observations, cfg.GovernancePolicyHash, cfg.BatchSize)
	if err := ctx.Err(); err != nil {
		return PeerFollowerCycleResult{}, err
	}
	evidence, err := persistResolverEvidence(cfg.EvidenceJournalPath, cfg.QuarantineStatePath, session.cfg, resolution, time.Now().UTC())
	if err != nil {
		return PeerFollowerCycleResult{}, fmt.Errorf("persist follower safety evidence: %w", err)
	}
	result := PeerFollowerCycleResult{
		ProfileVersion:         peerFollowerProfile,
		Resolution:             resolution,
		PeerFailures:           failures,
		CrossRunSafetyEvidence: crossRunEvidence,
		SafetyEvidence:         evidence,
		TrustedHead:            runtime.trustedHead,
		State:                  session.cfg.State,
		VoteAuthority:          false,
		ConsensusParticipation: false,
	}
	if !resolution.AutoAdvanceAllowed {
		return result, fmt.Errorf("follower advancement blocked: %s", resolution.Classification)
	}
	reliabilityState, err := loadPeerReliabilityState(peerReliabilityPathFromStatePath(cfg.PeerHeadStatePath), session.cfg)
	if err != nil {
		return result, fmt.Errorf("load advisory peer reliability: %w", err)
	}
	selected, err := selectFollowerPeerWithReliability(resolution, reliabilityState)
	if err != nil {
		return result, err
	}
	result.SelectedPeerValidatorID = selected.PeerValidatorID
	result.SelectedTargetURL = selected.TargetURL
	before := runtime.trustedHead.Height
	trustedHead, err := syncGovernedFollowerToObservedHeadContext(ctx, session, runtime, selected, cfg.GovernancePolicyHash, cfg.BatchSize)
	result.TrustedHead = trustedHead
	result.Advanced = trustedHead.Height > before
	if err != nil {
		return result, err
	}
	return result, nil
}
