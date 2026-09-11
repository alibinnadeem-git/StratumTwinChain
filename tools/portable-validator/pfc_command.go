package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
)

func verifyPFCCommand(args []string) error {
	fs:=flag.NewFlagSet("verify-pfc",flag.ContinueOnError)
	dir:=fs.String("dir",defaultHome(),"validator data directory")
	proofPath:=fs.String("proof","","PoVI PFC proof bundle JSON")
	if err:=fs.Parse(args);err!=nil{return err}
	if *proofPath==""{return errors.New("--proof is required")}
	var cfg BootstrapConfig
	if err:=readJSON(filepath.Join(*dir,"config.json"),&cfg);err!=nil{return err}
	var bundle PoVIPFCProofBundle
	if err:=readJSON(*proofPath,&bundle);err!=nil{return err}
	if bundle.PFC.ChainID!=cfg.ChainID||bundle.DIRCandidateHeader.ChainID!=cfg.ChainID{return errors.New("PFC proof chainId does not match locally configured network")}
	if bundle.PFC.ProtocolVersion!=cfg.ProtocolVersion||bundle.DIRCandidateHeader.ProtocolVersion!=cfg.ProtocolVersion{return errors.New("PFC proof protocolVersion does not match locally configured protocol")}
	if bundle.DIRCandidateHeader.Height==1&&bundle.DIRCandidateHeader.PreviousDIRHash!=cfg.GenesisDIRHash{return errors.New("Height-1 PFC proof does not extend the locally pinned Genesis DIR")}
	result,err:=verifyPoVIPFC(bundle);if err!=nil{return err}
	fmt.Printf("OK: PoVI PFC verified for DIR %s\n",result.DIRHash)
	fmt.Printf("OK: cryptographic quorum %d/%d (%d required)\n",len(result.ValidSignerIDs),result.ActiveValidatorCount,result.RequiredQuorum)
	fmt.Printf("OK: validator-set root %s\n",result.ValidatorSetRoot)
	fmt.Println("NOTE: a valid historical PFC proves finality for that DIR; catch-up must still verify hash continuity, validator-set changes and protocol activations across subsequent heights")
	return nil
}
