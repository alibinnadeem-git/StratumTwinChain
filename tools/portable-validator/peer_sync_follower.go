package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const peerFollowerProfile = "STRATUM-PEER-FOLLOWER/1"

type PeerFollowerCycleResult struct {
	ProfileVersion          string              `json:"profileVersion"`
	Resolution              PeerResolveResult   `json:"resolution"`
	PeerFailures            map[string]string   `json:"peerFailures,omitempty"`
	CrossRunSafetyEvidence  []PeerEvidence      `json:"crossRunSafetyEvidence,omitempty"`
	SafetyEvidence          []PeerEvidence      `json:"safetyEvidence,omitempty"`
	SelectedPeerValidatorID string              `json:"selectedPeerValidatorId,omitempty"`
	SelectedTargetURL       string              `json:"selectedTargetUrl,omitempty"`
	TrustedHead             PeerSyncTrustedHead `json:"trustedHead"`
	Advanced                bool                `json:"advanced"`
	State                   string              `json:"state"`
	VoteAuthority           bool                `json:"voteAuthority"`
	ConsensusParticipation  bool                `json:"consensusParticipation"`
}

type PeerFollowerConfig struct {
	Dir                  string
	RegistryPath         string
	RegistryHeight       int64
	RegistryRoot         string
	Targets              []string
	SessionStatePath     string
	SyncHeadPath         string
	PeerHeadStatePath    string
	EvidenceJournalPath  string
	QuarantineStatePath  string
	GovernancePolicyHash string
	MaxClockSkew         time.Duration
	BatchSize            int64
	PollInterval         time.Duration
	MaxBackoff           time.Duration
	Once                 bool
}

func followerBackoff(base, max time.Duration, failures int) time.Duration {
	if base <= 0 {
		base = 15 * time.Second
	}
	if max < base {
		max = base
	}
	if failures <= 0 {
		return base
	}
	delay := base
	for i := 1; i < failures && delay < max; i++ {
		if delay > max/2 {
			return max
		}
		delay *= 2
	}
	if delay > max {
		return max
	}
	return delay
}

func followerSafetyHalt(classification string) bool {
	switch classification {
	case "FINALIZED_HEAD_CONFLICT", "HISTORICAL_DIVERGENCE":
		return true
	default:
		return false
	}
}

func selectFollowerPeer(result PeerResolveResult) (PeerHeadObservation, error) {
	if !result.AutoAdvanceAllowed {
		return PeerHeadObservation{}, fmt.Errorf("resolution %s does not permit follower advancement", result.Classification)
	}
	candidates := []PeerHeadObservation{}
	switch result.Classification {
	case "EXACT_HEAD_AGREEMENT":
		candidates = append(candidates, result.Survey.Observations...)
	case "PROVEN_LAG":
		proven := map[string]bool{}
		for _, ancestry := range result.AncestryResults {
			if ancestry.Classification == "PROVEN_LAG" {
				proven[ancestry.PeerValidatorID] = true
			}
		}
		for _, observation := range result.HighestHeadPeers {
			if proven[observation.PeerValidatorID] {
				candidates = append(candidates, observation)
			}
		}
	default:
		return PeerHeadObservation{}, fmt.Errorf("resolution %s is not a follower-advance classification", result.Classification)
	}
	if len(candidates) == 0 {
		return PeerHeadObservation{}, errors.New("no authenticated proof-eligible follower peer available")
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Head.LatestHeight != candidates[j].Head.LatestHeight {
			return candidates[i].Head.LatestHeight > candidates[j].Head.LatestHeight
		}
		return candidates[i].PeerValidatorID < candidates[j].PeerValidatorID
	})
	return candidates[0], nil
}

func syncGovernedFollowerToObservedHead(session *PeerSessionRuntime, runtime *PeerSyncRuntime, selected PeerHeadObservation, trustedPolicyHash string, batchSize int64) (PeerSyncTrustedHead, error) {
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
	headResponse, err := postGovernedPeerEnvelope(endpoint, headEnvelope)
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
		response, err := postGovernedPeerEnvelope(endpoint, envelope)
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

func runPeerFollowerCycle(cfg PeerFollowerConfig) (PeerFollowerCycleResult, error) {
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
	observations, failures := surveyPeerTargets(session, cfg.Targets)
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
	resolution := resolvePeerSurvey(session, observations, cfg.GovernancePolicyHash, cfg.BatchSize)
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
	selected, err := selectFollowerPeer(resolution)
	if err != nil {
		return result, err
	}
	result.SelectedPeerValidatorID = selected.PeerValidatorID
	result.SelectedTargetURL = selected.TargetURL
	before := runtime.trustedHead.Height
	trustedHead, err := syncGovernedFollowerToObservedHead(session, runtime, selected, cfg.GovernancePolicyHash, cfg.BatchSize)
	result.TrustedHead = trustedHead
	result.Advanced = trustedHead.Height > before
	if err != nil {
		return result, err
	}
	return result, nil
}

func peerSyncFollowerCommand(args []string) error {
	fs := newFlagSet("peer-sync-follow")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	targetsRaw := fs.String("targets", "", "comma-separated peer base URLs")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	syncHeadPath := fs.String("sync-head-state", "", "durable proof-verified sync head path")
	headStatePath := fs.String("peer-head-state", "", "durable authenticated peer head observation state path")
	evidenceJournalPath := fs.String("evidence-journal", "", "durable peer safety evidence journal path")
	quarantineStatePath := fs.String("quarantine-state", "", "durable local peer quarantine state path")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned validator-governance policy SHA-256")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	batchSize := fs.Int64("batch-size", defaultSyncProofBatch, "DIR finality proofs requested per governed bundle")
	pollInterval := fs.Duration("poll-interval", 15*time.Second, "successful follower polling interval")
	maxBackoff := fs.Duration("max-backoff", 2*time.Minute, "maximum retry delay after transient follower failure")
	once := fs.Bool("once", false, "run exactly one survey/resolve/sync cycle")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" || strings.TrimSpace(*targetsRaw) == "" || !isSHA256(strings.ToLower(*policyHash)) {
		return errors.New("--peer-registry, --peer-registry-root, --targets and a valid --governance-policy-hash are required")
	}
	if *batchSize < 1 || *batchSize > maxSyncProofsPerBundle {
		return fmt.Errorf("--batch-size must be between 1 and %d", maxSyncProofsPerBundle)
	}
	if *pollInterval < time.Second || *pollInterval > time.Hour {
		return errors.New("--poll-interval must be between 1s and 1h")
	}
	if *maxBackoff < *pollInterval || *maxBackoff > 6*time.Hour {
		return errors.New("--max-backoff must be at least --poll-interval and no more than 6h")
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	if *syncHeadPath == "" {
		*syncHeadPath = filepath.Join(*dir, "state", "peer-sync-head.json")
	}
	if *headStatePath == "" {
		*headStatePath = filepath.Join(*dir, "state", "peer-heads.json")
	}
	if *evidenceJournalPath == "" {
		*evidenceJournalPath = filepath.Join(*dir, "state", "peer-evidence.json")
	}
	if *quarantineStatePath == "" {
		*quarantineStatePath = filepath.Join(*dir, "state", "peer-quarantine.json")
	}
	config := PeerFollowerConfig{
		Dir:                  *dir,
		RegistryPath:         *registryPath,
		RegistryHeight:       *height,
		RegistryRoot:         strings.ToLower(*expectedRoot),
		Targets:              splitNonEmpty(*targetsRaw),
		SessionStatePath:     *sessionStatePath,
		SyncHeadPath:         *syncHeadPath,
		PeerHeadStatePath:    *headStatePath,
		EvidenceJournalPath:  *evidenceJournalPath,
		QuarantineStatePath:  *quarantineStatePath,
		GovernancePolicyHash: strings.ToLower(*policyHash),
		MaxClockSkew:         *maxSkew,
		BatchSize:            *batchSize,
		PollInterval:         *pollInterval,
		MaxBackoff:           *maxBackoff,
		Once:                 *once,
	}
	if len(config.Targets) == 0 {
		return errors.New("at least one peer target is required")
	}
	failures := 0
	for {
		result, err := runPeerFollowerCycle(config)
		out, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(out))
		if err == nil {
			failures = 0
			if config.Once {
				return nil
			}
			time.Sleep(config.PollInterval)
			continue
		}
		if followerSafetyHalt(result.Resolution.Classification) {
			return fmt.Errorf("peer follower safety halt: %s: %w", result.Resolution.Classification, err)
		}
		if config.Once {
			return err
		}
		failures++
		delay := followerBackoff(config.PollInterval, config.MaxBackoff, failures)
		fmt.Printf("Follower cycle blocked/transient failure; retrying after %s; voteAuthority=false consensusParticipation=false; error=%v\n", delay, err)
		time.Sleep(delay)
	}
}
