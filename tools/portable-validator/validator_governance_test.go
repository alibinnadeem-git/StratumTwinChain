package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type validatorGovernanceVector struct {
	ExpectedGovernancePolicyHash     string                  `json:"expectedGovernancePolicyHash"`
	ExpectedPreviousValidatorSetRoot string                  `json:"expectedPreviousValidatorSetRoot"`
	Proof                            ValidatorSetChangeProof `json:"proof"`
}

func loadValidatorGovernanceVector(t *testing.T) validatorGovernanceVector {
	t.Helper();b,err:=os.ReadFile(filepath.Join("..","..","lib","redbook","test-vectors","validator-governance-v1.json"));if err!=nil{t.Fatal(err)}
	var v validatorGovernanceVector;if err:=json.Unmarshal(b,&v);err!=nil{t.Fatal(err)};return v
}

func TestValidatorGovernanceRotationVectorVerifies(t *testing.T){
	v:=loadValidatorGovernanceVector(t)
	got,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousValidatorSetRoot);if err!=nil{t.Fatal(err)}
	if !got.Valid||got.ActionType!="ROTATE_CONSENSUS_KEY"||got.EffectiveHeight!=12||got.RequiredAuthority!=3||len(got.ValidSigners)!=3{t.Fatalf("unexpected verification %+v",got)}
	if got.NextValidatorSetRoot!="6411ce43c586b6c908c015f0ed206d18a24ea3723e43094cfe7a2d931903c9a7"{t.Fatalf("unexpected next validator root %s",got.NextValidatorSetRoot)}
}

func TestValidatorGovernanceRejectsTwoOfThree(t *testing.T){
	v:=loadValidatorGovernanceVector(t);v.Proof.Signatures=v.Proof.Signatures[:2]
	if _,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousValidatorSetRoot);err==nil{t.Fatal("2-of-3 governance signatures unexpectedly authorized change")}
}

func TestValidatorGovernanceRejectsWrongPolicyPin(t *testing.T){
	v:=loadValidatorGovernanceVector(t);wrong:="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",wrong,v.ExpectedPreviousValidatorSetRoot);err==nil{t.Fatal("wrong governance policy pin unexpectedly verified")}
}

func TestValidatorGovernanceRejectsWrongPreviousRoot(t *testing.T){
	v:=loadValidatorGovernanceVector(t);wrong:="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,wrong);err==nil{t.Fatal("wrong previous validator root unexpectedly verified")}
}

func TestValidatorGovernanceRejectsTamperedReplacementKey(t *testing.T){
	v:=loadValidatorGovernanceVector(t)
	for i:=range v.Proof.NextValidatorSet.Members{if v.Proof.NextValidatorSet.Members[i].ValidatorID=="validator-b"{for j:=range v.Proof.NextValidatorSet.Members[i].Keys{if v.Proof.NextValidatorSet.Members[i].Keys[j].KeyID=="validator-b:consensus:v2"{v.Proof.NextValidatorSet.Members[i].Keys[j].PublicKeyDerB64=v.Proof.PreviousValidatorSet.Members[0].Keys[0].PublicKeyDerB64}}}}
	if _,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousValidatorSetRoot);err==nil{t.Fatal("tampered replacement key unexpectedly verified")}
}

func TestValidatorGovernanceRejectsUnrelatedMutation(t *testing.T){
	v:=loadValidatorGovernanceVector(t)
	for i:=range v.Proof.NextValidatorSet.Members{if v.Proof.NextValidatorSet.Members[i].ValidatorID=="validator-c"{v.Proof.NextValidatorSet.Members[i].OperatorOrg="MUTATED"}}
	if _,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousValidatorSetRoot);err==nil{t.Fatal("unrelated validator mutation unexpectedly verified")}
}

func TestValidatorGovernanceRequiresFutureActivation(t *testing.T){
	v:=loadValidatorGovernanceVector(t);v.Proof.Action.ApprovedAtHeight=v.Proof.Action.EffectiveHeight
	if _,err:=verifyValidatorSetChangeProof(v.Proof,"stratum-devnet-1",v.ExpectedGovernancePolicyHash,v.ExpectedPreviousValidatorSetRoot);err==nil{t.Fatal("same-height governance activation unexpectedly verified")}
}
