package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

func verifyValidatorGovernanceCommand(args []string) error {
	fs := flag.NewFlagSet("verify-validator-governance", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	proofPath := fs.String("proof", "", "validator-set change proof JSON")
	policyHash := fs.String("governance-policy-hash", "", "independently trusted VALIDATOR governance policy hash")
	previousRoot := fs.String("previous-validator-set-root", "", "independently trusted prior validator-set root")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *proofPath == "" {
		return errors.New("--proof is required")
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
	fmt.Printf("OK: %s for %s governed at approval height %d, effective height %d\n", verified.ActionType, verified.ValidatorID, verified.ApprovedAtHeight, verified.EffectiveHeight)
	fmt.Printf("OK: VALIDATOR governance authority %d/%d (%d required)\n", len(verified.ValidSigners), verified.EligibleAuthorityCount, verified.RequiredAuthority)
	fmt.Printf("OK: prior validator-set root %s verified\n", verified.PreviousValidatorSetRoot)
	fmt.Printf("OK: trusted next validator-set root %s\n", verified.NextValidatorSetRoot)
	fmt.Println("NOTE: successful proof verification updates trusted validator-set history; it does not grant local vote authority to a CANDIDATE node.")
	return nil
}
