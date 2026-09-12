package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
)

func verifyProposerCommand(args []string) error {
	fs := flag.NewFlagSet("verify-proposer", flag.ContinueOnError)
	validatorSetPath := fs.String("validator-set", "", "validator-set JSON")
	vrfRegistryPath := fs.String("vrf-registry", "", "VRF key registry JSON")
	evidencePath := fs.String("evidence", "", "proposer entropy evidence JSON")
	expectedValidatorRoot := fs.String("validator-set-root", "", "trusted validator-set root")
	expectedVRFRoot := fs.String("vrf-registry-root", "", "trusted VRF-key registry root")
	protocolVersion := fs.String("protocol-version", "POVI/1", "expected protocol version")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *validatorSetPath == "" || *vrfRegistryPath == "" || *evidencePath == "" || *expectedValidatorRoot == "" || *expectedVRFRoot == "" {
		return errors.New("--validator-set, --vrf-registry, --evidence, --validator-set-root and --vrf-registry-root are required")
	}
	if !isSHA256(*expectedValidatorRoot) || !isSHA256(*expectedVRFRoot) {
		return errors.New("trusted roots must be lowercase SHA-256 digests")
	}
	var set SnapshotValidatorSet
	if err := readJSON(*validatorSetPath, &set); err != nil {
		return err
	}
	var registry VRFKeyRegistry
	if err := readJSON(*vrfRegistryPath, &registry); err != nil {
		return err
	}
	var evidence ProposerEntropyEvidence
	if err := readJSON(*evidencePath, &evidence); err != nil {
		return err
	}
	result, err := verifyProposerEntropyPortable(set, registry, evidence, *expectedValidatorRoot, *expectedVRFRoot, *protocolVersion)
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(b))
	fmt.Println("NOTE: Ed25519-Deterministic-Entropy-v1 is a STRATUM implementation profile, not RFC 9381 ECVRF.")
	return nil
}
