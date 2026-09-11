package main

import (
	"encoding/base64"
	"path/filepath"
	"testing"
)

type proposerVector struct {
	ProfileVersion             string                   `json:"profileVersion"`
	ExpectedValidatorSetRoot   string                   `json:"expectedValidatorSetRoot"`
	ExpectedVRFKeyRegistryRoot string                   `json:"expectedVRFKeyRegistryRoot"`
	ValidatorSet               SnapshotValidatorSet     `json:"validatorSet"`
	VRFKeyRegistry             VRFKeyRegistry           `json:"vrfKeyRegistry"`
	Context                    ProposerSelectionContext `json:"context"`
	ExpectedSelection          struct {
		SelectionSeed string `json:"selectionSeed"`
		ProposerID    string `json:"proposerId"`
		ProposerIndex int    `json:"proposerIndex"`
	} `json:"expectedSelection"`
	Evidence ProposerEntropyEvidence `json:"evidence"`
}

func loadProposerVector(t *testing.T) proposerVector {
	t.Helper()
	var vector proposerVector
	path:=filepath.Join("..","..","lib","redbook","test-vectors","vrf-proposer-v1.json")
	if err:=readJSON(path,&vector);err!=nil{t.Fatal(err)}
	return vector
}

func TestPoVIProposerVector(t *testing.T){
	v:=loadProposerVector(t)
	root,err:=vrfKeyRegistryRootPortable(v.VRFKeyRegistry,v.Context.Height);if err!=nil{t.Fatal(err)}
	if root!=v.ExpectedVRFKeyRegistryRoot{t.Fatalf("VRF registry root mismatch: %s",root)}
	selection,err:=selectProposerPortable(v.ValidatorSet,v.Context);if err!=nil{t.Fatal(err)}
	if selection.SelectionSeed!=v.ExpectedSelection.SelectionSeed||selection.ProposerID!=v.ExpectedSelection.ProposerID||selection.ProposerIndex!=v.ExpectedSelection.ProposerIndex{t.Fatalf("unexpected selection: %+v",selection)}
	result,err:=verifyProposerEntropyPortable(v.ValidatorSet,v.VRFKeyRegistry,v.Evidence,v.ExpectedValidatorSetRoot,v.ExpectedVRFKeyRegistryRoot,"POVI/1");if err!=nil{t.Fatal(err)}
	if !result.Valid||result.ProposerID!="validator-c"{t.Fatalf("unexpected verification: %+v",result)}
}

func TestPoVIProposerRejectsWrongProposer(t *testing.T){
	v:=loadProposerVector(t);v.Evidence.ProposerID="validator-a"
	if _,err:=verifyProposerEntropyPortable(v.ValidatorSet,v.VRFKeyRegistry,v.Evidence,v.ExpectedValidatorSetRoot,v.ExpectedVRFKeyRegistryRoot,"POVI/1");err==nil{t.Fatal("expected wrong proposer rejection")}
}

func TestPoVIProposerRejectsTamperedProof(t *testing.T){
	v:=loadProposerVector(t);v.Evidence.ProofB64=base64.StdEncoding.EncodeToString(make([]byte,64))
	if _,err:=verifyProposerEntropyPortable(v.ValidatorSet,v.VRFKeyRegistry,v.Evidence,v.ExpectedValidatorSetRoot,v.ExpectedVRFKeyRegistryRoot,"POVI/1");err==nil{t.Fatal("expected tampered proof rejection")}
}

func TestPoVIProposerRejectsIncompleteRegistry(t *testing.T){
	v:=loadProposerVector(t);v.VRFKeyRegistry.Validators=v.VRFKeyRegistry.Validators[:2]
	if _,err:=verifyProposerEntropyPortable(v.ValidatorSet,v.VRFKeyRegistry,v.Evidence,v.ExpectedValidatorSetRoot,v.ExpectedVRFKeyRegistryRoot,"POVI/1");err==nil{t.Fatal("expected incomplete registry rejection")}
}

func TestPoVIProposerRoundDomainSeparation(t *testing.T){
	v:=loadProposerVector(t);round0,err:=selectProposerPortable(v.ValidatorSet,v.Context);if err!=nil{t.Fatal(err)}
	v.Context.Round=2;round2,err:=selectProposerPortable(v.ValidatorSet,v.Context);if err!=nil{t.Fatal(err)}
	if round0.SelectionSeed==round2.SelectionSeed{t.Fatal("round must domain-separate proposer seed")}
	if round2.ProposerID!="validator-a"{t.Fatalf("fixed round-2 vector expected validator-a, got %s",round2.ProposerID)}
}
