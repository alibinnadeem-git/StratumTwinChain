package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
)

func verifyCanonicalGenesisCommand(args []string) error {
	fs := flag.NewFlagSet("verify-genesis", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	file := fs.String("file", "", "canonical Genesis DIR JSON file")
	if err := fs.Parse(args); err != nil { return err }
	if *file == "" { return errors.New("--file is required") }
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil { return err }
	verification, err := verifyCanonicalGenesis(*file, cfg.ChainID, cfg.GenesisDIRHash)
	if err != nil { return err }
	fmt.Printf("OK: canonical Genesis DIR verified: %s\n", verification.ComputedHash)
	fmt.Println("OK: objectId, GenesisDIRHash, chainId, and locally pinned trust root agree")
	fmt.Println("NOTE: governance/trust-root signatures and certified bootstrap history remain separate activation gates")
	return nil
}
