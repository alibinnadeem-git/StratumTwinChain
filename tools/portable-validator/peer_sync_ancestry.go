package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const peerAncestryProfile = "STRATUM-PEER-ANCESTRY/1"

type PeerAncestryVerification struct {
	ProfileVersion        string `json:"profileVersion"`
	Classification        string `json:"classification"`
	LowerPeerValidatorID  string `json:"lowerPeerValidatorId"`
	HigherPeerValidatorID string `json:"higherPeerValidatorId"`
	LowerHeight           int64  `json:"lowerHeight"`
	HigherHeight          int64  `json:"higherHeight"`
	LowerDIRHash          string `json:"lowerDIRHash"`
	HigherDIRHash         string `json:"higherDIRHash"`
	VerifiedHeight        int64  `json:"verifiedHeight"`
	VerifiedDIRHash       string `json:"verifiedDIRHash"`
	AutoAdvanceAllowed    bool   `json:"autoAdvanceAllowed"`
	Reason                string `json:"reason"`
}

func peerObservationTrustedHead(cfg BootstrapConfig, observation PeerHeadObservation) (PeerSyncTrustedHead, error) {
	if err := validateRemoteSyncHead(cfg, observation.Head); err != nil {
		return PeerSyncTrustedHead{}, err
	}
	return PeerSyncTrustedHead{
		ProfileVersion:        peerSyncProfile,
		ChainID:               cfg.ChainID,
		GenesisDIRHash:        strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:       cfg.ProtocolVersion,
		Height:                observation.Head.LatestHeight,
		DIRHash:               strings.ToLower(observation.Head.LatestDIRHash),
		StateRoot:             strings.ToLower(observation.Head.LatestStateRoot),
		ValidatorSetRoot:      strings.ToLower(observation.Head.ValidatorSetRoot),
		VerifiedAt:            observation.ObservedAt,
		SourcePeerValidatorID: observation.PeerValidatorID,
	}, nil
}

func verifyPeerHeadAncestry(cfg BootstrapConfig, lower, higher PeerHeadObservation, bundle PeerSyncGovernedProofBundle, trustedPolicyHash string, now time.Time) (PeerAncestryVerification, error) {
	result := PeerAncestryVerification{
		ProfileVersion:        peerAncestryProfile,
		Classification:        "ANCESTRY_UNVERIFIED",
		LowerPeerValidatorID:  lower.PeerValidatorID,
		HigherPeerValidatorID: higher.PeerValidatorID,
		LowerHeight:           lower.Head.LatestHeight,
		HigherHeight:          higher.Head.LatestHeight,
		LowerDIRHash:          strings.ToLower(lower.Head.LatestDIRHash),
		HigherDIRHash:         strings.ToLower(higher.Head.LatestDIRHash),
	}
	if higher.Head.LatestHeight <= lower.Head.LatestHeight {
		return result, errors.New("ancestry verification requires a strictly higher peer head")
	}
	lowerHead, err := peerObservationTrustedHead(cfg, lower)
	if err != nil {
		return result, fmt.Errorf("lower head validation failed: %w", err)
	}
	if err := validateRemoteSyncHead(cfg, higher.Head); err != nil {
		return result, fmt.Errorf("higher head validation failed: %w", err)
	}
	if bundle.SnapshotCertificate != nil && bundle.SnapshotCertificate.SnapshotHeight > lowerHead.Height {
		return result, errors.New("ancestry proof cannot use a snapshot checkpoint above the lower peer head")
	}
	if len(bundle.FinalityProofs) == 0 {
		return result, errors.New("ancestry proof requires DIR finality proofs")
	}
	firstHeight := bundle.FinalityProofs[0].Header.Height
	if firstHeight != lowerHead.Height+1 {
		return result, fmt.Errorf("ancestry proof must begin at height %d, received %d", lowerHead.Height+1, firstHeight)
	}
	lastHeight := bundle.FinalityProofs[len(bundle.FinalityProofs)-1].Header.Height
	if lastHeight != higher.Head.LatestHeight {
		return result, fmt.Errorf("ancestry proof must end at higher peer height %d, received %d", higher.Head.LatestHeight, lastHeight)
	}

	runtime := &PeerSyncRuntime{cfg: cfg, trustedHead: lowerHead, proofs: map[int64]DIRFinalityProof{}}
	verified, err := runtime.applyGovernedProofBundle(bundle, trustedPolicyHash, higher.PeerValidatorID, now.UTC())
	if err != nil {
		result.Classification = "HISTORICAL_DIVERGENCE"
		result.Reason = err.Error()
		return result, nil
	}
	result.VerifiedHeight = verified.Height
	result.VerifiedDIRHash = strings.ToLower(verified.DIRHash)
	if verified.Height != higher.Head.LatestHeight || !strings.EqualFold(verified.DIRHash, higher.Head.LatestDIRHash) || !strings.EqualFold(verified.StateRoot, higher.Head.LatestStateRoot) || !strings.EqualFold(verified.ValidatorSetRoot, higher.Head.ValidatorSetRoot) {
		result.Classification = "HISTORICAL_DIVERGENCE"
		result.Reason = "proof-verified terminal head does not match the higher peer SYNC_HEAD claim"
		return result, nil
	}
	result.Classification = "PROVEN_LAG"
	result.AutoAdvanceAllowed = true
	result.Reason = "higher peer supplied a continuous governance-aware PFC/DIR proof chain extending the lower finalized DIR"
	return result, nil
}

func verifyPeerAncestryCommand(args []string) error {
	fs := newFlagSet("verify-peer-ancestry")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	lowerPath := fs.String("lower-head", "", "JSON PeerHeadObservation for the lower finalized head")
	higherPath := fs.String("higher-head", "", "JSON PeerHeadObservation for the higher finalized head")
	bundlePath := fs.String("proof-bundle", "", "governed SYNC_PROOF bundle JSON proving ancestry")
	trustedPolicyHash := fs.String("governance-policy-hash", "", "independently trusted validator-governance policy SHA-256")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *lowerPath == "" || *higherPath == "" || *bundlePath == "" || !isSHA256(strings.ToLower(*trustedPolicyHash)) {
		return errors.New("--lower-head, --higher-head, --proof-bundle and a valid --governance-policy-hash are required")
	}
	var cfg BootstrapConfig
	if err := readJSON(*dir+"/config.json", &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("peer ancestry verifier requires CANDIDATE state with voteAuthority=false")
	}
	var lower PeerHeadObservation
	if err := readJSON(*lowerPath, &lower); err != nil {
		return err
	}
	var higher PeerHeadObservation
	if err := readJSON(*higherPath, &higher); err != nil {
		return err
	}
	var bundle PeerSyncGovernedProofBundle
	if err := readJSON(*bundlePath, &bundle); err != nil {
		return err
	}
	result, err := verifyPeerHeadAncestry(cfg, lower, higher, bundle, strings.ToLower(*trustedPolicyHash), time.Now().UTC())
	if err != nil {
		return err
	}
	out, _ := json.MarshalIndent(map[string]any{
		"ancestry":               result,
		"state":                  cfg.State,
		"voteAuthority":          false,
		"consensusParticipation": false,
	}, "", "  ")
	fmt.Println(string(out))
	if result.Classification != "PROVEN_LAG" {
		return errors.New("peer ancestry was not proven; automatic sync advancement blocked")
	}
	return nil
}
