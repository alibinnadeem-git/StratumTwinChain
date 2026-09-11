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

const multiPeerSyncProfile = "STRATUM-PEER-MULTI-SYNC/1"

type PeerHeadObservation struct {
	PeerValidatorID string               `json:"peerValidatorId"`
	TargetURL       string               `json:"targetUrl"`
	Head            PeerSyncHeadResponse `json:"head"`
	ObservedAt      string               `json:"observedAt"`
}

type PeerHeadConflict struct {
	Height int64    `json:"height"`
	Hashes []string `json:"hashes"`
	Peers  []string `json:"peers"`
}

type PeerHeadSurvey struct {
	ProfileVersion        string                `json:"profileVersion"`
	Classification        string                `json:"classification"`
	Observations          []PeerHeadObservation `json:"observations"`
	Conflicts             []PeerHeadConflict    `json:"conflicts"`
	LowestObservedHeight  int64                 `json:"lowestObservedHeight"`
	HighestObservedHeight int64                 `json:"highestObservedHeight"`
	AutoAdvanceAllowed    bool                  `json:"autoAdvanceAllowed"`
	Reason                string                `json:"reason"`
}

func classifyPeerHeads(observations []PeerHeadObservation) PeerHeadSurvey {
	survey := PeerHeadSurvey{ProfileVersion: multiPeerSyncProfile, Observations: append([]PeerHeadObservation(nil), observations...)}
	if len(observations) == 0 {
		survey.Classification = "NO_AUTHENTICATED_PEERS"
		survey.Reason = "no authenticated SYNC_HEAD observations were available"
		return survey
	}
	sort.Slice(survey.Observations, func(i, j int) bool {
		if survey.Observations[i].Head.LatestHeight == survey.Observations[j].Head.LatestHeight {
			return survey.Observations[i].PeerValidatorID < survey.Observations[j].PeerValidatorID
		}
		return survey.Observations[i].Head.LatestHeight < survey.Observations[j].Head.LatestHeight
	})
	survey.LowestObservedHeight = survey.Observations[0].Head.LatestHeight
	survey.HighestObservedHeight = survey.Observations[len(survey.Observations)-1].Head.LatestHeight

	byHeight := map[int64]map[string][]string{}
	for _, obs := range survey.Observations {
		if byHeight[obs.Head.LatestHeight] == nil {
			byHeight[obs.Head.LatestHeight] = map[string][]string{}
		}
		hash := strings.ToLower(obs.Head.LatestDIRHash)
		byHeight[obs.Head.LatestHeight][hash] = append(byHeight[obs.Head.LatestHeight][hash], obs.PeerValidatorID)
	}
	for height, hashes := range byHeight {
		if len(hashes) <= 1 {
			continue
		}
		conflict := PeerHeadConflict{Height: height}
		for hash, peers := range hashes {
			conflict.Hashes = append(conflict.Hashes, hash)
			conflict.Peers = append(conflict.Peers, peers...)
		}
		sort.Strings(conflict.Hashes)
		sort.Strings(conflict.Peers)
		survey.Conflicts = append(survey.Conflicts, conflict)
	}
	sort.Slice(survey.Conflicts, func(i, j int) bool { return survey.Conflicts[i].Height < survey.Conflicts[j].Height })
	if len(survey.Conflicts) > 0 {
		survey.Classification = "FINALIZED_HEAD_CONFLICT"
		survey.Reason = "authenticated peers reported different DIR hashes at the same finalized height"
		return survey
	}
	if survey.LowestObservedHeight != survey.HighestObservedHeight {
		survey.Classification = "UNRESOLVED_HEIGHT_SKEW"
		survey.Reason = "different peer heights cannot be classified as harmless lag from SYNC_HEAD alone; proof ancestry is required"
		return survey
	}
	survey.Classification = "EXACT_HEAD_AGREEMENT"
	survey.AutoAdvanceAllowed = true
	survey.Reason = "all authenticated peers reported the same finalized height and DIR hash"
	return survey
}

func validateRemoteSyncHead(cfg BootstrapConfig, head PeerSyncHeadResponse) error {
	if head.ProfileVersion != peerSyncProfile || head.ResponseType != "SYNC_HEAD" {
		return errors.New("invalid remote SYNC_HEAD profile/response type")
	}
	if head.ChainID != cfg.ChainID || !strings.EqualFold(head.GenesisDIRHash, cfg.GenesisDIRHash) || head.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("remote SYNC_HEAD trust context mismatch")
	}
	if head.LatestHeight < 0 || !isSHA256(strings.ToLower(head.LatestDIRHash)) {
		return errors.New("remote SYNC_HEAD contains invalid height or DIR hash")
	}
	if head.LatestHeight > 0 && (!isSHA256(strings.ToLower(head.LatestStateRoot)) || !isSHA256(strings.ToLower(head.ValidatorSetRoot))) {
		return errors.New("non-genesis remote SYNC_HEAD requires state and validator-set roots")
	}
	return nil
}

func observePeerHead(session *PeerSessionRuntime, endpoint, target string) (PeerHeadObservation, error) {
	trustedHash := session.cfg.GenesisDIRHash
	reqPayload := PeerSyncHeadRequest{ProfileVersion: peerSyncProfile, RequestType: "SYNC_HEAD", TrustedHeight: 0, TrustedDIRHash: &trustedHash}
	now := time.Now().UTC()
	session.mu.Lock()
	envelope, err := session.nextSignedEnvelope("SYNC_HEAD", reqPayload, now)
	session.mu.Unlock()
	if err != nil {
		return PeerHeadObservation{}, err
	}
	response, err := postPeerEnvelope(endpoint, envelope)
	if err != nil {
		return PeerHeadObservation{}, err
	}
	session.mu.Lock()
	verification, err := session.acceptInboundEnvelope(response, time.Now().UTC())
	session.mu.Unlock()
	if err != nil {
		return PeerHeadObservation{}, err
	}
	if response.MessageType != "SYNC_HEAD" {
		return PeerHeadObservation{}, fmt.Errorf("expected SYNC_HEAD response, got %s", response.MessageType)
	}
	var head PeerSyncHeadResponse
	if err := json.Unmarshal(response.Payload, &head); err != nil {
		return PeerHeadObservation{}, err
	}
	if err := validateRemoteSyncHead(session.cfg, head); err != nil {
		return PeerHeadObservation{}, err
	}
	return PeerHeadObservation{PeerValidatorID: verification.SenderValidatorID, TargetURL: target, Head: head, ObservedAt: time.Now().UTC().Format(time.RFC3339Nano)}, nil
}

func peerMultiSurveyCommand(args []string) error {
	fs := newFlagSet("peer-sync-survey")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	targetsRaw := fs.String("targets", "", "comma-separated peer base URLs")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	quarantineStatePath := fs.String("quarantine-state", "", "local read-only peer quarantine state path")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" || strings.TrimSpace(*targetsRaw) == "" {
		return errors.New("--peer-registry, --peer-registry-root and --targets are required")
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	if *quarantineStatePath == "" {
		*quarantineStatePath = filepath.Join(*dir, "state", "peer-quarantine.json")
	}
	var registry PeerTransportRegistry
	if err := readJSON(*registryPath, &registry); err != nil {
		return err
	}
	session, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *sessionStatePath, *maxSkew)
	if err != nil {
		return err
	}
	quarantineState, err := loadPeerQuarantineState(*quarantineStatePath, session.cfg)
	if err != nil {
		return err
	}
	observations := []PeerHeadObservation{}
	failures := map[string]string{}
	seenPeers := map[string]bool{}
	for _, target := range splitNonEmpty(*targetsRaw) {
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
		if peerIsQuarantined(quarantineState, obs.PeerValidatorID) {
			failures[target] = "authenticated peer is locally quarantined from read-only sync selection"
			continue
		}
		if seenPeers[obs.PeerValidatorID] {
			failures[target] = "duplicate authenticated validator identity"
			continue
		}
		seenPeers[obs.PeerValidatorID] = true
		observations = append(observations, obs)
	}
	survey := classifyPeerHeads(observations)
	out, _ := json.MarshalIndent(map[string]any{
		"survey": failuresAwareSurvey(survey, failures),
		"state": session.cfg.State,
		"voteAuthority": false,
		"consensusParticipation": false,
	}, "", "  ")
	fmt.Println(string(out))
	if survey.Classification == "FINALIZED_HEAD_CONFLICT" {
		return errors.New("finalized peer-head conflict detected; automatic sync advancement blocked")
	}
	if survey.Classification == "UNRESOLVED_HEIGHT_SKEW" {
		return errors.New("peer height skew requires proof ancestry before automatic sync advancement")
	}
	if survey.Classification == "NO_AUTHENTICATED_PEERS" {
		return errors.New("no authenticated non-quarantined peers available for sync survey")
	}
	return nil
}

func failuresAwareSurvey(survey PeerHeadSurvey, failures map[string]string) map[string]any {
	return map[string]any{
		"profileVersion": survey.ProfileVersion,
		"classification": survey.Classification,
		"observations": survey.Observations,
		"conflicts": survey.Conflicts,
		"lowestObservedHeight": survey.LowestObservedHeight,
		"highestObservedHeight": survey.HighestObservedHeight,
		"autoAdvanceAllowed": survey.AutoAdvanceAllowed,
		"reason": survey.Reason,
		"peerFailures": failures,
	}
}
