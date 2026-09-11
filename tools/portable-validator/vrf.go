package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sort"
)

const (
	poviProposerProfile       = "STRATUM-POVI-PROPOSER/1"
	poviProposerSelectDomain  = "STRATUM/POVI/PROPOSER_SELECTION/1"
	poviVRFEvidenceDomain     = "STRATUM/POVI/VRF_EVIDENCE/1"
	poviVRFRegistryProfile    = "STRATUM-VRF-KEY-REGISTRY/1"
	poviVRFRegistryRootDomain = "STRATUM/VRF_KEY_REGISTRY/1"
)

type VRFKey struct {
	KeyID            string `json:"keyId"`
	Purpose          string `json:"purpose"`
	Algorithm        string `json:"algorithm"`
	PublicKeyDerB64  string `json:"publicKeyDerB64"`
	ActiveFromHeight int64  `json:"activeFromHeight"`
	RetiredAtHeight  *int64 `json:"retiredAtHeight"`
}

type VRFValidatorKeyHistory struct {
	ValidatorID string   `json:"validatorId"`
	Keys        []VRFKey `json:"keys"`
}

type VRFKeyRegistry struct {
	RegistryVersion string                   `json:"registryVersion"`
	ChainID         string                   `json:"chainId"`
	Validators      []VRFValidatorKeyHistory `json:"validators"`
}

type ProposerSelectionContext struct {
	ProfileVersion     string `json:"profileVersion"`
	ChainID            string `json:"chainId"`
	Height             int64  `json:"height"`
	Round              int64  `json:"round"`
	PreviousDIRHash    string `json:"previousDIRHash"`
	PreviousEntropy    string `json:"previousEntropy"`
	ValidatorSetRoot   string `json:"validatorSetRoot"`
	VRFKeyRegistryRoot string `json:"vrfKeyRegistryRoot"`
	ProtocolVersion    string `json:"protocolVersion"`
}

type ProposerEntropyEvidence struct {
	ProfileVersion     string `json:"profileVersion"`
	Domain             string `json:"domain"`
	ChainID            string `json:"chainId"`
	Height             int64  `json:"height"`
	Round              int64  `json:"round"`
	PreviousDIRHash    string `json:"previousDIRHash"`
	PreviousEntropy    string `json:"previousEntropy"`
	ValidatorSetRoot   string `json:"validatorSetRoot"`
	VRFKeyRegistryRoot string `json:"vrfKeyRegistryRoot"`
	ProtocolVersion    string `json:"protocolVersion"`
	ProposerID         string `json:"proposerId"`
	KeyID              string `json:"keyId"`
	SelectionSeed      string `json:"selectionSeed"`
	MessageHash        string `json:"messageHash"`
	ProofB64           string `json:"proofB64"`
	VRFOutput          string `json:"vrfOutput"`
}

type ProposerSelection struct {
	SelectionSeed      string   `json:"selectionSeed"`
	ProposerID         string   `json:"proposerId"`
	ProposerIndex      int      `json:"proposerIndex"`
	ActiveValidatorIDs []string `json:"activeValidatorIds"`
}

type ProposerEntropyVerification struct {
	Valid              bool   `json:"valid"`
	ProfileVersion     string `json:"profileVersion"`
	ChainID            string `json:"chainId"`
	Height             int64  `json:"height"`
	Round              int64  `json:"round"`
	ProposerID         string `json:"proposerId"`
	SelectionSeed      string `json:"selectionSeed"`
	VRFOutput          string `json:"vrfOutput"`
	ValidatorSetRoot   string `json:"validatorSetRoot"`
	VRFKeyRegistryRoot string `json:"vrfKeyRegistryRoot"`
	KeyID              string `json:"keyId"`
}

func vrfKeyActiveAtHeight(key VRFKey, height int64) bool {
	return key.ActiveFromHeight <= height && (key.RetiredAtHeight == nil || *key.RetiredAtHeight > height)
}

func activeVRFKeyPortable(registry VRFKeyRegistry, validatorID string, height int64) (VRFKey, error) {
	for _, validator := range registry.Validators {
		if validator.ValidatorID != validatorID { continue }
		var active []VRFKey
		for _, key := range validator.Keys { if vrfKeyActiveAtHeight(key, height) { active = append(active, key) } }
		if len(active) != 1 { return VRFKey{}, fmt.Errorf("validator %s must have exactly one active VRF key at height %d; found %d", validatorID, height, len(active)) }
		key := active[0]
		if key.Purpose != "VRF" || key.Algorithm != "Ed25519-Deterministic-Entropy-v1" { return VRFKey{}, fmt.Errorf("validator %s has unsupported VRF key profile", validatorID) }
		return key, nil
	}
	return VRFKey{}, fmt.Errorf("missing VRF key history for validator %s", validatorID)
}

func vrfKeyRegistryRootPortable(registry VRFKeyRegistry, height int64) (string, error) {
	if registry.RegistryVersion != poviVRFRegistryProfile { return "", errors.New("unsupported VRF key registry profile") }
	if registry.ChainID == "" || height < 0 { return "", errors.New("invalid VRF key registry context") }
	validators := make([]map[string]any, 0, len(registry.Validators))
	seen := map[string]bool{}
	for _, item := range registry.Validators {
		if item.ValidatorID == "" || seen[item.ValidatorID] { return "", errors.New("VRF key registry validator IDs must be unique and non-empty") }
		seen[item.ValidatorID] = true
		key, err := activeVRFKeyPortable(registry, item.ValidatorID, height); if err != nil { return "", err }
		validators = append(validators, map[string]any{"validatorId":item.ValidatorID,"keyId":key.KeyID,"algorithm":key.Algorithm,"publicKeyDerB64":key.PublicKeyDerB64})
	}
	sort.Slice(validators, func(i,j int) bool { return validators[i]["validatorId"].(string) < validators[j]["validatorId"].(string) })
	return canonicalHashValue(map[string]any{"domain":poviVRFRegistryRootDomain,"profile":poviVRFRegistryProfile,"chainId":registry.ChainID,"height":height,"validators":validators})
}

func proposerSelectionSeedPortable(context ProposerSelectionContext) (string, error) {
	if context.ProfileVersion != poviProposerProfile { return "", errors.New("unsupported proposer profile") }
	if context.Height < 1 || context.Round < 0 || !isSHA256(context.PreviousDIRHash) || !isSHA256(context.PreviousEntropy) || !isSHA256(context.ValidatorSetRoot) || !isSHA256(context.VRFKeyRegistryRoot) { return "", errors.New("invalid proposer-selection context") }
	return canonicalHashValue(map[string]any{"domain":poviProposerSelectDomain,"profileVersion":poviProposerProfile,"chainId":context.ChainID,"height":context.Height,"round":context.Round,"previousDIRHash":context.PreviousDIRHash,"previousEntropy":context.PreviousEntropy,"validatorSetRoot":context.ValidatorSetRoot,"vrfKeyRegistryRoot":context.VRFKeyRegistryRoot,"protocolVersion":context.ProtocolVersion})
}

func selectProposerPortable(set SnapshotValidatorSet, context ProposerSelectionContext) (ProposerSelection, error) {
	if set.ChainID != context.ChainID { return ProposerSelection{}, errors.New("proposer-selection chainId mismatch") }
	root, err := snapshotValidatorSetRoot(set, context.Height); if err != nil { return ProposerSelection{}, err }
	if root != context.ValidatorSetRoot { return ProposerSelection{}, fmt.Errorf("proposer-selection validator-set root mismatch: computed %s", root) }
	ids := make([]string,0,len(set.Members)); for _, member := range set.Members { if snapshotValidatorActive(member,context.Height) { ids=append(ids,member.ValidatorID) } }; sort.Strings(ids)
	if len(ids)<1 { return ProposerSelection{}, fmt.Errorf("no ACTIVE validators at height %d",context.Height) }
	seed, err := proposerSelectionSeedPortable(context); if err != nil { return ProposerSelection{}, err }
	seedInt := new(big.Int); if _, ok := seedInt.SetString(seed,16); !ok { return ProposerSelection{}, errors.New("invalid proposer selection seed") }
	idx := new(big.Int).Mod(seedInt,big.NewInt(int64(len(ids)))).Int64()
	return ProposerSelection{seed,ids[idx],int(idx),ids},nil
}

func proposerEntropyMessageHashPortable(e ProposerEntropyEvidence) (string,error) {
	return canonicalHashValue(map[string]any{"domain":poviVRFEvidenceDomain,"profileVersion":poviProposerProfile,"chainId":e.ChainID,"height":e.Height,"round":e.Round,"previousDIRHash":e.PreviousDIRHash,"previousEntropy":e.PreviousEntropy,"validatorSetRoot":e.ValidatorSetRoot,"vrfKeyRegistryRoot":e.VRFKeyRegistryRoot,"protocolVersion":e.ProtocolVersion,"proposerId":e.ProposerID,"keyId":e.KeyID,"selectionSeed":e.SelectionSeed})
}

func verifyProposerEntropyPortable(set SnapshotValidatorSet, registry VRFKeyRegistry, e ProposerEntropyEvidence, expectedValidatorRoot, expectedVRFRoot, expectedProtocol string) (ProposerEntropyVerification,error) {
	if e.ProfileVersion!=poviProposerProfile||e.Domain!=poviVRFEvidenceDomain { return ProposerEntropyVerification{},errors.New("unsupported proposer entropy profile") }
	if set.ChainID!=e.ChainID||registry.ChainID!=e.ChainID { return ProposerEntropyVerification{},errors.New("proposer entropy chainId mismatch") }
	if expectedProtocol!=""&&e.ProtocolVersion!=expectedProtocol { return ProposerEntropyVerification{},errors.New("proposer entropy protocolVersion mismatch") }
	root,err:=snapshotValidatorSetRoot(set,e.Height);if err!=nil{return ProposerEntropyVerification{},err};if root!=expectedValidatorRoot||e.ValidatorSetRoot!=root{return ProposerEntropyVerification{},errors.New("proposer entropy validator-set root mismatch")}
	vrfRoot,err:=vrfKeyRegistryRootPortable(registry,e.Height);if err!=nil{return ProposerEntropyVerification{},err};if vrfRoot!=expectedVRFRoot||e.VRFKeyRegistryRoot!=vrfRoot{return ProposerEntropyVerification{},errors.New("proposer entropy VRF-key registry root mismatch")}
	activeIDs:=[]string{};for _,m:=range set.Members{if snapshotValidatorActive(m,e.Height){activeIDs=append(activeIDs,m.ValidatorID)}};sort.Strings(activeIDs)
	registryIDs:=make([]string,0,len(registry.Validators));for _,v:=range registry.Validators{registryIDs=append(registryIDs,v.ValidatorID)};sort.Strings(registryIDs)
	if len(activeIDs)!=len(registryIDs){return ProposerEntropyVerification{},errors.New("VRF-key registry must cover exactly the ACTIVE validator set")};for i:=range activeIDs{if activeIDs[i]!=registryIDs[i]{return ProposerEntropyVerification{},errors.New("VRF-key registry must cover exactly the ACTIVE validator set")}}
	context:=ProposerSelectionContext{poviProposerProfile,e.ChainID,e.Height,e.Round,e.PreviousDIRHash,e.PreviousEntropy,e.ValidatorSetRoot,e.VRFKeyRegistryRoot,e.ProtocolVersion}
	selected,err:=selectProposerPortable(set,context);if err!=nil{return ProposerEntropyVerification{},err};if e.SelectionSeed!=selected.SelectionSeed{return ProposerEntropyVerification{},errors.New("proposer entropy selectionSeed mismatch")};if e.ProposerID!=selected.ProposerID{return ProposerEntropyVerification{},fmt.Errorf("wrong proposer: expected %s, got %s",selected.ProposerID,e.ProposerID)}
	key,err:=activeVRFKeyPortable(registry,e.ProposerID,e.Height);if err!=nil{return ProposerEntropyVerification{},err};if e.KeyID!=key.KeyID{return ProposerEntropyVerification{},errors.New("proposer entropy keyId mismatch")}
	msg,err:=proposerEntropyMessageHashPortable(e);if err!=nil{return ProposerEntropyVerification{},err};if e.MessageHash!=msg{return ProposerEntropyVerification{},errors.New("proposer entropy messageHash mismatch")}
	der,err:=base64.StdEncoding.DecodeString(key.PublicKeyDerB64);if err!=nil{return ProposerEntropyVerification{},err};parsed,err:=x509.ParsePKIXPublicKey(der);if err!=nil{return ProposerEntropyVerification{},err};pub,ok:=parsed.(ed25519.PublicKey);if !ok{return ProposerEntropyVerification{},errors.New("VRF profile requires Ed25519 key material")}
	proof,err:=base64.StdEncoding.DecodeString(e.ProofB64);if err!=nil{return ProposerEntropyVerification{},errors.New("invalid proposer entropy proof encoding")};messageBytes,err:=hex.DecodeString(msg);if err!=nil{return ProposerEntropyVerification{},err};if !ed25519.Verify(pub,messageBytes,proof){return ProposerEntropyVerification{},errors.New("proposer entropy proof signature verification failed")}
	digest:=sha256.Sum256(proof);output:=hex.EncodeToString(digest[:]);if e.VRFOutput!=output{return ProposerEntropyVerification{},errors.New("proposer entropy output mismatch")}
	return ProposerEntropyVerification{true,poviProposerProfile,e.ChainID,e.Height,e.Round,e.ProposerID,e.SelectionSeed,output,root,vrfRoot,key.KeyID},nil
}
