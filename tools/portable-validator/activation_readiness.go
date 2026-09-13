package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

type ActivationReadiness struct {
	GovernanceProofValid        bool     `json:"governanceProofValid"`
	ValidatorID                 string   `json:"validatorId"`
	EffectiveHeight             int64    `json:"effectiveHeight"`
	CurrentHeight               int64    `json:"currentHeight"`
	LocalIdentityMatch          bool     `json:"localIdentityMatch"`
	LocalConsensusKeyMatch      bool     `json:"localConsensusKeyMatch"`
	GovernanceActivationDue     bool     `json:"governanceActivationDue"`
	VoteAuthority               bool     `json:"voteAuthority"`
	RemainingActivationBlockers []string `json:"remainingActivationBlockers"`
	ReadyForVoteAuthority       bool     `json:"readyForVoteAuthority"`
}

func evaluateActivationReadiness(cfg BootstrapConfig, proof ValidatorSetChangeProof, verified ValidatorSetChangeVerification, currentHeight int64) (ActivationReadiness, error) {
	if !verified.Valid || verified.ActionType != "ACTIVATE" || proof.Action.ActionType != "ACTIVATE" {
		return ActivationReadiness{}, errors.New("activation readiness requires a verified ACTIVATE validator-set action")
	}
	if verified.ValidatorID != cfg.ValidatorID || proof.Action.ValidatorID != cfg.ValidatorID {
		return ActivationReadiness{}, errors.New("governed ACTIVATE target does not match local permanent validatorId")
	}
	if currentHeight < 0 {
		return ActivationReadiness{}, errors.New("current height must be non-negative")
	}
	member, ok := validatorMemberByID(proof.NextValidatorSet, cfg.ValidatorID)
	if !ok {
		return ActivationReadiness{}, errors.New("local validator is absent from governed next validator set")
	}
	if !snapshotValidatorActive(member, verified.EffectiveHeight) {
		return ActivationReadiness{}, errors.New("local validator is not ACTIVE in governed set at effective height")
	}
	consensusKey, err := activeSnapshotConsensusKey(member, verified.EffectiveHeight)
	if err != nil {
		return ActivationReadiness{}, err
	}
	localKey, ok := cfg.Keys["CONSENSUS"]
	if !ok || localKey.PublicKeyB64 == "" {
		return ActivationReadiness{}, errors.New("local CONSENSUS key metadata is missing")
	}
	keyMatch := consensusKey.PublicKeyDerB64 == localKey.PublicKeyB64
	if !keyMatch {
		return ActivationReadiness{}, errors.New("governed ACTIVE consensus key does not match local CONSENSUS key")
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return ActivationReadiness{}, errors.New("activation readiness verifier expects a non-voting CANDIDATE")
	}
	if !contains(cfg.ActivationBlockedReasons, "GOVERNANCE_ACTIVATION_REQUIRED") {
		return ActivationReadiness{}, errors.New("candidate is missing GOVERNANCE_ACTIVATION_REQUIRED safety blocker")
	}
	remaining := []string{}
	for _, blocker := range cfg.ActivationBlockedReasons {
		if blocker != "GOVERNANCE_ACTIVATION_REQUIRED" {
			remaining = append(remaining, blocker)
		}
	}
	due := currentHeight >= verified.EffectiveHeight
	return ActivationReadiness{
		GovernanceProofValid:        true,
		ValidatorID:                 cfg.ValidatorID,
		EffectiveHeight:             verified.EffectiveHeight,
		CurrentHeight:               currentHeight,
		LocalIdentityMatch:          true,
		LocalConsensusKeyMatch:      true,
		GovernanceActivationDue:     due,
		VoteAuthority:               false,
		RemainingActivationBlockers: remaining,
		ReadyForVoteAuthority:       due && len(remaining) == 0,
	}, nil
}

func verifyActivationReadinessCommand(args []string) error {
	fs := flag.NewFlagSet("verify-activation-readiness", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	proofPath := fs.String("proof", "", "governed ACTIVATE validator-set proof JSON")
	policyHash := fs.String("governance-policy-hash", "", "independently trusted VALIDATOR governance policy hash")
	previousRoot := fs.String("previous-validator-set-root", "", "independently trusted prior validator-set root")
	currentHeight := fs.Int64("current-height", -1, "locally verified current finalized height")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *proofPath == "" || *currentHeight < 0 {
		return errors.New("--proof and --current-height are required")
	}
	if !isSHA256(strings.ToLower(*policyHash)) {
		return errors.New("--governance-policy-hash must be an independently trusted SHA-256 digest")
	}
	if !isSHA256(strings.ToLower(*previousRoot)) {
		return errors.New("--previous-validator-set-root must be an independently trusted SHA-256 digest")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	var proof ValidatorSetChangeProof
	if err := readJSON(*proofPath, &proof); err != nil {
		return err
	}
	verified, err := verifyValidatorSetChangeProof(proof, cfg.ChainID, strings.ToLower(*policyHash), strings.ToLower(*previousRoot))
	if err != nil {
		return err
	}
	readiness, err := evaluateActivationReadiness(cfg, proof, verified, *currentHeight)
	if err != nil {
		return err
	}
	fmt.Printf("OK: governed ACTIVATE proof matches local validator %s and CONSENSUS key\n", readiness.ValidatorID)
	fmt.Printf("OK: activation effective height %d; locally verified current height %d\n", readiness.EffectiveHeight, readiness.CurrentHeight)
	if !readiness.GovernanceActivationDue {
		fmt.Println("WAIT: governed activation height has not been reached.")
	}
	if len(readiness.RemainingActivationBlockers) > 0 {
		fmt.Printf("BLOCKED: remaining activation blockers: %s\n", strings.Join(readiness.RemainingActivationBlockers, ", "))
	}
	fmt.Println("Vote authority remains false. This command verifies readiness only and never activates or votes.")
	return nil
}
