package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
)

func verifyGenesisTrustCommand(args []string) error {
	fs:=flag.NewFlagSet("verify-genesis-trust",flag.ContinueOnError)
	dir:=fs.String("dir",defaultHome(),"validator data directory")
	genesisPath:=fs.String("genesis","","canonical Genesis DIR JSON file")
	bundlePath:=fs.String("trust-bundle","","externally pinned bootstrap trust bundle JSON")
	bundleHash:=fs.String("trust-bundle-hash","","expected SHA-256 bootstrap trust-bundle hash")
	certificatePath:=fs.String("certificate","","threshold-signed Genesis certificate JSON")
	if err:=fs.Parse(args);err!=nil{return err}
	if *genesisPath==""||*bundlePath==""||*bundleHash==""||*certificatePath==""{return errors.New("--genesis, --trust-bundle, --trust-bundle-hash and --certificate are required")}
	if !isSHA256(*bundleHash){return errors.New("--trust-bundle-hash must be a 64-character SHA-256 hex digest")}
	var cfg BootstrapConfig
	if err:=readJSON(filepath.Join(*dir,"config.json"),&cfg);err!=nil{return err}
	genesis,err:=verifyCanonicalGenesis(*genesisPath,cfg.ChainID,cfg.GenesisDIRHash);if err!=nil{return err}
	cert,err:=verifyGenesisTrust(*bundlePath,*certificatePath,*bundleHash,cfg.ChainID,genesis.ComputedHash,cfg.ProtocolVersion);if err!=nil{return err}
	fmt.Printf("OK: Genesis trust certificate verified with %d/%d valid governance roots\n",len(cert.ValidSigners),cert.Threshold)
	fmt.Printf("OK: pinned bootstrap trust bundle %s\n",cert.ComputedBundleHash)
	fmt.Printf("OK: certified Genesis DIR %s\n",cert.GenesisDIRHash)
	fmt.Println("NOTE: successful bootstrap trust verification does not grant vote authority; governed validator activation remains required")
	return nil
}
