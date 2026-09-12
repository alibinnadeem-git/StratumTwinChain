package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type consensusTransportFixture struct {
	dir  string
	set  SnapshotValidatorSet
	root string
	cfg  BootstrapConfig
}

func makeConsensusTransportFixture(t *testing.T, active bool) consensusTransportFixture {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil { t.Fatal(err) }
	pubDER, err := x509.MarshalPKIXPublicKey(pub); if err != nil { t.Fatal(err) }
	privDER, err := x509.MarshalPKCS8PrivateKey(priv); if err != nil { t.Fatal(err) }
	dir:=t.TempDir()
	if err:=os.MkdirAll(filepath.Join(dir,"keys","private"),0o700);err!=nil{t.Fatal(err)}
	if err:=os.MkdirAll(filepath.Join(dir,"state"),0o700);err!=nil{t.Fatal(err)}
	if err:=os.WriteFile(filepath.Join(dir,"keys","private","consensus.pk8"),privDER,0o600);err!=nil{t.Fatal(err)}
	state:=candidateState;voteAuthority:=false;blockers:=[]string{"GOVERNANCE_ACTIVATION_REQUIRED","LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED"}
	if active { state="ACTIVE"; voteAuthority=true; blockers=[]string{} }
	cfg:=BootstrapConfig{BootstrapVersion:bootstrapVersion,ValidatorID:"validator-a",FriendlyLabel:"Validator A",ChainID:"stratum-devnet-1",NetworkName:"STRATUM Devnet",GenesisDIRHash:strings.Repeat("a",64),ProtocolVersion:"POVI/1",State:state,VoteAuthority:voteAuthority,ActivationBlockedReasons:blockers,Keys:map[string]KeyRef{"CONSENSUS":{Purpose:"CONSENSUS",Algorithm:"Ed25519",PublicKeyB64:base64.StdEncoding.EncodeToString(pubDER),PublicKeyHash:sha256Hex(pubDER),KeyVersion:1}}}
	if err:=writeJSON(filepath.Join(dir,"config.json"),cfg,0o600);err!=nil{t.Fatal(err)}
	set:=SnapshotValidatorSet{SetVersion:validatorSetProfile,ChainID:cfg.ChainID,Members:[]SnapshotValidator{{ValidatorID:cfg.ValidatorID,IdentityUUID:"11111111-1111-4111-8111-111111111111",OperatorOrg:"stratum",ActivationHeight:1,Keys:[]SnapshotConsensusKey{{KeyID:"validator-a:consensus:v1",Purpose:"CONSENSUS",Algorithm:"Ed25519",PublicKeyDerB64:base64.StdEncoding.EncodeToString(pubDER),ActiveFromHeight:1}}}}}
	root,err:=snapshotValidatorSetRoot(set,1);if err!=nil{t.Fatal(err)}
	if err:=initializeConsensusSafety(dir);err!=nil{t.Fatal(err)}
	return consensusTransportFixture{dir:dir,set:set,root:root,cfg:cfg}
}

func TestCandidateCannotSignConsensusWire(t *testing.T){
	f:=makeConsensusTransportFixture(t,false)
	_,err:=signVerifyWireMessage(f.dir,f.set,1,0,strings.Repeat("b",64),f.root,"POVI/1","",nil)
	if err==nil||!strings.Contains(err.Error(),"ACTIVE state") { t.Fatalf("expected governed ACTIVE rejection, got %v",err) }
	_,_,records,err:=latestConsensusSafetyRecord(f.dir);if err!=nil{t.Fatal(err)}
	if len(records)!=1||records[0].Step!="BOOTSTRAP"{t.Fatalf("candidate signing attempt mutated safety journal: %+v",records)}
}

func TestVerifyWirePersistsIntentAndBlocksEquivocation(t *testing.T){
	f:=makeConsensusTransportFixture(t,true)
	proposal:=strings.Repeat("b",64)
	wire,err:=signVerifyWireMessage(f.dir,f.set,1,0,proposal,f.root,"POVI/1","",nil);if err!=nil{t.Fatal(err)}
	if err:=verifyConsensusWireMessage(f.set,wire,f.cfg.ChainID,f.root,"POVI/1");err!=nil{t.Fatal(err)}
	_,latest,records,err:=latestConsensusSafetyRecord(f.dir);if err!=nil{t.Fatal(err)}
	if len(records)!=2||latest.Step!="VERIFY"||latest.MessageHash!=wire.Verify.MessageHash{t.Fatalf("VERIFY was not durably recorded before return: %+v",latest)}
	_,err=signVerifyWireMessage(f.dir,f.set,1,0,strings.Repeat("c",64),f.root,"POVI/1","",nil)
	if err==nil||!strings.Contains(err.Error(),"EQUIVOCATION_BLOCKED"){t.Fatalf("expected same-round equivocation block, got %v",err)}
	_,_,records,err=latestConsensusSafetyRecord(f.dir);if err!=nil{t.Fatal(err)}
	if len(records)!=2{t.Fatalf("equivocation attempt appended journal record: %d",len(records))}
}

func TestCommitWireRequiresDurableLockAndVerifies(t *testing.T){
	f:=makeConsensusTransportFixture(t,true)
	proposal:=strings.Repeat("b",64);stateRoot:=strings.Repeat("d",64)
	if _,err:=signVerifyWireMessage(f.dir,f.set,1,0,proposal,f.root,"POVI/1","",nil);err!=nil{t.Fatal(err)}
	if _,err:=recordConsensusSafetyDecision(f.dir,ConsensusSafetyDecision{Height:1,Round:0,Step:"LOCK",ProposalHash:proposal});err!=nil{t.Fatal(err)}
	wire,err:=signCommitWireMessage(f.dir,f.set,1,0,proposal,stateRoot,f.root,"POVI/1");if err!=nil{t.Fatal(err)}
	if err:=verifyConsensusWireMessage(f.set,wire,f.cfg.ChainID,f.root,"POVI/1");err!=nil{t.Fatal(err)}
	_,latest,_,err:=latestConsensusSafetyRecord(f.dir);if err!=nil{t.Fatal(err)}
	if latest.Step!="COMMIT"||latest.ProposalHash!=proposal||latest.MessageHash!=wire.Commit.MessageHash{t.Fatalf("COMMIT not journal-bound: %+v",latest)}
}

func TestCommitWithoutLockFailsBeforeSignature(t *testing.T){
	f:=makeConsensusTransportFixture(t,true)
	_,err:=signCommitWireMessage(f.dir,f.set,1,0,strings.Repeat("b",64),strings.Repeat("d",64),f.root,"POVI/1")
	if err==nil||!strings.Contains(err.Error(),"durable lock"){t.Fatalf("expected durable lock rejection, got %v",err)}
}

func TestRoundChangeWireUsesRecoveredSafetyState(t *testing.T){
	f:=makeConsensusTransportFixture(t,true)
	proposal:=strings.Repeat("b",64)
	if _,err:=signVerifyWireMessage(f.dir,f.set,1,0,proposal,f.root,"POVI/1","",nil);err!=nil{t.Fatal(err)}
	wire,err:=signRoundChangeWireMessage(f.dir,f.set,1,0,1,f.root,"POVI/1",nil);if err!=nil{t.Fatal(err)}
	if wire.TriggerRound==nil||*wire.TriggerRound!=0{t.Fatalf("missing trigger round")}
	if err:=verifyConsensusWireMessage(f.set,wire,f.cfg.ChainID,f.root,"POVI/1");err!=nil{t.Fatal(err)}
	_,latest,_,err:=latestConsensusSafetyRecord(f.dir);if err!=nil{t.Fatal(err)}
	if latest.Step!="ROUND_CHANGE"||latest.NewRound==nil||*latest.NewRound!=1{t.Fatalf("ROUND_CHANGE not durably journaled: %+v",latest)}
}

func TestConsensusWireRejectsTamper(t *testing.T){
	f:=makeConsensusTransportFixture(t,true)
	wire,err:=signVerifyWireMessage(f.dir,f.set,1,0,strings.Repeat("b",64),f.root,"POVI/1","",nil);if err!=nil{t.Fatal(err)}
	wire.Verify.ProposalHash=strings.Repeat("c",64)
	if err:=verifyConsensusWireMessage(f.set,wire,f.cfg.ChainID,f.root,"POVI/1");err==nil{t.Fatal("tampered VERIFY unexpectedly verified")}
}
