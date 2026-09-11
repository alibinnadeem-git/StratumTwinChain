package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type proposerVector struct {
	ValidatorSet SnapshotValidatorSet `json:"validatorSet"`
	Selection    ProposerSelectionInput `json:"selection"`
	Expected     struct {
		SelectedProposerID     string            `json:"selectedProposerId"`
		SelectedScore          string            `json:"selectedScore"`
		CandidateScores        map[string]string `json:"candidateScores"`
		EligibleValidatorCount int               `json:"eligibleValidatorCount"`
	} `json:"expected"`
}

func loadProposerVector(t *testing.T) proposerVector {
	t.Helper()
	b,err:=os.ReadFile(filepath.Join("..","..","lib","redbook","test-vectors","proposer-selection-v1.json"));if err!=nil{t.Fatal(err)}
	var v proposerVector;if err:=json.Unmarshal(b,&v);err!=nil{t.Fatal(err)};return v
}

func TestProposerSelectionVector(t *testing.T){
	v:=loadProposerVector(t)
	got,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);if err!=nil{t.Fatal(err)}
	if got.SelectedProposerID!=v.Expected.SelectedProposerID||got.SelectedScore!=v.Expected.SelectedScore||got.EligibleValidatorCount!=v.Expected.EligibleValidatorCount{t.Fatalf("unexpected selection %+v",got)}
	if got.VRFProofVerification!="EXTERNAL_VERIFIED_INPUT"||got.CryptographicVRFConformant{t.Fatalf("VRF conformance boundary drifted %+v",got)}
	for _,score:=range got.CandidateScores{if v.Expected.CandidateScores[score.ValidatorID]!=score.Score{t.Fatalf("score drift for %s",score.ValidatorID)}}
}

func TestProposerSelectionRejectsMissingCandidate(t *testing.T){
	v:=loadProposerVector(t);v.Selection.Candidates=v.Selection.Candidates[:2]
	if _,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);err==nil{t.Fatal("missing ACTIVE validator candidate unexpectedly accepted")}
}

func TestProposerSelectionRejectsDuplicateCandidate(t *testing.T){
	v:=loadProposerVector(t);v.Selection.Candidates=append(v.Selection.Candidates,v.Selection.Candidates[0])
	if _,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);err==nil{t.Fatal("duplicate proposer candidate unexpectedly accepted")}
}

func TestProposerSelectionRejectsUnverifiedVRF(t *testing.T){
	v:=loadProposerVector(t);v.Selection.Candidates[1].VRFProofVerifiedExternally=false
	if _,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);err==nil{t.Fatal("unverified VRF output unexpectedly accepted")}
}

func TestProposerSelectionRejectsUnverifiedEntropy(t *testing.T){
	v:=loadProposerVector(t);v.Selection.CollectiveEntropyVerifiedExternally=false
	if _,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);err==nil{t.Fatal("unverified collective entropy unexpectedly accepted")}
}

func TestProposerSelectionBindsRoundAndEntropy(t *testing.T){
	v:=loadProposerVector(t);base,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);if err!=nil{t.Fatal(err)}
	v.Selection.Round++;roundChanged,err:=selectPortableProposer(v.ValidatorSet,v.Selection,v.Selection.ValidatorSetRoot);if err!=nil{t.Fatal(err)}
	if roundChanged.CandidateScores[0].Score==base.CandidateScores[0].Score&&roundChanged.CandidateScores[1].Score==base.CandidateScores[1].Score&&roundChanged.CandidateScores[2].Score==base.CandidateScores[2].Score{t.Fatal("round did not bind proposer scores")}
}
