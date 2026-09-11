package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

func verifyRoundChangeCommand(args []string) error {
	fs := flag.NewFlagSet("verify-round-change", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	evidencePath := fs.String("evidence", "", "ROUND_CHANGE quorum evidence JSON")
	validatorSetPath := fs.String("validator-set", "", "validator-set history JSON")
	validatorSetRoot := fs.String("validator-set-root", "", "independently trusted validator-set root at the target height")
	protocolVersion := fs.String("protocol-version", "POVI/1", "expected protocol version")
	currentRound := fs.Int64("current-round", -1, "expected current round before transition; required")
	if err := fs.Parse(args); err != nil { return err }
	if *evidencePath==""||*validatorSetPath=="" { return errors.New("--evidence and --validator-set are required") }
	if *currentRound<0 { return errors.New("--current-round must be a non-negative integer") }
	if !isSHA256(strings.ToLower(*validatorSetRoot)) { return errors.New("--validator-set-root must be a 64-character SHA-256 digest from independently trusted validator history") }
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir,"config.json"),&cfg); err != nil { return err }
	set, err := readSnapshotValidatorSet(*validatorSetPath); if err != nil { return err }
	evidence, err := readRoundChangeEvidence(*evidencePath); if err != nil { return err }
	verification, err := verifyRoundChangeEvidence(set,evidence,cfg.ChainID,strings.ToLower(*validatorSetRoot),*protocolVersion,currentRound)
	if err != nil { return err }
	fmt.Printf("OK: ROUND_CHANGE quorum verified at height %d, round %d -> %d\n",verification.Height,verification.TriggerRound,verification.NewRound)
	fmt.Printf("OK: PoVI signer quorum %d/%d (%d required)\n",len(verification.ValidSigners),verification.ActiveValidatorCount,verification.RequiredQuorum)
	if verification.NILQuorumVerified { fmt.Printf("OK: prior-round NIL VERIFY quorum independently verified for round %d\n",verification.TriggerRound) }
	fmt.Printf("OK: validator-set root %s\n",verification.ValidatorSetRoot)
	fmt.Printf("safeUnlockAuthorized: %t\n",verification.SafeUnlockAuthorized)
	fmt.Println("NOTE: ROUND_CHANGE quorum authorizes the round transition only. Any lock replacement/unlock requires separately verified higher-round PLC evidence.")
	return nil
}
