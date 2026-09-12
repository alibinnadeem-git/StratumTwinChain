package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
)

func verifyFinalityCommand(args []string) error {
	fs := flag.NewFlagSet("verify-finality", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	proofPath := fs.String("proof", "", "DIR/PFC finality proof JSON")
	validatorSetPath := fs.String("validator-set", "", "validator-set history JSON")
	validatorSetRoot := fs.String("validator-set-root", "", "independently trusted validator-set root for the DIR height")
	previousHeight := fs.String("previous-height", "", "trusted previous DIR height")
	previousDIRHash := fs.String("previous-dir-hash", "", "trusted previous DIR hash")
	protocolVersion := fs.String("protocol-version", "POVI/1", "expected protocol version")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *proofPath == "" || *validatorSetPath == "" || *previousHeight == "" {
		return errors.New("--proof, --validator-set, and --previous-height are required")
	}
	if !isSHA256(strings.ToLower(*validatorSetRoot)) {
		return errors.New("--validator-set-root must be an independently trusted SHA-256 digest")
	}
	if !isSHA256(strings.ToLower(*previousDIRHash)) {
		return errors.New("--previous-dir-hash must be a trusted SHA-256 digest")
	}
	height, err := strconv.ParseInt(*previousHeight, 10, 64)
	if err != nil || height < 0 {
		return errors.New("--previous-height must be a non-negative integer")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	set, err := readSnapshotValidatorSet(*validatorSetPath)
	if err != nil {
		return err
	}
	proof, err := readFinalityProof(*proofPath)
	if err != nil {
		return err
	}
	verified, err := verifyDIRFinalityProof(set, proof, cfg.ChainID, height, strings.ToLower(*previousDIRHash), strings.ToLower(*validatorSetRoot), *protocolVersion)
	if err != nil {
		return err
	}
	fmt.Printf("OK: DIR finality verified at height %d round %d\n", verified.Height, verified.Round)
	fmt.Printf("OK: PFC quorum %d/%d (%d required)\n", len(verified.ValidSigners), verified.ActiveValidatorCount, verified.RequiredQuorum)
	fmt.Printf("OK: canonical DIR %s continues trusted head %s\n", verified.DIRHash, *previousDIRHash)
	fmt.Printf("OK: proposal %s and state root %s verified\n", verified.ProposalHash, verified.StateRoot)
	fmt.Println("NOTE: validator-set changes and protocol-version activation still require separately verified governance/history proofs.")
	return nil
}
