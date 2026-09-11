package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type roundChangeVector struct {
	ExpectedValidatorSetRoot string                    `json:"expectedValidatorSetRoot"`
	ValidatorSet             SnapshotValidatorSet      `json:"validatorSet"`
	Evidence                 RoundChangeQuorumEvidence `json:"evidence"`
}

func loadRoundChangeVector(t *testing.T) roundChangeVector {
	t.Helper()
	b,err:=os.ReadFile(filepath.Join("..","..","lib","redbook","test-vectors","round-change-v1.json"));if err!=nil{t.Fatal(err)}
	var v roundChangeVector;if err:=json.Unmarshal(b,&v);err!=nil{t.Fatal(err)};return v
}

func TestRoundChangeVectorVerifies(t *testing.T){
	v:=loadRoundChangeVector(t);current:=int64(0)
	got,err:=verifyRoundChangeEvidence(v.ValidatorSet,v.Evidence,"stratum-devnet-1",v.ExpectedValidatorSetRoot,"POVI/1",&current);if err!=nil{t.Fatal(err)}
	if !got.Valid||got.Height!=11||got.TriggerRound!=0||got.NewRound!=1||got.RequiredQuorum!=3||len(got.ValidSigners)!=3||!got.NILQuorumVerified{t.Fatalf("unexpected verification %+v",got)}
	if got.SafeUnlockAuthorized{t.Fatal("ROUND_CHANGE quorum must never authorize safe unlock by itself")}
}

func TestRoundChangeRejectsTwoOfThreeVotes(t *testing.T){
	v:=loadRoundChangeVector(t);v.Evidence.RoundChangeVotes=v.Evidence.RoundChangeVotes[:2];current:=int64(0)
	if _,err:=verifyRoundChangeEvidence(v.ValidatorSet,v.Evidence,"stratum-devnet-1",v.ExpectedValidatorSetRoot,"POVI/1",&current);err==nil{t.Fatal("2-of-3 ROUND_CHANGE votes unexpectedly met PoVI quorum")}
}

func TestRoundChangeRejectsTwoOfThreeNILVotes(t *testing.T){
	v:=loadRoundChangeVector(t);v.Evidence.PriorRoundNILVotes=v.Evidence.PriorRoundNILVotes[:2];current:=int64(0)
	if _,err:=verifyRoundChangeEvidence(v.ValidatorSet,v.Evidence,"stratum-devnet-1",v.ExpectedValidatorSetRoot,"POVI/1",&current);err==nil{t.Fatal("2-of-3 NIL VERIFY votes unexpectedly met PoVI quorum")}
}

func TestRoundChangeRejectsTamperedSignature(t *testing.T){
	v:=loadRoundChangeVector(t);v.Evidence.RoundChangeVotes[0].SignatureB64="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";current:=int64(0)
	if _,err:=verifyRoundChangeEvidence(v.ValidatorSet,v.Evidence,"stratum-devnet-1",v.ExpectedValidatorSetRoot,"POVI/1",&current);err==nil{t.Fatal("tampered ROUND_CHANGE signature unexpectedly verified")}
}

func TestRoundChangeRejectsDuplicateSigner(t *testing.T){
	v:=loadRoundChangeVector(t);v.Evidence.RoundChangeVotes[1]=v.Evidence.RoundChangeVotes[0];current:=int64(0)
	if _,err:=verifyRoundChangeEvidence(v.ValidatorSet,v.Evidence,"stratum-devnet-1",v.ExpectedValidatorSetRoot,"POVI/1",&current);err==nil{t.Fatal("duplicate ROUND_CHANGE signer unexpectedly verified")}
}

func TestRoundChangeRejectsLockClaimWithoutEvidence(t *testing.T){
	v:=loadRoundChangeVector(t);locked:="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";round:=int64(0);v.Evidence.RoundChangeVotes[0].LockedDIR=&locked;v.Evidence.RoundChangeVotes[0].LockedRound=&round;v.Evidence.RoundChangeVotes[0].EvidenceRefs=nil;current:=int64(0)
	if _,err:=verifyRoundChangeEvidence(v.ValidatorSet,v.Evidence,"stratum-devnet-1",v.ExpectedValidatorSetRoot,"POVI/1",&current);err==nil{t.Fatal("lock claim without PLC/evidence reference unexpectedly verified")}
}
