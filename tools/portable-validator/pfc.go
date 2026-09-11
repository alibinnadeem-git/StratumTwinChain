package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
)

const (
	validatorSetHashDomain  = "STRATUM/VALIDATOR/SET/1"
	validatorSetHashProfile = "STRATUM-VALIDATOR-SET-HASH/1"
	dirCandidateHashDomain  = "STRATUM/DIR/CANDIDATE/1"
	dirCandidateHashProfile = "STRATUM-DIR-CANDIDATE-HASH/1"
	poviCommitDomain        = "STRATUM/POVI/COMMIT/1"
)

type PoVIValidatorIdentity struct {
	ValidatorID             string  `json:"validatorId"`
	FriendlyLabel           string  `json:"friendlyLabel"`
	ConsensusPublicKey      string  `json:"consensusPublicKey"`
	ConsensusKeyVersion     string  `json:"consensusKeyVersion"`
	VRFPublicKey            string  `json:"vrfPublicKey"`
	VRFKeyVersion           string  `json:"vrfKeyVersion"`
	TransportPublicKey      string  `json:"transportPublicKey"`
	TransportKeyVersion     string  `json:"transportKeyVersion"`
	OperatorOrg             string  `json:"operatorOrg"`
	State                   string  `json:"state"`
	ActivationHeight        *int64  `json:"activationHeight"`
	RetirementHeight        *int64  `json:"retirementHeight"`
	Assurance               string  `json:"assurance"`
}

type PoVIDIRCandidateHeader struct {
	ChainID             string         `json:"chainId"`
	Height              int64          `json:"height"`
	Round               int64          `json:"round"`
	PreviousDIRHash     string         `json:"previousDIRHash"`
	OrderedMicroDIRRoot string         `json:"orderedMicroDIRRoot"`
	StateRoot           string         `json:"stateRoot"`
	ValidatorSetRoot    string         `json:"validatorSetRoot"`
	ProtocolVersion     string         `json:"protocolVersion"`
	ProposerID          string         `json:"proposerId"`
	EntropyVRFEvidence  map[string]any `json:"entropyVRFEvidence"`
}

type PoVIPFCSignature struct {
	SignerID  string  `json:"signerId"`
	Signature string  `json:"signature"`
	KeyID     *string `json:"keyId,omitempty"`
	Algorithm *string `json:"algorithm,omitempty"`
	Domain    *string `json:"domain,omitempty"`
	SignedAt  *string `json:"signedAt,omitempty"`
}

type PoVISignerProof struct {
	SignerIDs      []string           `json:"signerIds"`
	SignerBitmap   *string            `json:"signerBitmap,omitempty"`
	Signatures     []PoVIPFCSignature `json:"signatures,omitempty"`
	AggregateProof *string            `json:"aggregateProof,omitempty"`
}

type PoVIFinalityCertificate struct {
	ChainID          string          `json:"chainId"`
	Height           int64           `json:"height"`
	Round            int64           `json:"round"`
	DIRHash          string          `json:"DIRHash"`
	StateRoot        string          `json:"stateRoot"`
	ValidatorSetRoot string          `json:"validatorSetRoot"`
	ProtocolVersion  string          `json:"protocolVersion"`
	SignerProof      PoVISignerProof `json:"signerProof"`
}

type PoVIPFCProofBundle struct {
	Profile            string                    `json:"profile"`
	Validators         []PoVIValidatorIdentity   `json:"validators"`
	DIRCandidateHeader PoVIDIRCandidateHeader    `json:"DIRCandidateHeader"`
	ProposalHash       string                    `json:"proposalHash"`
	PFC                PoVIFinalityCertificate   `json:"PFC"`
}

type PoVIPFCVerification struct {
	Valid                bool     `json:"valid"`
	DIRHash               string   `json:"DIRHash"`
	ValidatorSetRoot      string   `json:"validatorSetRoot"`
	ActiveValidatorCount  int      `json:"activeValidatorCount"`
	RequiredQuorum        int      `json:"requiredQuorum"`
	ValidSignerIDs        []string `json:"validSignerIds"`
}

func canonicalValue(value any) (any,error){
	b,err:=json.Marshal(value);if err!=nil{return nil,err}
	dec:=json.NewDecoder(bytes.NewReader(b));dec.UseNumber()
	var out any;if err:=dec.Decode(&out);err!=nil{return nil,err}
	return out,nil
}

func computePoVIValidatorSetRoot(validators []PoVIValidatorIdentity)(string,error){
	if len(validators)==0{return "",errors.New("PoVI validator set cannot be empty")}
	ordered:=append([]PoVIValidatorIdentity(nil),validators...)
	sort.Slice(ordered,func(i,j int)bool{return ordered[i].ValidatorID<ordered[j].ValidatorID})
	seen:=map[string]bool{}
	for _,v:=range ordered{
		if v.ValidatorID==""||v.State!="ACTIVE"{return "",fmt.Errorf("canonical PoVI validator set requires ACTIVE identified validators")}
		if seen[v.ValidatorID]{return "",fmt.Errorf("duplicate validatorId %s",v.ValidatorID)};seen[v.ValidatorID]=true
	}
	canonicalValidators,err:=canonicalValue(ordered);if err!=nil{return "",err}
	preimage,err:=canonicalJSON(map[string]any{"domain":validatorSetHashDomain,"profile":validatorSetHashProfile,"validators":canonicalValidators});if err!=nil{return "",err}
	return sha256Hex([]byte(preimage)),nil
}

func computePoVIDIRCandidateHash(header PoVIDIRCandidateHeader)(string,error){
	canonicalHeader,err:=canonicalValue(header);if err!=nil{return "",err}
	preimage,err:=canonicalJSON(map[string]any{"domain":dirCandidateHashDomain,"profile":dirCandidateHashProfile,"header":canonicalHeader});if err!=nil{return "",err}
	return sha256Hex([]byte(preimage)),nil
}

func requiredPoVIQuorum(n int)(int,error){
	if n<1{return 0,errors.New("PoVI requires at least one ACTIVE validator")}
	return (2*n)/3+1,nil
}

func verifyPoVIPFC(bundle PoVIPFCProofBundle)(PoVIPFCVerification,error){
	setRoot,err:=computePoVIValidatorSetRoot(bundle.Validators);if err!=nil{return PoVIPFCVerification{},err}
	if bundle.DIRCandidateHeader.ValidatorSetRoot!=setRoot||bundle.PFC.ValidatorSetRoot!=setRoot{return PoVIPFCVerification{},fmt.Errorf("validatorSetRoot mismatch: computed %s",setRoot)}
	candidateHash,err:=computePoVIDIRCandidateHash(bundle.DIRCandidateHeader);if err!=nil{return PoVIPFCVerification{},err}
	if bundle.ProposalHash!=candidateHash||bundle.PFC.DIRHash!=candidateHash{return PoVIPFCVerification{},fmt.Errorf("proposalHash/PFC DIRHash must equal canonical DIR candidate hash %s",candidateHash)}
	if bundle.PFC.ChainID!=bundle.DIRCandidateHeader.ChainID||bundle.PFC.Height!=bundle.DIRCandidateHeader.Height||bundle.PFC.Round!=bundle.DIRCandidateHeader.Round{return PoVIPFCVerification{},errors.New("PFC consensus context does not match DIR candidate header")}
	if bundle.PFC.StateRoot!=bundle.DIRCandidateHeader.StateRoot||bundle.PFC.ProtocolVersion!=bundle.DIRCandidateHeader.ProtocolVersion{return PoVIPFCVerification{},errors.New("PFC state/protocol does not bind DIR candidate header")}
	if bundle.PFC.SignerProof.AggregateProof!=nil{return PoVIPFCVerification{},errors.New("PoVI PFC v1 aggregateProof verification is not defined")}
	if bundle.PFC.SignerProof.SignerBitmap!=nil{return PoVIPFCVerification{},errors.New("PoVI PFC v1 signerBitmap mapping is not defined")}
	if len(bundle.PFC.SignerProof.Signatures)==0{return PoVIPFCVerification{},errors.New("PoVI PFC v1 requires individual COMMIT signatures")}
	validatorByID:=map[string]PoVIValidatorIdentity{}
	for _,v:=range bundle.Validators{validatorByID[v.ValidatorID]=v}
	signerSet:=map[string]bool{};for _,id:=range bundle.PFC.SignerProof.SignerIDs{if signerSet[id]{return PoVIPFCVerification{},fmt.Errorf("duplicate PFC signerId %s",id)};signerSet[id]=true}
	signatureSet:=map[string]bool{};validSigners:=[]string{}
	for _,sig:=range bundle.PFC.SignerProof.Signatures{
		if signatureSet[sig.SignerID]{return PoVIPFCVerification{},fmt.Errorf("duplicate PFC signature signer %s",sig.SignerID)};signatureSet[sig.SignerID]=true
		if !signerSet[sig.SignerID]{return PoVIPFCVerification{},fmt.Errorf("signature signer %s not declared in signerIds",sig.SignerID)}
		validator,ok:=validatorByID[sig.SignerID];if !ok||validator.State!="ACTIVE"{return PoVIPFCVerification{},fmt.Errorf("PFC signer %s is not ACTIVE",sig.SignerID)}
		if sig.Algorithm==nil||*sig.Algorithm!="Ed25519"||sig.Domain==nil||*sig.Domain!=poviCommitDomain{return PoVIPFCVerification{},fmt.Errorf("PFC signer %s has invalid signature profile",sig.SignerID)}
		if sig.KeyID!=nil{return PoVIPFCVerification{},errors.New("PoVI PFC v1 keyId mapping is not canonical; validator-set consensus key/version is authoritative")}
		if sig.SignedAt!=nil{return PoVIPFCVerification{},errors.New("PoVI PFC v1 rejects unsigned signedAt metadata")}
		der,err:=base64.StdEncoding.DecodeString(validator.ConsensusPublicKey);if err!=nil{return PoVIPFCVerification{},fmt.Errorf("invalid consensus public key for %s",sig.SignerID)}
		parsed,err:=x509.ParsePKIXPublicKey(der);if err!=nil{return PoVIPFCVerification{},fmt.Errorf("invalid SPKI consensus key for %s",sig.SignerID)}
		pub,ok:=parsed.(ed25519.PublicKey);if !ok{return PoVIPFCVerification{},fmt.Errorf("consensus key for %s is not Ed25519",sig.SignerID)}
		payload:=map[string]any{"domain":poviCommitDomain,"chainId":bundle.PFC.ChainID,"height":bundle.PFC.Height,"round":bundle.PFC.Round,"step":"COMMIT","proposalHash":bundle.PFC.DIRHash,"stateRoot":bundle.PFC.StateRoot,"validatorId":sig.SignerID,"validatorSetRoot":bundle.PFC.ValidatorSetRoot,"protocolVersion":bundle.PFC.ProtocolVersion}
		canonicalPayload,err:=canonicalJSON(payload);if err!=nil{return PoVIPFCVerification{},err}
		sigBytes,err:=base64.StdEncoding.DecodeString(sig.Signature);if err!=nil{return PoVIPFCVerification{},fmt.Errorf("invalid base64 COMMIT signature from %s",sig.SignerID)}
		if !ed25519.Verify(pub,[]byte(canonicalPayload),sigBytes){return PoVIPFCVerification{},fmt.Errorf("invalid COMMIT signature from %s",sig.SignerID)}
		validSigners=append(validSigners,sig.SignerID)
	}
	if len(signatureSet)!=len(signerSet){return PoVIPFCVerification{},errors.New("PFC signerIds must exactly match signature signerIds")}
	required,err:=requiredPoVIQuorum(len(bundle.Validators));if err!=nil{return PoVIPFCVerification{},err}
	if len(validSigners)<required{return PoVIPFCVerification{},fmt.Errorf("PoVI PFC cryptographic quorum not met: %d/%d valid signatures; %d required",len(validSigners),len(bundle.Validators),required)}
	sort.Strings(validSigners)
	return PoVIPFCVerification{true,candidateHash,setRoot,len(bundle.Validators),required,validSigners},nil
}
