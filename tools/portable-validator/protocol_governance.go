package main

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
)

const (
	protocolGovernanceProfile      = "STRATUM-PROTOCOL-GOVERNANCE/1"
	protocolChangeVersion          = "STRATUM-PROTOCOL-CHANGE/1"
	protocolChangeDomain           = "STRATUM/PROTOCOL_CHANGE/1"
	protocolChangeManifestVersion  = "STRATUM-PROTOCOL-CHANGE-MANIFEST/1"
	protocolStateProfile           = "STRATUM-PROTOCOL-STATE/1"
)

type ProtocolGovernanceMember struct {
	AuthorityMemberID string `json:"authorityMemberId"`
	KeyID             string `json:"keyId"`
	Purpose           string `json:"purpose"`
	Algorithm         string `json:"algorithm"`
	PublicKeyDerB64   string `json:"publicKeyDerB64"`
	State             string `json:"state"`
	ValidFromHeight   int64  `json:"validFromHeight"`
	ValidUntilHeight  *int64 `json:"validUntilHeight"`
}

type ProtocolGovernancePolicy struct {
	Profile              string                     `json:"profile"`
	ChainID              string                     `json:"chainId"`
	AuthorityID          string                     `json:"authorityId"`
	AuthorityType        string                     `json:"authorityType"`
	OrganizationID       string                     `json:"organizationId"`
	Jurisdiction         *string                    `json:"jurisdiction"`
	Scope                []string                   `json:"scope"`
	VotingPolicy         string                     `json:"votingPolicy"`
	ThresholdClass       string                     `json:"thresholdClass"`
	Threshold            int                        `json:"threshold"`
	EffectiveFromHeight  int64                      `json:"effectiveFromHeight"`
	EffectiveUntilHeight *int64                     `json:"effectiveUntilHeight"`
	Status               string                     `json:"status"`
	Members              []ProtocolGovernanceMember `json:"members"`
}

type ProtocolState struct {
	Profile                string `json:"profile"`
	ChainID                string `json:"chainId"`
	ProtocolVersion        string `json:"protocolVersion"`
	CanonicalSchemaVersion string `json:"canonicalSchemaVersion"`
	ConsensusRulesHash     string `json:"consensusRulesHash"`
	ResourcePolicyHash     string `json:"resourcePolicyHash"`
	ModuleRegistryHash     string `json:"moduleRegistryHash"`
	ActiveFromHeight       int64  `json:"activeFromHeight"`
}

type ProtocolChangeManifest struct {
	ManifestVersion          string `json:"manifestVersion"`
	ChainID                  string `json:"chainId"`
	FromProtocolVersion      string `json:"fromProtocolVersion"`
	ToProtocolVersion        string `json:"toProtocolVersion"`
	RationaleHash            string `json:"rationaleHash"`
	SecurityImpactHash       string `json:"securityImpactHash"`
	CompatibilityImpactHash  string `json:"compatibilityImpactHash"`
	MigrationPlanHash        string `json:"migrationPlanHash"`
	TestEvidenceRoot         string `json:"testEvidenceRoot"`
	MinimumValidatorVersion  string `json:"minimumValidatorVersion"`
	ResourceProfileHash      string `json:"resourceProfileHash"`
}

type ProtocolChangeAction struct {
	Domain                    string `json:"domain"`
	ActionVersion             string `json:"actionVersion"`
	ChainID                   string `json:"chainId"`
	ActionID                  string `json:"actionId"`
	FromProtocolVersion       string `json:"fromProtocolVersion"`
	ToProtocolVersion         string `json:"toProtocolVersion"`
	ApprovedAtHeight          int64  `json:"approvedAtHeight"`
	ActivationHeight          int64  `json:"activationHeight"`
	PreviousProtocolStateHash string `json:"previousProtocolStateHash"`
	NextProtocolStateHash     string `json:"nextProtocolStateHash"`
	GovernancePolicyHash      string `json:"governancePolicyHash"`
	ChangeHash                string `json:"changeHash"`
}

type ProtocolChangeSignature struct {
	AuthorityMemberID string `json:"authorityMemberId"`
	KeyID             string `json:"keyId"`
	Algorithm         string `json:"algorithm"`
	Domain            string `json:"domain"`
	SignatureB64      string `json:"signatureB64"`
}

type ProtocolChangeProof struct {
	Action                ProtocolChangeAction      `json:"action"`
	GovernancePolicy      ProtocolGovernancePolicy  `json:"governancePolicy"`
	ChangeManifest        ProtocolChangeManifest    `json:"changeManifest"`
	PreviousProtocolState ProtocolState             `json:"previousProtocolState"`
	NextProtocolState     ProtocolState             `json:"nextProtocolState"`
	Signatures            []ProtocolChangeSignature `json:"signatures"`
}

type ProtocolChangeVerification struct {
	Valid                     bool     `json:"valid"`
	ActionID                  string   `json:"actionId"`
	ApprovedAtHeight          int64    `json:"approvedAtHeight"`
	ActivationHeight          int64    `json:"activationHeight"`
	FromProtocolVersion       string   `json:"fromProtocolVersion"`
	ToProtocolVersion         string   `json:"toProtocolVersion"`
	GovernancePolicyHash      string   `json:"governancePolicyHash"`
	ChangeHash                string   `json:"changeHash"`
	PreviousProtocolStateHash string   `json:"previousProtocolStateHash"`
	NextProtocolStateHash     string   `json:"nextProtocolStateHash"`
	EligibleAuthorityCount    int      `json:"eligibleAuthorityCount"`
	RequiredAuthority         int      `json:"requiredAuthority"`
	ValidSigners              []string `json:"validSigners"`
}

func protocolGovernanceMemberEligibleAtHeight(member ProtocolGovernanceMember,height int64)bool{return member.State=="ACTIVE"&&member.ValidFromHeight<=height&&(member.ValidUntilHeight==nil||*member.ValidUntilHeight>height)}

func canonicalProtocolGovernancePolicyHash(policy ProtocolGovernancePolicy)(string,error){
	copyPolicy:=policy;copyPolicy.Scope=append([]string(nil),policy.Scope...);sort.Strings(copyPolicy.Scope);copyPolicy.Members=append([]ProtocolGovernanceMember(nil),policy.Members...)
	sort.Slice(copyPolicy.Members,func(i,j int)bool{if copyPolicy.Members[i].AuthorityMemberID==copyPolicy.Members[j].AuthorityMemberID{return copyPolicy.Members[i].KeyID<copyPolicy.Members[j].KeyID};return copyPolicy.Members[i].AuthorityMemberID<copyPolicy.Members[j].AuthorityMemberID})
	return canonicalHashValue(copyPolicy)
}

func requiredProtocolAuthority(policy ProtocolGovernancePolicy,n int)(int,error){
	if n<1{return 0,errors.New("protocol governance requires at least one eligible authority member")}
	floor:=1
	switch policy.ThresholdClass{case "DUAL","MULTI_PARTY_HIGH_ASSURANCE":floor=2;case "MAJORITY":floor=n/2+1;case "SUPERMAJORITY":floor=(2*n)/3+1;case "SIMPLE":default:return 0,fmt.Errorf("unsupported protocol threshold class %s",policy.ThresholdClass)}
	if policy.Threshold>floor{floor=policy.Threshold};return floor,nil
}

func protocolPolicyHasScope(policy ProtocolGovernancePolicy,scope string)bool{for _,candidate:=range policy.Scope{if candidate==scope{return true}};return false}

func verifyProtocolChangeProof(proof ProtocolChangeProof,expectedChainID,expectedGovernancePolicyHash,expectedPreviousProtocolStateHash string)(ProtocolChangeVerification,error){
	action:=proof.Action;policy:=proof.GovernancePolicy;manifest:=proof.ChangeManifest;previous:=proof.PreviousProtocolState;next:=proof.NextProtocolState
	if action.Domain!=protocolChangeDomain||action.ActionVersion!=protocolChangeVersion{return ProtocolChangeVerification{},errors.New("unsupported protocol-change domain/version")}
	if policy.Profile!=protocolGovernanceProfile||policy.AuthorityType!="PROTOCOL"||policy.VotingPolicy!="THRESHOLD"{return ProtocolChangeVerification{},errors.New("unsupported PROTOCOL governance policy profile")}
	if manifest.ManifestVersion!=protocolChangeManifestVersion||previous.Profile!=protocolStateProfile||next.Profile!=protocolStateProfile{return ProtocolChangeVerification{},errors.New("unsupported protocol manifest/state profile")}
	if action.ChainID!=expectedChainID||policy.ChainID!=expectedChainID||manifest.ChainID!=expectedChainID||previous.ChainID!=expectedChainID||next.ChainID!=expectedChainID{return ProtocolChangeVerification{},errors.New("protocol governance chainId mismatch")}
	if action.ActivationHeight<=action.ApprovedAtHeight{return ProtocolChangeVerification{},errors.New("consensus-affecting protocol change must activate after approval height")}
	if policy.Status!="ACTIVE"||policy.EffectiveFromHeight>action.ApprovedAtHeight||(policy.EffectiveUntilHeight!=nil&&*policy.EffectiveUntilHeight<=action.ApprovedAtHeight){return ProtocolChangeVerification{},errors.New("PROTOCOL governance policy was not ACTIVE at approval height")}
	policyHash,err:=canonicalProtocolGovernancePolicyHash(policy);if err!=nil{return ProtocolChangeVerification{},err};if policyHash!=expectedGovernancePolicyHash||action.GovernancePolicyHash!=policyHash{return ProtocolChangeVerification{},errors.New("protocol governance policy hash does not match independently trusted policy")}
	if action.FromProtocolVersion!=previous.ProtocolVersion||action.ToProtocolVersion!=next.ProtocolVersion||manifest.FromProtocolVersion!=previous.ProtocolVersion||manifest.ToProtocolVersion!=next.ProtocolVersion{return ProtocolChangeVerification{},errors.New("protocol version transition is not consistently bound")}
	if previous.ProtocolVersion==next.ProtocolVersion{return ProtocolChangeVerification{},errors.New("protocol activation does not change protocolVersion")}
	if previous.ActiveFromHeight>action.ActivationHeight-1{return ProtocolChangeVerification{},errors.New("previous protocol state was not active before transition height")}
	if next.ActiveFromHeight!=action.ActivationHeight{return ProtocolChangeVerification{},errors.New("next protocol state must activate exactly at governed activationHeight")}
	previousHash,err:=canonicalHashValue(previous);if err!=nil{return ProtocolChangeVerification{},err};nextHash,err:=canonicalHashValue(next);if err!=nil{return ProtocolChangeVerification{},err}
	if previousHash!=expectedPreviousProtocolStateHash||action.PreviousProtocolStateHash!=previousHash{return ProtocolChangeVerification{},errors.New("previous protocol state hash does not match independently trusted state")};if action.NextProtocolStateHash!=nextHash{return ProtocolChangeVerification{},errors.New("next protocol state hash mismatch")}
	changeHash,err:=canonicalHashValue(manifest);if err!=nil{return ProtocolChangeVerification{},err};if action.ChangeHash!=changeHash{return ProtocolChangeVerification{},errors.New("protocol change manifest hash mismatch")}
	if !protocolPolicyHasScope(policy,"PROTOCOL_VERSION"){return ProtocolChangeVerification{},errors.New("protocol governance policy lacks PROTOCOL_VERSION authority")};if previous.ConsensusRulesHash!=next.ConsensusRulesHash&&!protocolPolicyHasScope(policy,"CONSENSUS_RULES"){return ProtocolChangeVerification{},errors.New("protocol governance policy lacks CONSENSUS_RULES authority")};if previous.CanonicalSchemaVersion!=next.CanonicalSchemaVersion&&!protocolPolicyHasScope(policy,"CANONICAL_SCHEMA"){return ProtocolChangeVerification{},errors.New("protocol governance policy lacks CANONICAL_SCHEMA authority")};if previous.ResourcePolicyHash!=next.ResourcePolicyHash&&!protocolPolicyHasScope(policy,"RESOURCE_POLICY"){return ProtocolChangeVerification{},errors.New("protocol governance policy lacks RESOURCE_POLICY authority")}
	for label,value:=range map[string]string{"governancePolicyHash":action.GovernancePolicyHash,"changeHash":action.ChangeHash,"previousProtocolStateHash":action.PreviousProtocolStateHash,"nextProtocolStateHash":action.NextProtocolStateHash,"rationaleHash":manifest.RationaleHash,"securityImpactHash":manifest.SecurityImpactHash,"compatibilityImpactHash":manifest.CompatibilityImpactHash,"migrationPlanHash":manifest.MigrationPlanHash,"testEvidenceRoot":manifest.TestEvidenceRoot,"resourceProfileHash":manifest.ResourceProfileHash,"consensusRulesHash":next.ConsensusRulesHash,"resourcePolicyHash":next.ResourcePolicyHash,"moduleRegistryHash":next.ModuleRegistryHash}{if !isSHA256(value){return ProtocolChangeVerification{},fmt.Errorf("%s must be lowercase SHA-256",label)}}
	eligible:=map[string]ProtocolGovernanceMember{};for _,member:=range policy.Members{if protocolGovernanceMemberEligibleAtHeight(member,action.ApprovedAtHeight){if _,exists:=eligible[member.AuthorityMemberID];exists{return ProtocolChangeVerification{},fmt.Errorf("duplicate protocol authority member %s",member.AuthorityMemberID)};eligible[member.AuthorityMemberID]=member}}
	required,err:=requiredProtocolAuthority(policy,len(eligible));if err!=nil{return ProtocolChangeVerification{},err};if required>len(eligible){return ProtocolChangeVerification{},fmt.Errorf("protocol governance threshold %d exceeds %d eligible authority members",required,len(eligible))}
	normalizedAction,err:=canonicalValue(action);if err!=nil{return ProtocolChangeVerification{},err};canonicalAction,err:=canonicalJSON(normalizedAction);if err!=nil{return ProtocolChangeVerification{},err};payload:=[]byte(canonicalAction)
	valid:=map[string]bool{};for _,sig:=range proof.Signatures{if valid[sig.AuthorityMemberID]{continue};member,ok:=eligible[sig.AuthorityMemberID];if !ok||sig.KeyID!=member.KeyID||sig.Algorithm!="Ed25519"||sig.Domain!=protocolChangeDomain{continue};der,err:=base64.StdEncoding.DecodeString(member.PublicKeyDerB64);if err!=nil{continue};parsed,err:=x509.ParsePKIXPublicKey(der);if err!=nil{continue};pub,ok:=parsed.(ed25519.PublicKey);if !ok{continue};signature,err:=base64.StdEncoding.DecodeString(sig.SignatureB64);if err!=nil{continue};if ed25519.Verify(pub,payload,signature){valid[sig.AuthorityMemberID]=true}}
	validSigners:=make([]string,0,len(valid));for signer:=range valid{validSigners=append(validSigners,signer)};sort.Strings(validSigners);if len(validSigners)<required{return ProtocolChangeVerification{},fmt.Errorf("protocol governance threshold not met: %d/%d; %d required",len(validSigners),len(eligible),required)}
	return ProtocolChangeVerification{true,action.ActionID,action.ApprovedAtHeight,action.ActivationHeight,previous.ProtocolVersion,next.ProtocolVersion,policyHash,changeHash,previousHash,nextHash,len(eligible),required,validSigners},nil
}
