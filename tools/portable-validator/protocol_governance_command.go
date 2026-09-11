package main

import (
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

func verifyProtocolGovernanceCommand(args []string) error {
	fs:=flag.NewFlagSet("verify-protocol-governance",flag.ContinueOnError)
	dir:=fs.String("dir",defaultHome(),"validator data directory")
	proofPath:=fs.String("proof","","protocol change proof JSON")
	policyHash:=fs.String("governance-policy-hash","","independently trusted PROTOCOL governance policy hash")
	previousStateHash:=fs.String("previous-protocol-state-hash","","independently trusted previous protocol-state hash")
	if err:=fs.Parse(args);err!=nil{return err}
	if *proofPath==""{return errors.New("--proof is required")}
	if !isSHA256(strings.ToLower(*policyHash)){return errors.New("--governance-policy-hash must be an independently trusted SHA-256 digest")}
	if !isSHA256(strings.ToLower(*previousStateHash)){return errors.New("--previous-protocol-state-hash must be an independently trusted SHA-256 digest")}
	var cfg BootstrapConfig;if err:=readJSON(filepath.Join(*dir,"config.json"),&cfg);err!=nil{return err}
	var proof ProtocolChangeProof;if err:=readJSON(*proofPath,&proof);err!=nil{return err}
	verified,err:=verifyProtocolChangeProof(proof,cfg.ChainID,strings.ToLower(*policyHash),strings.ToLower(*previousStateHash));if err!=nil{return err}
	fmt.Printf("OK: protocol transition %s -> %s governed at height %d, activates at height %d\n",verified.FromProtocolVersion,verified.ToProtocolVersion,verified.ApprovedAtHeight,verified.ActivationHeight)
	fmt.Printf("OK: PROTOCOL governance authority %d/%d (%d required)\n",len(verified.ValidSigners),verified.EligibleAuthorityCount,verified.RequiredAuthority)
	fmt.Printf("OK: trusted next protocol state %s\n",verified.NextProtocolStateHash)
	fmt.Println("NOTE: software packages remain transport artifacts; the governed proof defines consensus-rule activation.")
	return nil
}
