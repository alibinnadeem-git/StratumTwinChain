package main

import (
 "errors"
 "fmt"
 "sort"
)

const (
 plcProofVersion = "STRATUM-PLC-PROOF/1"
 plcProofDomain = "STRATUM/PLC/PROOF/1"
)

type PoVILockCertificateProof struct {
 Domain string `json:"domain"`
 CertificateVersion string `json:"certificateVersion"`
 ChainID string `json:"chainId"`
 Height int64 `json:"height"`
 Round int64 `json:"round"`
 ProposalHash string `json:"proposalHash"`
 ValidatorSetRoot string `json:"validatorSetRoot"`
 ProtocolVersion string `json:"protocolVersion"`
 SignerIDs []string `json:"signerIds"`
 VERIFYSignatures []VerifyVoteProof `json:"VERIFYSignatures"`
}

type PLCVerification struct {
 Valid bool `json:"valid"`
 ChainID string `json:"chainId"`
 Height int64 `json:"height"`
 Round int64 `json:"round"`
 ProposalHash string `json:"proposalHash"`
 ValidatorSetRoot string `json:"validatorSetRoot"`
 ProtocolVersion string `json:"protocolVersion"`
 ActiveValidatorCount int `json:"activeValidatorCount"`
 RequiredQuorum int `json:"requiredQuorum"`
 ValidSigners []string `json:"validSigners"`
}

func sameStringSlice(a,b []string) bool { if len(a)!=len(b){return false}; for i:=range a{if a[i]!=b[i]{return false}}; return true }

func verifyPLC(set SnapshotValidatorSet, plc PoVILockCertificateProof, expectedChainID, expectedRoot, expectedProtocol string) (PLCVerification,error) {
 if plc.Domain!=plcProofDomain||plc.CertificateVersion!=plcProofVersion{return PLCVerification{},errors.New("unsupported PLC proof profile")}
 if set.ChainID!=expectedChainID||plc.ChainID!=expectedChainID{return PLCVerification{},errors.New("PLC chainId mismatch")}
 if plc.Height<1||plc.Round<0||plc.ProposalHash==""||plc.ProposalHash=="NIL"{return PLCVerification{},errors.New("PLC height/round/proposal is invalid")}
 if expectedProtocol!=""&&plc.ProtocolVersion!=expectedProtocol{return PLCVerification{},errors.New("PLC protocolVersion mismatch")}
 root,err:=snapshotValidatorSetRoot(set,plc.Height); if err!=nil{return PLCVerification{},err}; if root!=expectedRoot{return PLCVerification{},fmt.Errorf("PLC trusted validator-set root mismatch: computed %s",root)}; if plc.ValidatorSetRoot!=root{return PLCVerification{},errors.New("PLC does not bind the trusted validator-set root")}
 active:=activeValidatorMap(set,plc.Height); required,err:=requiredSnapshotQuorum(len(active)); if err!=nil{return PLCVerification{},err}
 seen:=map[string]bool{}; valid:=map[string]bool{}
 for _,vote:=range plc.VERIFYSignatures{
  if seen[vote.ValidatorID]{return PLCVerification{},fmt.Errorf("duplicate PLC VERIFY signer %s",vote.ValidatorID)}; seen[vote.ValidatorID]=true
  if vote.Domain!=poviVerifyDomain||vote.ChainID!=plc.ChainID||vote.Height!=plc.Height||vote.Round!=plc.Round||vote.Step!="VERIFY"||vote.ProposalHash=="NIL"||vote.ProposalHash!=plc.ProposalHash||vote.ValidatorSetRoot!=root||vote.ProtocolVersion!=plc.ProtocolVersion||vote.Algorithm!="Ed25519"{continue}
  expectedHash,err:=verifyVoteMessageHashPortable(vote); if err!=nil{return PLCVerification{},err}; if vote.MessageHash!=expectedHash{continue}; if verifyConsensusHashSignature(set,plc.Height,vote.ValidatorID,vote.KeyID,expectedHash,vote.SignatureB64){valid[vote.ValidatorID]=true}
 }
 signers:=make([]string,0,len(valid)); for id:=range valid{signers=append(signers,id)}; sort.Strings(signers); if len(signers)<required{return PLCVerification{},fmt.Errorf("PLC PoVI quorum not met: %d/%d; %d required",len(signers),len(active),required)}
 declared:=append([]string(nil),plc.SignerIDs...); canonical:=append([]string(nil),declared...); sort.Strings(canonical); for i:=1;i<len(canonical);i++{if canonical[i]==canonical[i-1]{return PLCVerification{},errors.New("PLC signerIds must be unique")}}; if !sameStringSlice(declared,canonical){return PLCVerification{},errors.New("PLC signerIds must be canonically sorted")}; if !sameStringSlice(declared,signers){return PLCVerification{},errors.New("PLC signerIds do not exactly match valid VERIFY signatures")}
 return PLCVerification{true,plc.ChainID,plc.Height,plc.Round,plc.ProposalHash,root,plc.ProtocolVersion,len(active),required,signers},nil
}
