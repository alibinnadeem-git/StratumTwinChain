package main

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"
)

const (
	peerTransportProfile       = "STRATUM-PEER-TRANSPORT/1"
	peerTransportEnvelopeDomain = "STRATUM/PEER/ENVELOPE/1"
	peerTransportRegistryProfile = "STRATUM-PEER-REGISTRY/1"
	peerTransportRegistryDomain  = "STRATUM/PEER_REGISTRY/1"
)

var readOnlyPeerMessageTypes = map[string]bool{
	"PING": true,
	"STATUS": true,
	"TRUST_ROOTS": true,
}

type PeerTransportKey struct {
	KeyID            string `json:"keyId"`
	Purpose          string `json:"purpose"`
	Algorithm        string `json:"algorithm"`
	PublicKeyDerB64  string `json:"publicKeyDerB64"`
	ActiveFromHeight int64  `json:"activeFromHeight"`
	RetiredAtHeight  *int64 `json:"retiredAtHeight"`
}

type PeerTransportMember struct {
	ValidatorID string             `json:"validatorId"`
	Keys        []PeerTransportKey `json:"keys"`
}

type PeerTransportRegistry struct {
	RegistryVersion string                `json:"registryVersion"`
	ChainID         string                `json:"chainId"`
	GenesisDIRHash  string                `json:"GenesisDIRHash"`
	ProtocolVersion string                `json:"protocolVersion"`
	Members         []PeerTransportMember `json:"members"`
}

type PeerEnvelope struct {
	ProfileVersion    string          `json:"profileVersion"`
	Domain            string          `json:"domain"`
	ChainID           string          `json:"chainId"`
	NetworkName       string          `json:"networkName"`
	GenesisDIRHash    string          `json:"GenesisDIRHash"`
	ProtocolVersion   string          `json:"protocolVersion"`
	SenderValidatorID string          `json:"senderValidatorId"`
	SenderKeyID       string          `json:"senderKeyId"`
	Sequence          uint64          `json:"sequence"`
	Nonce             string          `json:"nonce"`
	IssuedAt          string          `json:"issuedAt"`
	ExpiresAt         string          `json:"expiresAt"`
	MessageType       string          `json:"messageType"`
	Payload           json.RawMessage `json:"payload"`
	PayloadHash       string          `json:"payloadHash"`
	MessageHash       string          `json:"messageHash"`
	SignatureB64      string          `json:"signatureB64"`
}

type PeerReplayState struct {
	ProfileVersion string            `json:"profileVersion"`
	ChainID        string            `json:"chainId"`
	LastSequence   map[string]uint64 `json:"lastSequence"`
	SeenNonces     map[string]string `json:"seenNonces"`
	UpdatedAt      string            `json:"updatedAt"`
}

type PeerEnvelopeVerification struct {
	Valid              bool   `json:"valid"`
	ProfileVersion     string `json:"profileVersion"`
	SenderValidatorID  string `json:"senderValidatorId"`
	MessageType        string `json:"messageType"`
	Sequence           uint64 `json:"sequence"`
	MessageHash        string `json:"messageHash"`
	PeerRegistryRoot   string `json:"peerRegistryRoot"`
	ReadOnly           bool   `json:"readOnly"`
}

func peerKeyActiveAtHeight(key PeerTransportKey, height int64) bool {
	return key.ActiveFromHeight <= height && (key.RetiredAtHeight == nil || *key.RetiredAtHeight > height)
}

func activePeerTransportKey(registry PeerTransportRegistry, validatorID string, height int64) (PeerTransportKey,error) {
	for _, member := range registry.Members {
		if member.ValidatorID != validatorID { continue }
		active := []PeerTransportKey{}
		for _, key := range member.Keys { if peerKeyActiveAtHeight(key,height) { active=append(active,key) } }
		if len(active)!=1 { return PeerTransportKey{},fmt.Errorf("validator %s must have exactly one active TRANSPORT key at height %d; found %d",validatorID,height,len(active)) }
		key:=active[0]
		if key.Purpose!="TRANSPORT"||key.Algorithm!="ED25519_TRANSPORT_IDENTITY" { return PeerTransportKey{},fmt.Errorf("validator %s has unsupported TRANSPORT key profile",validatorID) }
		return key,nil
	}
	return PeerTransportKey{},fmt.Errorf("unknown peer validator %s",validatorID)
}

func peerRegistryRootAtHeight(registry PeerTransportRegistry,height int64)(string,error){
	if registry.RegistryVersion!=peerTransportRegistryProfile{return "",errors.New("unsupported peer registry profile")}
	if registry.ChainID==""||!isSHA256(registry.GenesisDIRHash)||registry.ProtocolVersion==""||height<0{return "",errors.New("invalid peer registry trust context")}
	members:=make([]map[string]any,0,len(registry.Members));seen:=map[string]bool{}
	for _,member:=range registry.Members{
		if member.ValidatorID==""||seen[member.ValidatorID]{return "",errors.New("peer registry validator IDs must be unique and non-empty")};seen[member.ValidatorID]=true
		key,err:=activePeerTransportKey(registry,member.ValidatorID,height);if err!=nil{return "",err}
		members=append(members,map[string]any{"validatorId":member.ValidatorID,"keyId":key.KeyID,"algorithm":key.Algorithm,"publicKeyDerB64":key.PublicKeyDerB64})
	}
	sort.Slice(members,func(i,j int)bool{return members[i]["validatorId"].(string)<members[j]["validatorId"].(string)})
	return canonicalHashValue(map[string]any{"domain":peerTransportRegistryDomain,"profile":peerTransportRegistryProfile,"chainId":registry.ChainID,"GenesisDIRHash":strings.ToLower(registry.GenesisDIRHash),"protocolVersion":registry.ProtocolVersion,"height":height,"members":members})
}

func peerPayloadHash(payload json.RawMessage)(string,error){
	var value any
	if len(payload)==0{return "",errors.New("peer envelope payload is required")}
	if err:=json.Unmarshal(payload,&value);err!=nil{return "",fmt.Errorf("parse peer payload: %w",err)}
	return canonicalHashValue(value)
}

func peerEnvelopeMessageHash(e PeerEnvelope)(string,error){
	if !readOnlyPeerMessageTypes[e.MessageType]{return "",fmt.Errorf("peer message type %s is not allowed by read-only transport profile",e.MessageType)}
	return canonicalHashValue(map[string]any{
		"domain":peerTransportEnvelopeDomain,"profileVersion":peerTransportProfile,"chainId":e.ChainID,"networkName":e.NetworkName,
		"GenesisDIRHash":strings.ToLower(e.GenesisDIRHash),"protocolVersion":e.ProtocolVersion,"senderValidatorId":e.SenderValidatorID,
		"senderKeyId":e.SenderKeyID,"sequence":e.Sequence,"nonce":e.Nonce,"issuedAt":e.IssuedAt,"expiresAt":e.ExpiresAt,
		"messageType":e.MessageType,"payloadHash":e.PayloadHash,
	})
}

func verifyPeerEnvelope(registry PeerTransportRegistry,e PeerEnvelope,height int64,expectedRegistryRoot string,now time.Time,maxClockSkew time.Duration)(PeerEnvelopeVerification,error){
	if e.ProfileVersion!=peerTransportProfile||e.Domain!=peerTransportEnvelopeDomain{return PeerEnvelopeVerification{},errors.New("unsupported peer transport profile")}
	if e.ChainID!=registry.ChainID{return PeerEnvelopeVerification{},errors.New("peer envelope chainId mismatch")}
	if !strings.EqualFold(e.GenesisDIRHash,registry.GenesisDIRHash){return PeerEnvelopeVerification{},errors.New("peer envelope Genesis DIR mismatch")}
	if e.ProtocolVersion!=registry.ProtocolVersion{return PeerEnvelopeVerification{},errors.New("peer envelope protocolVersion mismatch")}
	if e.NetworkName==""||e.SenderValidatorID==""||e.SenderKeyID==""||e.Nonce==""||e.Sequence==0{return PeerEnvelopeVerification{},errors.New("peer envelope missing required identity/replay fields")}
	if !readOnlyPeerMessageTypes[e.MessageType]{return PeerEnvelopeVerification{},errors.New("peer transport profile is read-only and rejects consensus-bearing message types")}
	issued,err:=time.Parse(time.RFC3339Nano,e.IssuedAt);if err!=nil{return PeerEnvelopeVerification{},errors.New("invalid peer envelope issuedAt")}
	expires,err:=time.Parse(time.RFC3339Nano,e.ExpiresAt);if err!=nil{return PeerEnvelopeVerification{},errors.New("invalid peer envelope expiresAt")}
	now=now.UTC();issued=issued.UTC();expires=expires.UTC()
	if expires.Before(issued)||expires.Equal(issued){return PeerEnvelopeVerification{},errors.New("peer envelope expiresAt must follow issuedAt")}
	if issued.After(now.Add(maxClockSkew)){return PeerEnvelopeVerification{},errors.New("peer envelope issuedAt is too far in the future")}
	if now.After(expires.Add(maxClockSkew)){return PeerEnvelopeVerification{},errors.New("peer envelope is stale or expired")}
	root,err:=peerRegistryRootAtHeight(registry,height);if err!=nil{return PeerEnvelopeVerification{},err};if root!=expectedRegistryRoot{return PeerEnvelopeVerification{},errors.New("trusted peer registry root mismatch")}
	key,err:=activePeerTransportKey(registry,e.SenderValidatorID,height);if err!=nil{return PeerEnvelopeVerification{},err};if e.SenderKeyID!=key.KeyID{return PeerEnvelopeVerification{},errors.New("peer envelope transport keyId mismatch")}
	payloadHash,err:=peerPayloadHash(e.Payload);if err!=nil{return PeerEnvelopeVerification{},err};if payloadHash!=e.PayloadHash{return PeerEnvelopeVerification{},errors.New("peer envelope payload hash mismatch")}
	msg,err:=peerEnvelopeMessageHash(e);if err!=nil{return PeerEnvelopeVerification{},err};if msg!=e.MessageHash{return PeerEnvelopeVerification{},errors.New("peer envelope messageHash mismatch")}
	der,err:=base64.StdEncoding.DecodeString(key.PublicKeyDerB64);if err!=nil{return PeerEnvelopeVerification{},err};parsed,err:=x509.ParsePKIXPublicKey(der);if err!=nil{return PeerEnvelopeVerification{},err};pub,ok:=parsed.(ed25519.PublicKey);if !ok{return PeerEnvelopeVerification{},errors.New("peer TRANSPORT key is not Ed25519")}
	sig,err:=base64.StdEncoding.DecodeString(e.SignatureB64);if err!=nil{return PeerEnvelopeVerification{},errors.New("invalid peer envelope signature encoding")};msgBytes,err:=hex.DecodeString(msg);if err!=nil{return PeerEnvelopeVerification{},err};if !ed25519.Verify(pub,msgBytes,sig){return PeerEnvelopeVerification{},errors.New("peer envelope signature verification failed")}
	return PeerEnvelopeVerification{true,peerTransportProfile,e.SenderValidatorID,e.MessageType,e.Sequence,msg,root,true},nil
}

func loadPeerReplayState(path,chainID string)(PeerReplayState,error){
	state:=PeerReplayState{peerTransportProfile,chainID,map[string]uint64{},map[string]string{},time.Now().UTC().Format(time.RFC3339Nano)}
	if path==""{return state,nil}
	if _,err:=os.Stat(path);os.IsNotExist(err){return state,nil}else if err!=nil{return state,err}
	if err:=readJSON(path,&state);err!=nil{return PeerReplayState{},err}
	if state.ProfileVersion!=peerTransportProfile||state.ChainID!=chainID{return PeerReplayState{},errors.New("peer replay state trust context mismatch")}
	if state.LastSequence==nil{state.LastSequence=map[string]uint64{}};if state.SeenNonces==nil{state.SeenNonces=map[string]string{}}
	return state,nil
}

func applyPeerReplayProtection(state *PeerReplayState,e PeerEnvelope)error{
	if last:=state.LastSequence[e.SenderValidatorID];e.Sequence<=last{return fmt.Errorf("peer envelope replay/rollback: sequence %d is not greater than durable watermark %d",e.Sequence,last)}
	key:=e.SenderValidatorID+":"+e.Nonce;if _,exists:=state.SeenNonces[key];exists{return errors.New("peer envelope nonce replay detected")}
	state.LastSequence[e.SenderValidatorID]=e.Sequence;state.SeenNonces[key]=e.ExpiresAt;state.UpdatedAt=time.Now().UTC().Format(time.RFC3339Nano)
	return nil
}

func prunePeerReplayState(state *PeerReplayState,now time.Time){
	for key,expires:=range state.SeenNonces{t,err:=time.Parse(time.RFC3339Nano,expires);if err!=nil||now.UTC().After(t.UTC()){delete(state.SeenNonces,key)}}
}
