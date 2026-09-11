package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const peerResolveProfile = "STRATUM-PEER-RESOLVE/1"

type PeerAncestryPeerResult struct {
	PeerValidatorID string `json:"peerValidatorId"`
	TargetURL       string `json:"targetUrl"`
	Classification string `json:"classification"`
	VerifiedHeight int64  `json:"verifiedHeight"`
	VerifiedDIRHash string `json:"verifiedDIRHash"`
	Reason          string `json:"reason"`
}

type PeerResolveResult struct {
	ProfileVersion     string                   `json:"profileVersion"`
	Classification     string                   `json:"classification"`
	Survey             PeerHeadSurvey           `json:"survey"`
	LowerHead          *PeerHeadObservation     `json:"lowerHead,omitempty"`
	HighestHeadPeers   []PeerHeadObservation    `json:"highestHeadPeers,omitempty"`
	AncestryResults    []PeerAncestryPeerResult `json:"ancestryResults,omitempty"`
	AutoAdvanceAllowed bool                     `json:"autoAdvanceAllowed"`
	Reason             string                   `json:"reason"`
}

func surveyPeerTargets(session *PeerSessionRuntime, targets []string) ([]PeerHeadObservation, map[string]string) {
	observations := []PeerHeadObservation{}
	failures := map[string]string{}
	seenPeers := map[string]bool{}
	for _, target := range targets {
		base, err := url.Parse(target)
		if err != nil || (base.Scheme != "https" && base.Scheme != "http") || base.Hostname() == "" {
			failures[target] = "invalid target URL"
			continue
		}
		if base.Scheme == "http" && !isSafePlainHTTPPeerTarget(base) {
			failures[target] = "plaintext HTTP refused for non-loopback target"
			continue
		}
		endpoint := strings.TrimRight(base.String(), "/") + "/v1/peer/message"
		obs, err := observePeerHead(session, endpoint, base.String())
		if err != nil {
			failures[target] = err.Error()
			continue
		}
		if seenPeers[obs.PeerValidatorID] {
			failures[target] = "duplicate authenticated validator identity"
			continue
		}
		seenPeers[obs.PeerValidatorID] = true
		observations = append(observations, obs)
	}
	return observations, failures
}

func requestGovernedProofBundle(session *PeerSessionRuntime, higher PeerHeadObservation, fromHeight, toHeight int64) (PeerSyncGovernedProofBundle, error) {
	base, err := url.Parse(higher.TargetURL)
	if err != nil || base.Hostname() == "" {
		return PeerSyncGovernedProofBundle{}, errors.New("invalid higher-peer target URL")
	}
	endpoint := strings.TrimRight(base.String(), "/") + "/v1/peer/message"
	request := PeerSyncProofRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_PROOF", FromHeight: fromHeight, ToHeight: toHeight}
	session.mu.Lock()
	envelope, err := session.nextSignedEnvelope("SYNC_PROOF", request, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return PeerSyncGovernedProofBundle{}, err
	}
	response, err := postGovernedPeerEnvelope(endpoint, envelope)
	if err != nil {
		return PeerSyncGovernedProofBundle{}, err
	}
	session.mu.Lock()
	verification, err := session.acceptInboundEnvelope(response, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return PeerSyncGovernedProofBundle{}, err
	}
	if verification.SenderValidatorID != higher.PeerValidatorID {
		return PeerSyncGovernedProofBundle{}, fmt.Errorf("proof response identity %s does not match surveyed higher peer %s", verification.SenderValidatorID, higher.PeerValidatorID)
	}
	if response.MessageType != "SYNC_PROOF" {
		return PeerSyncGovernedProofBundle{}, fmt.Errorf("expected SYNC_PROOF response, got %s", response.MessageType)
	}
	var bundle PeerSyncGovernedProofBundle
	if err := json.Unmarshal(response.Payload, &bundle); err != nil {
		return PeerSyncGovernedProofBundle{}, err
	}
	return bundle, nil
}

func verifyHigherPeerAncestryBatched(session *PeerSessionRuntime, lower, higher PeerHeadObservation, trustedPolicyHash string, batchSize int64) PeerAncestryPeerResult {
	result := PeerAncestryPeerResult{PeerValidatorID: higher.PeerValidatorID, TargetURL: higher.TargetURL, Classification: "ANCESTRY_UNVERIFIED"}
	lowerHead, err := peerObservationTrustedHead(session.cfg, lower)
	if err != nil {
		result.Reason = err.Error()
		return result
	}
	verificationDir, err := os.MkdirTemp("", "stratum-peer-resolve-")
	if err != nil {
		result.Reason = err.Error()
		return result
	}
	defer os.RemoveAll(verificationDir)
	runtime := &PeerSyncRuntime{cfg: session.cfg, statePath: filepath.Join(verificationDir, "verified-head.json"), trustedHead: lowerHead, proofs: map[int64]DIRFinalityProof{}}
	for runtime.trustedHead.Height < higher.Head.LatestHeight {
		toHeight := runtime.trustedHead.Height + batchSize
		if toHeight > higher.Head.LatestHeight {
			toHeight = higher.Head.LatestHeight
		}
		bundle, err := requestGovernedProofBundle(session, higher, runtime.trustedHead.Height, toHeight)
		if err != nil {
			result.Classification = "ANCESTRY_UNVERIFIED"
			result.Reason = err.Error()
			return result
		}
		if bundle.SnapshotCertificate != nil && bundle.SnapshotCertificate.SnapshotHeight > lower.Head.LatestHeight {
			result.Classification = "ANCESTRY_UNVERIFIED"
			result.Reason = "higher peer attempted to substitute a later snapshot for proof of ancestry from the lower finalized DIR"
			return result
		}
		if len(bundle.FinalityProofs) == 0 || bundle.FinalityProofs[0].Header.Height != runtime.trustedHead.Height+1 || bundle.FinalityProofs[len(bundle.FinalityProofs)-1].Header.Height != toHeight {
			result.Classification = "ANCESTRY_UNVERIFIED"
			result.Reason = "higher peer did not supply the exact continuous DIR proof range requested"
			return result
		}
		verified, err := runtime.applyGovernedProofBundle(bundle, trustedPolicyHash, higher.PeerValidatorID, time.Now().UTC())
		if err != nil {
			result.Classification = "HISTORICAL_DIVERGENCE"
			result.Reason = err.Error()
			return result
		}
		if verified.Height != toHeight {
			result.Classification = "ANCESTRY_UNVERIFIED"
			result.Reason = "verified proof bundle did not advance to the requested height"
			return result
		}
	}
	result.VerifiedHeight = runtime.trustedHead.Height
	result.VerifiedDIRHash = strings.ToLower(runtime.trustedHead.DIRHash)
	if runtime.trustedHead.Height != higher.Head.LatestHeight || !strings.EqualFold(runtime.trustedHead.DIRHash, higher.Head.LatestDIRHash) || !strings.EqualFold(runtime.trustedHead.StateRoot, higher.Head.LatestStateRoot) || !strings.EqualFold(runtime.trustedHead.ValidatorSetRoot, higher.Head.ValidatorSetRoot) {
		result.Classification = "HISTORICAL_DIVERGENCE"
		result.Reason = "proof-verified terminal head does not match the surveyed higher peer head"
		return result
	}
	result.Classification = "PROVEN_LAG"
	result.Reason = "continuous governance-aware PFC/DIR ancestry proven from lower head to surveyed higher head"
	return result
}

func resolvePeerSurvey(session *PeerSessionRuntime, observations []PeerHeadObservation, trustedPolicyHash string, batchSize int64) PeerResolveResult {
	survey := classifyPeerHeads(observations)
	result := PeerResolveResult{ProfileVersion: peerResolveProfile, Classification: survey.Classification, Survey: survey, AutoAdvanceAllowed: survey.AutoAdvanceAllowed, Reason: survey.Reason}
	if survey.Classification != "UNRESOLVED_HEIGHT_SKEW" {
		return result
	}
	sorted := append([]PeerHeadObservation(nil), survey.Observations...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Head.LatestHeight == sorted[j].Head.LatestHeight {
			return sorted[i].PeerValidatorID < sorted[j].PeerValidatorID
		}
		return sorted[i].Head.LatestHeight < sorted[j].Head.LatestHeight
	})
	lower := sorted[0]
	result.LowerHead = &lower
	for _, obs := range sorted {
		if obs.Head.LatestHeight == survey.HighestObservedHeight {
			result.HighestHeadPeers = append(result.HighestHeadPeers, obs)
		}
	}
	allProven := len(result.HighestHeadPeers) > 0
	for _, higher := range result.HighestHeadPeers {
		ancestry := verifyHigherPeerAncestryBatched(session, lower, higher, trustedPolicyHash, batchSize)
		result.AncestryResults = append(result.AncestryResults, ancestry)
		if ancestry.Classification != "PROVEN_LAG" {
			allProven = false
		}
	}
	if allProven {
		result.Classification = "PROVEN_LAG"
		result.AutoAdvanceAllowed = true
		result.Reason = "every authenticated peer at the highest observed finalized head independently proved the same lower-to-higher ancestry"
		return result
	}
	for _, ancestry := range result.AncestryResults {
		if ancestry.Classification == "HISTORICAL_DIVERGENCE" {
			result.Classification = "HISTORICAL_DIVERGENCE"
			result.Reason = "at least one highest-head peer supplied cryptographic evidence inconsistent with the lower finalized head"
			return result
		}
	}
	result.Classification = "ANCESTRY_UNVERIFIED"
	result.Reason = "height skew remains unresolved because not every highest-head peer proved ancestry"
	return result
}

func peerSyncResolveCommand(args []string) error {
	fs := newFlagSet("peer-sync-resolve")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	targetsRaw := fs.String("targets", "", "comma-separated peer base URLs")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned validator-governance policy SHA-256")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	batchSize := fs.Int64("batch-size", defaultSyncProofBatch, "DIR finality proofs requested per ancestry bundle")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" || strings.TrimSpace(*targetsRaw) == "" || !isSHA256(strings.ToLower(*policyHash)) {
		return errors.New("--peer-registry, --peer-registry-root, --targets and a valid --governance-policy-hash are required")
	}
	if *batchSize < 1 || *batchSize > maxSyncProofsPerBundle {
		return fmt.Errorf("--batch-size must be between 1 and %d", maxSyncProofsPerBundle)
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	var registry PeerTransportRegistry
	if err := readJSON(*registryPath, &registry); err != nil {
		return err
	}
	session, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *sessionStatePath, *maxSkew)
	if err != nil {
		return err
	}
	if session.cfg.State != candidateState || session.cfg.VoteAuthority {
		return errors.New("peer sync resolver requires CANDIDATE state with voteAuthority=false")
	}
	observations, failures := surveyPeerTargets(session, splitNonEmpty(*targetsRaw))
	result := resolvePeerSurvey(session, observations, strings.ToLower(*policyHash), *batchSize)
	out, _ := json.MarshalIndent(map[string]any{
		"resolution":             result,
		"peerFailures":           failures,
		"state":                  session.cfg.State,
		"voteAuthority":          false,
		"consensusParticipation": false,
	}, "", "  ")
	fmt.Println(string(out))
	if !result.AutoAdvanceAllowed {
		return fmt.Errorf("peer sync resolution blocked: %s", result.Classification)
	}
	return nil
}
