package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type protocolGovernanceVector struct {
	ExpectedGovernancePolicyHash      string               `json:"expectedGovernancePolicyHash"`
	ExpectedPreviousProtocolStateHash string               `json:"expectedPreviousProtocolStateHash"`
	Proof                             ProtocolChangeProof  `json:"proof"`
}

func loadProtocolGovernanceVector(t *testing.T) protocolGovernanceVector {
	t.Helper();b,err:=os.ReadFile(filepath.Join("..","..","lib","redbook","test-vectors","protocol-governance-v1.json"));if err!=nil{t.Fatal(err)}
	var v protocolGovernanceVector;if err:=json.Unmarshal(b,&v);err!=nil{t.Fatal(err)};return v
}

func TestProtocolGovernanceVectorVerifies(t *testing.T){
	v:=loadProtocolGovernanceVector(t);got,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousProtocolStateHash);if err!=nil{t.Fatal(err)}
	if !got.Valid||got.FromProtocolVersion!="POVI/1"||got.ToProtocolVersion!="POVI/1.1"||got.ActivationHeight!=20||got.RequiredAuthority!=3||len(got.ValidSigners)!=3{t.Fatalf("unexpected verification %+v",got)}
	if got.NextProtocolStateHash!="326048b74d0f3616cb3565724743aeabad7fdadaac0e132c7834a85f035af47c"{t.Fatalf("unexpected next protocol state %s",got.NextProtocolStateHash)}
}

func TestProtocolGovernanceRejectsTwoOfThreeSupermajority(t *testing.T){
	v:=loadProtocolGovernanceVector(t);v.Proof.Signatures=v.Proof.Signatures[:2]
	if _,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousProtocolStateHash);err==nil{t.Fatal("2-of-3 unexpectedly authorized SUPERMAJORITY protocol change")}
}

func TestProtocolGovernanceRejectsWrongPolicyPin(t *testing.T){
	v:=loadProtocolGovernanceVector(t);wrong:="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",wrong,v.ExpectedPreviousProtocolStateHash);err==nil{t.Fatal("wrong PROTOCOL governance pin unexpectedly verified")}
}

func TestProtocolGovernanceRejectsWrongPreviousStatePin(t *testing.T){
	v:=loadProtocolGovernanceVector(t);wrong:="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,wrong);err==nil{t.Fatal("wrong previous protocol-state pin unexpectedly verified")}
}

func TestProtocolGovernanceRejectsTamperedManifest(t *testing.T){
	v:=loadProtocolGovernanceVector(t);v.Proof.ChangeManifest.SecurityImpactHash="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousProtocolStateHash);err==nil{t.Fatal("tampered protocol change manifest unexpectedly verified")}
}

func TestProtocolGovernanceRejectsMissingConsensusScope(t *testing.T){
	v:=loadProtocolGovernanceVector(t);v.Proof.GovernancePolicy.Scope=[]string{"PROTOCOL_VERSION"};hash,err:=canonicalProtocolGovernancePolicyHash(v.Proof.GovernancePolicy);if err!=nil{t.Fatal(err)};v.Proof.Action.GovernancePolicyHash=hash
	if _,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",hash,v.ExpectedPreviousProtocolStateHash);err==nil{t.Fatal("consensus-rule change without CONSENSUS_RULES authority unexpectedly verified")}
}

func TestProtocolGovernanceRequiresFutureActivation(t *testing.T){
	v:=loadProtocolGovernanceVector(t);v.Proof.Action.ActivationHeight=v.Proof.Action.ApprovedAtHeight
	if _,err:=verifyProtocolChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousProtocolStateHash);err==nil{t.Fatal("same-height protocol activation unexpectedly verified")}
}
