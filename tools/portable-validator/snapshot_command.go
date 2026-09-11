package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

func verifySnapshotCommand(args []string) error {
	fs := flag.NewFlagSet("verify-snapshot", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	certificatePath := fs.String("certificate", "", "snapshot certificate JSON")
	validatorSetPath := fs.String("validator-set", "", "validator-set history JSON")
	validatorSetRoot := fs.String("validator-set-root", "", "independently trusted validator-set root for the snapshot height")
	protocolVersion := fs.String("protocol-version", "POVI/1", "expected protocol version")
	if err := fs.Parse(args); err != nil { return err }
	if *certificatePath==""||*validatorSetPath=="" { return errors.New("--certificate and --validator-set are required") }
	if !isSHA256(strings.ToLower(*validatorSetRoot)) { return errors.New("--validator-set-root must be a 64-character SHA-256 hex digest from an independently trusted history") }
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir,"config.json"),&cfg); err != nil { return err }
	var cert SnapshotTrustCertificate; if err := readJSON(*certificatePath,&cert); err != nil { return err }
	var set SnapshotValidatorSet; if err := readJSON(*validatorSetPath,&set); err != nil { return err }
	verification, err := verifySnapshotCertificate(set,cert,cfg.ChainID,strings.ToLower(*validatorSetRoot),*protocolVersion)
	if err != nil { return err }
	fmt.Printf("OK: certified snapshot verified at height %d\n", verification.SnapshotHeight)
	fmt.Printf("OK: validator-set root %s\n", verification.ValidatorSetRoot)
	fmt.Printf("OK: PoVI signer quorum %d/%d (%d required)\n", len(verification.ValidSigners),verification.ActiveValidatorCount,verification.RequiredQuorum)
	fmt.Printf("OK: snapshot binds DIR %s and state root %s\n",verification.DIRHash,verification.StateRoot)
	fmt.Println("NOTE: this proves snapshot certificate authority; subsequent DIR/PFC continuity must still be verified before advancing canonical state.")
	return nil
}
