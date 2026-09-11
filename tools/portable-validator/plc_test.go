package main

import (
 "encoding/json"
 "os"
 "path/filepath"
 "testing"
)

type plcVector struct { ExpectedValidatorSetRoot string `json:"expectedValidatorSetRoot"`; ValidatorSet SnapshotValidatorSet `json:"validatorSet"`; PLC PoVILockCertificateProof `json:"PLC"` }
func loadPLCVector(t *testing.T) plcVector { t.Helper(); b,err:=os.ReadFile(filepath.Join("..","..","lib","redbook","test-vectors","plc-v1.json"));if err!=nil{t.Fatal(err)};var v plcVector;if err:=json.Unmarshal(b,&v);err!=nil{t.Fatal(err)};return v }

func TestPLCVectorVerifies(t *testing.T){v:=loadPLCVector(t);got,err:=verifyPLC(v.ValidatorSet,v.PLC,"stratum-plc-test-1",v.ExpectedValidatorSetRoot,"POVI/1");if err!=nil{t.Fatal(err)};if !got.Valid||got.RequiredQuorum!=3||len(got.ValidSigners)!=3||got.ProposalHash!=v.PLC.ProposalHash{t.Fatalf("unexpected PLC verification %+v",got)}}
func TestPLCRejectsTwoOfThree(t *testing.T){v:=loadPLCVector(t);v.PLC.VERIFYSignatures=v.PLC.VERIFYSignatures[:2];v.PLC.SignerIDs=v.PLC.SignerIDs[:2];if _,err:=verifyPLC(v.ValidatorSet,v.PLC,"stratum-plc-test-1",v.ExpectedValidatorSetRoot,"POVI/1");err==nil{t.Fatal("2-of-3 VERIFY unexpectedly formed PLC")}}
func TestPLCRejectsTamperedSignature(t *testing.T){v:=loadPLCVector(t);v.PLC.VERIFYSignatures[0].SignatureB64="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";if _,err:=verifyPLC(v.ValidatorSet,v.PLC,"stratum-plc-test-1",v.ExpectedValidatorSetRoot,"POVI/1");err==nil{t.Fatal("tampered PLC VERIFY signature unexpectedly verified")}}
func TestPLCRejectsNILVote(t *testing.T){v:=loadPLCVector(t);v.PLC.VERIFYSignatures[0].ProposalHash="NIL";if _,err:=verifyPLC(v.ValidatorSet,v.PLC,"stratum-plc-test-1",v.ExpectedValidatorSetRoot,"POVI/1");err==nil{t.Fatal("NIL VERIFY unexpectedly counted toward PLC")}}
func TestPLCRejectsDuplicateSigner(t *testing.T){v:=loadPLCVector(t);v.PLC.VERIFYSignatures[1]=v.PLC.VERIFYSignatures[0];if _,err:=verifyPLC(v.ValidatorSet,v.PLC,"stratum-plc-test-1",v.ExpectedValidatorSetRoot,"POVI/1");err==nil{t.Fatal("duplicate PLC VERIFY signer unexpectedly verified")}}
func TestPLCRejectsWrongTrustedRoot(t *testing.T){v:=loadPLCVector(t);if _,err:=verifyPLC(v.ValidatorSet,v.PLC,"stratum-plc-test-1","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","POVI/1");err==nil{t.Fatal("wrong trusted validator-set root unexpectedly verified")}}
