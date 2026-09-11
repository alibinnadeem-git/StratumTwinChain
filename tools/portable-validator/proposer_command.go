package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

func verifyProposerSelectionCommand(args []string) error {
	fs := flag.NewFlagSet("verify-proposer-selection", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	selectionPath := fs.String("selection", "", "proposer-selection input JSON with externally verified VRF outputs")
	validatorSetPath := fs.String("validator-set", "", "validator-set history JSON")
	validatorSetRoot := fs.String("validator-set-root", "", "independently trusted validator-set root at selection height")
	if err := fs.Parse(args); err != nil { return err }
	if *selectionPath == "" || *validatorSetPath == "" { return errors.New("--selection and --validator-set are required") }
	if !isSHA256(strings.ToLower(*validatorSetRoot)) { return errors.New("--validator-set-root must be a 64-character SHA-256 digest from independently trusted validator history") }
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil { return err }
	set, err := readSnapshotValidatorSet(*validatorSetPath); if err != nil { return err }
	var selection ProposerSelectionInput
	if err := readJSON(*selectionPath, &selection); err != nil { return err }
	if selection.ChainID != cfg.ChainID { return fmt.Errorf("proposer-selection chainId mismatch: expected %s got %s", cfg.ChainID, selection.ChainID) }
	result, err := selectPortableProposer(set, selection, strings.ToLower(*validatorSetRoot)); if err != nil { return err }
	fmt.Printf("OK: deterministic proposer selected at height %d round %d: %s\n", result.Height, result.Round, result.SelectedProposerID)
	fmt.Printf("OK: equal eligible opportunity set %d/%d\n", result.EligibleValidatorCount, result.EligibleValidatorCount)
	fmt.Printf("OK: validator-set root %s\n", result.ValidatorSetRoot)
	fmt.Printf("selectedScore: %s\n", result.SelectedScore)
	fmt.Printf("vrfProofVerification: %s\n", result.VRFProofVerification)
	fmt.Printf("cryptographicVRFConformant: %t\n", result.CryptographicVRFConformant)
	fmt.Println("NOTE: this command verifies deterministic proposer reduction over externally verified VRF outputs; it does not verify the cryptographic VRF proofs themselves.")
	return nil
}
