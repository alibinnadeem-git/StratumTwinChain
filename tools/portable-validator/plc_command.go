package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
)

func verifyPLCCommand(args []string) error {
	fs := flag.NewFlagSet("verify-plc", flag.ContinueOnError)
	plcPath := fs.String("plc", "", "PLC proof JSON")
	validatorSetPath := fs.String("validator-set", "", "validator set JSON")
	chainID := fs.String("chain-id", "", "expected chainId")
	validatorSetRoot := fs.String("validator-set-root", "", "independently trusted validator-set root")
	protocolVersion := fs.String("protocol-version", "POVI/1", "expected protocol version")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *plcPath == "" || *validatorSetPath == "" || *chainID == "" || *validatorSetRoot == "" {
		return errors.New("--plc, --validator-set, --chain-id and --validator-set-root are required")
	}
	var plc PoVILockCertificateProof
	if err := readJSON(*plcPath, &plc); err != nil {
		return err
	}
	var set SnapshotValidatorSet
	if err := readJSON(*validatorSetPath, &set); err != nil {
		return err
	}
	result, err := verifyPLC(set, plc, *chainID, *validatorSetRoot, *protocolVersion)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(os.Stdout, string(out))
	return nil
}
