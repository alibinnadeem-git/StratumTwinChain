package main

import (
	"testing"
)

const (
	expectedPFCValidatorSetRoot="f0f2854ca630f6e6cf80e531100f449c6ba01a4f4755cb79d2240855a1604b83"
	expectedPFCDIRHash="220b8c257e601e97386c55a36c866a53d3160a4e90d197ce463d238574c3beee"
)

func loadPFCVector(t *testing.T) PoVIPFCProofBundle{
	t.Helper();var bundle PoVIPFCProofBundle
	if err:=readJSON(vectorPath("pfc-v1.json"),&bundle);err!=nil{t.Fatal(err)}
	return bundle
}

func TestCanonicalPFCVector(t *testing.T){
	bundle:=loadPFCVector(t)
	result,err:=verifyPoVIPFC(bundle);if err!=nil{t.Fatal(err)}
	if !result.Valid||result.DIRHash!=expectedPFCDIRHash||result.ValidatorSetRoot!=expectedPFCValidatorSetRoot{t.Fatalf("unexpected PFC result: %+v",result)}
	if result.ActiveValidatorCount!=3||result.RequiredQuorum!=3||len(result.ValidSignerIDs)!=3{t.Fatalf("unexpected PFC quorum: %+v",result)}
}

func TestPFCRejectsTamperedCommitSignature(t *testing.T){
	bundle:=loadPFCVector(t)
	bundle.PFC.SignerProof.Signatures[0].Signature="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
	if _,err:=verifyPoVIPFC(bundle);err==nil{t.Fatal("tampered COMMIT signature unexpectedly verified")}
}

func TestPFCRequiresThreeOfThree(t *testing.T){
	bundle:=loadPFCVector(t)
	bundle.PFC.SignerProof.Signatures=bundle.PFC.SignerProof.Signatures[:2]
	bundle.PFC.SignerProof.SignerIDs=bundle.PFC.SignerProof.SignerIDs[:2]
	if _,err:=verifyPoVIPFC(bundle);err==nil{t.Fatal("2-of-3 PFC unexpectedly reached PoVI quorum")}
}

func TestPFCRejectsCandidateMutation(t *testing.T){
	bundle:=loadPFCVector(t)
	bundle.DIRCandidateHeader.StateRoot="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _,err:=verifyPoVIPFC(bundle);err==nil{t.Fatal("mutated DIR candidate unexpectedly verified")}
}

func TestPFCRejectsNonActiveValidatorSet(t *testing.T){
	bundle:=loadPFCVector(t)
	bundle.Validators[2].State="DEGRADED"
	if _,err:=verifyPoVIPFC(bundle);err==nil{t.Fatal("non-ACTIVE canonical validator set unexpectedly verified")}
}

func TestPFCRejectsDuplicateSigner(t *testing.T){
	bundle:=loadPFCVector(t)
	bundle.PFC.SignerProof.SignerIDs[2]=bundle.PFC.SignerProof.SignerIDs[1]
	if _,err:=verifyPoVIPFC(bundle);err==nil{t.Fatal("duplicate PFC signer unexpectedly verified")}
}
