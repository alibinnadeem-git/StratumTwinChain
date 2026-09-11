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
	validatorGovernanceProfile = "STRATUM-VALIDATOR-GOVERNANCE/1"
	validatorSetChangeVersion  = "STRATUM-VALIDATOR-SET-CHANGE/1"
	validatorSetChangeDomain   = "STRATUM/VALIDATOR_SET_CHANGE/1"
	validatorSetStateProfile   = "STRATUM-VALIDATOR-SET-STATE/1"
	validatorSetStateDomain    = "STRATUM/VALIDATOR_SET_STATE/1"
	validatorSubjectDomain     = "STRATUM/VALIDATOR/SUBJECT/1"
)

type ValidatorGovernanceMember struct {
	AuthorityMemberID string `json:"authorityMemberId"`
	KeyID             string `json:"keyId"`
	Purpose           string `json:"purpose"`
	Algorithm         string `json:"algorithm"`
	PublicKeyDerB64   string `json:"publicKeyDerB64"`
	State             string `json:"state"`
	ValidFromHeight   int64  `json:"validFromHeight"`
	ValidUntilHeight  *int64 `json:"validUntilHeight"`
}

type ValidatorGovernancePolicy struct {
	Profile              string                      `json:"profile"`
	ChainID              string                      `json:"chainId"`
	AuthorityID          string                      `json:"authorityId"`
	AuthorityType        string                      `json:"authorityType"`
	OrganizationID       string                      `json:"organizationId"`
	Jurisdiction         *string                     `json:"jurisdiction"`
	Scope                []string                    `json:"scope"`
	VotingPolicy         string                      `json:"votingPolicy"`
	Threshold            int                         `json:"threshold"`
	EffectiveFromHeight  int64                       `json:"effectiveFromHeight"`
	EffectiveUntilHeight *int64                      `json:"effectiveUntilHeight"`
	Status               string                      `json:"status"`
	Members              []ValidatorGovernanceMember `json:"members"`
}

type ValidatorSetChangeAction struct {
	Domain                   string `json:"domain"`
	ActionVersion            string `json:"actionVersion"`
	ChainID                  string `json:"chainId"`
	ActionID                 string `json:"actionId"`
	ActionType               string `json:"actionType"`
	ValidatorID              string `json:"validatorId"`
	ApprovedAtHeight         int64  `json:"approvedAtHeight"`
	EffectiveHeight          int64  `json:"effectiveHeight"`
	PreviousValidatorSetRoot string `json:"previousValidatorSetRoot"`
	NextValidatorSetRoot     string `json:"nextValidatorSetRoot"`
	PreviousValidatorSetHash string `json:"previousValidatorSetHash"`
	NextValidatorSetHash     string `json:"nextValidatorSetHash"`
	SubjectIdentityHash      string `json:"subjectIdentityHash"`
	GovernancePolicyHash     string `json:"governancePolicyHash"`
	ReasonHash               string `json:"reasonHash"`
}

type ValidatorSetChangeSignature struct {
	AuthorityMemberID string `json:"authorityMemberId"`
	KeyID             string `json:"keyId"`
	Algorithm         string `json:"algorithm"`
	Domain            string `json:"domain"`
	SignatureB64      string `json:"signatureB64"`
}

type ValidatorSetChangeProof struct {
	Action               ValidatorSetChangeAction      `json:"action"`
	GovernancePolicy     ValidatorGovernancePolicy     `json:"governancePolicy"`
	PreviousValidatorSet SnapshotValidatorSet          `json:"previousValidatorSet"`
	NextValidatorSet     SnapshotValidatorSet          `json:"nextValidatorSet"`
	Signatures           []ValidatorSetChangeSignature `json:"signatures"`
}

type ValidatorSetChangeVerification struct {
	Valid                    bool     `json:"valid"`
	ActionID                 string   `json:"actionId"`
	ActionType               string   `json:"actionType"`
	ValidatorID              string   `json:"validatorId"`
	ApprovedAtHeight         int64    `json:"approvedAtHeight"`
	EffectiveHeight          int64    `json:"effectiveHeight"`
	GovernancePolicyHash     string   `json:"governancePolicyHash"`
	PreviousValidatorSetRoot string   `json:"previousValidatorSetRoot"`
	NextValidatorSetRoot     string   `json:"nextValidatorSetRoot"`
	PreviousValidatorSetHash string   `json:"previousValidatorSetHash"`
	NextValidatorSetHash     string   `json:"nextValidatorSetHash"`
	EligibleAuthorityCount   int      `json:"eligibleAuthorityCount"`
	RequiredAuthority        int      `json:"requiredAuthority"`
	ValidSigners             []string `json:"validSigners"`
}

func governanceMemberEligibleAtHeight(member ValidatorGovernanceMember, height int64) bool {
	return member.State == "ACTIVE" && member.ValidFromHeight <= height && (member.ValidUntilHeight == nil || *member.ValidUntilHeight > height)
}

func requiredGovernanceSupermajority(n int) (int, error) {
	if n < 1 {
		return 0, errors.New("validator governance requires at least one eligible authority member")
	}
	return (2*n)/3 + 1, nil
}

func canonicalGovernancePolicyHash(policy ValidatorGovernancePolicy) (string, error) {
	copyPolicy := policy
	copyPolicy.Scope = append([]string(nil), policy.Scope...)
	sort.Strings(copyPolicy.Scope)
	copyPolicy.Members = append([]ValidatorGovernanceMember(nil), policy.Members...)
	sort.Slice(copyPolicy.Members, func(i, j int) bool {
		if copyPolicy.Members[i].AuthorityMemberID == copyPolicy.Members[j].AuthorityMemberID {
			return copyPolicy.Members[i].KeyID < copyPolicy.Members[j].KeyID
		}
		return copyPolicy.Members[i].AuthorityMemberID < copyPolicy.Members[j].AuthorityMemberID
	})
	return canonicalHashValue(copyPolicy)
}

func validatorSetStateHash(set SnapshotValidatorSet) (string, error) {
	members := append([]SnapshotValidator(nil), set.Members...)
	for i := range members {
		members[i].Keys = append([]SnapshotConsensusKey(nil), members[i].Keys...)
		sort.Slice(members[i].Keys, func(a, b int) bool { return members[i].Keys[a].KeyID < members[i].Keys[b].KeyID })
	}
	sort.Slice(members, func(i, j int) bool { return members[i].ValidatorID < members[j].ValidatorID })
	return canonicalHashValue(map[string]any{"domain": validatorSetStateDomain, "profile": validatorSetStateProfile, "setVersion": set.SetVersion, "chainId": set.ChainID, "members": members})
}

func validatorSubjectIdentityHash(member SnapshotValidator) (string, error) {
	return canonicalHashValue(map[string]any{"domain": validatorSubjectDomain, "validatorId": member.ValidatorID, "identityUuid": member.IdentityUUID, "operatorOrg": member.OperatorOrg})
}

func governanceRequiredScope(actionType string) string {
	if actionType == "ROTATE_CONSENSUS_KEY" {
		return "VALIDATOR_CONSENSUS_KEYS"
	}
	return "VALIDATOR_MEMBERSHIP"
}

func validatorMemberByID(set SnapshotValidatorSet, id string) (SnapshotValidator, bool) {
	for _, member := range set.Members {
		if member.ValidatorID == id {
			return member, true
		}
	}
	return SnapshotValidator{}, false
}

func sameValidatorIdentity(a, b SnapshotValidator) bool {
	return a.ValidatorID == b.ValidatorID && a.IdentityUUID == b.IdentityUUID && a.OperatorOrg == b.OperatorOrg
}

func assertOnlyGovernedTargetChanged(previous, next SnapshotValidatorSet, targetID string) error {
	all := map[string]bool{}
	for _, member := range previous.Members { all[member.ValidatorID] = true }
	for _, member := range next.Members { all[member.ValidatorID] = true }
	for id := range all {
		if id == targetID { continue }
		a, okA := validatorMemberByID(previous, id); b, okB := validatorMemberByID(next, id)
		if !okA || !okB { return fmt.Errorf("unrelated validator %s changed in validator-set action", id) }
		ha, err := canonicalHashValue(a); if err != nil { return err }
		hb, err := canonicalHashValue(b); if err != nil { return err }
		if ha != hb { return fmt.Errorf("unrelated validator %s changed in validator-set action", id) }
	}
	return nil
}

func assertGovernedMembershipTransition(proof ValidatorSetChangeProof) (SnapshotValidator, error) {
	action := proof.Action
	before, hasBefore := validatorMemberByID(proof.PreviousValidatorSet, action.ValidatorID)
	after, hasAfter := validatorMemberByID(proof.NextValidatorSet, action.ValidatorID)
	priorHeight := action.EffectiveHeight - 1
	if action.ActionType == "ACTIVATE" {
		if hasBefore { return SnapshotValidator{}, errors.New("ACTIVATE v1 requires target absent from previous canonical set") }
		if !hasAfter || after.ActivationHeight != action.EffectiveHeight || after.RetirementHeight != nil || !snapshotValidatorActive(after, action.EffectiveHeight) { return SnapshotValidator{}, errors.New("ACTIVATE does not produce ACTIVE target at effective height") }
		if _, err := activeSnapshotConsensusKey(after, action.EffectiveHeight); err != nil { return SnapshotValidator{}, err }
		return after, nil
	}
	if !hasBefore || !hasAfter { return SnapshotValidator{}, fmt.Errorf("%s requires target in both canonical set snapshots", action.ActionType) }
	if !sameValidatorIdentity(before, after) { return SnapshotValidator{}, errors.New("validator permanent identity changed across governed action") }
	switch action.ActionType {
	case "QUARANTINE", "RETIRE", "REVOKE":
		if !snapshotValidatorActive(before, priorHeight) { return SnapshotValidator{}, fmt.Errorf("%s target was not ACTIVE before effective height", action.ActionType) }
		if snapshotValidatorActive(after, action.EffectiveHeight) || after.RetirementHeight == nil || *after.RetirementHeight != action.EffectiveHeight { return SnapshotValidator{}, fmt.Errorf("%s does not remove target from ACTIVE set at effective height", action.ActionType) }
		return after, nil
	case "REINSTATE":
		if snapshotValidatorActive(before, priorHeight) { return SnapshotValidator{}, errors.New("REINSTATE target was already ACTIVE before effective height") }
		if after.ActivationHeight != action.EffectiveHeight || after.RetirementHeight != nil || !snapshotValidatorActive(after, action.EffectiveHeight) { return SnapshotValidator{}, errors.New("REINSTATE does not restore target at effective height") }
		if _, err := activeSnapshotConsensusKey(after, action.EffectiveHeight); err != nil { return SnapshotValidator{}, err }
		return after, nil
	default:
		return SnapshotValidator{}, fmt.Errorf("unsupported membership transition %s", action.ActionType)
	}
}

func assertGovernedConsensusKeyRotation(proof ValidatorSetChangeProof) (SnapshotValidator, error) {
	action := proof.Action
	before, okBefore := validatorMemberByID(proof.PreviousValidatorSet, action.ValidatorID)
	after, okAfter := validatorMemberByID(proof.NextValidatorSet, action.ValidatorID)
	if !okBefore || !okAfter || !sameValidatorIdentity(before, after) { return SnapshotValidator{}, errors.New("ROTATE_CONSENSUS_KEY requires same permanent validator identity") }
	if before.ActivationHeight != after.ActivationHeight { return SnapshotValidator{}, errors.New("consensus-key rotation must not change validator activation height") }
	if (before.RetirementHeight == nil) != (after.RetirementHeight == nil) { return SnapshotValidator{}, errors.New("consensus-key rotation must not change validator retirement state") }
	if before.RetirementHeight != nil && *before.RetirementHeight != *after.RetirementHeight { return SnapshotValidator{}, errors.New("consensus-key rotation must not change validator retirement height") }
	if !snapshotValidatorActive(before, action.EffectiveHeight-1) || !snapshotValidatorActive(after, action.EffectiveHeight) { return SnapshotValidator{}, errors.New("consensus-key rotation requires validator ACTIVE across effective height") }
	oldActive, err := activeSnapshotConsensusKey(before, action.EffectiveHeight-1); if err != nil { return SnapshotValidator{}, err }
	newActive, err := activeSnapshotConsensusKey(after, action.EffectiveHeight); if err != nil { return SnapshotValidator{}, err }
	if oldActive.KeyID == newActive.KeyID { return SnapshotValidator{}, errors.New("consensus-key rotation did not change active key") }
	beforeKeys := map[string]SnapshotConsensusKey{}; afterKeys := map[string]SnapshotConsensusKey{}
	for _, key := range before.Keys { beforeKeys[key.KeyID] = key }
	for _, key := range after.Keys { afterKeys[key.KeyID] = key }
	retiredOld, ok := afterKeys[oldActive.KeyID]
	if !ok || retiredOld.PublicKeyDerB64 != oldActive.PublicKeyDerB64 || retiredOld.RetiredAtHeight == nil || *retiredOld.RetiredAtHeight != action.EffectiveHeight { return SnapshotValidator{}, errors.New("previous CONSENSUS key must retire exactly at the effective height") }
	newIDs := []string{}
	for keyID := range afterKeys { if _, exists := beforeKeys[keyID]; !exists { newIDs = append(newIDs, keyID) } }
	if len(newIDs) != 1 || newIDs[0] != newActive.KeyID || newActive.ActiveFromHeight != action.EffectiveHeight { return SnapshotValidator{}, errors.New("exactly one replacement CONSENSUS key must activate at effective height") }
	for keyID, key := range beforeKeys {
		if keyID == oldActive.KeyID { continue }
		nextKey, ok := afterKeys[keyID]; if !ok { return SnapshotValidator{}, fmt.Errorf("unrelated key history %s changed during rotation", keyID) }
		ha, err := canonicalHashValue(key); if err != nil { return SnapshotValidator{}, err }
		hb, err := canonicalHashValue(nextKey); if err != nil { return SnapshotValidator{}, err }
		if ha != hb { return SnapshotValidator{}, fmt.Errorf("unrelated key history %s changed during rotation", keyID) }
	}
	return after, nil
}

func verifyValidatorSetChangeProof(proof ValidatorSetChangeProof, expectedChainID, expectedGovernancePolicyHash, expectedPreviousValidatorSetRoot string) (ValidatorSetChangeVerification, error) {
	action := proof.Action; policy := proof.GovernancePolicy; previous := proof.PreviousValidatorSet; next := proof.NextValidatorSet
	if action.Domain != validatorSetChangeDomain || action.ActionVersion != validatorSetChangeVersion { return ValidatorSetChangeVerification{}, errors.New("unsupported validator-set change domain/version") }
	if policy.Profile != validatorGovernanceProfile || policy.AuthorityType != "VALIDATOR" || policy.VotingPolicy != "THRESHOLD" { return ValidatorSetChangeVerification{}, errors.New("unsupported validator governance policy profile") }
	if action.ChainID != expectedChainID || policy.ChainID != expectedChainID || previous.ChainID != expectedChainID || next.ChainID != expectedChainID { return ValidatorSetChangeVerification{}, errors.New("validator governance chainId mismatch") }
	if action.EffectiveHeight <= action.ApprovedAtHeight { return ValidatorSetChangeVerification{}, errors.New("validator-set changes must activate after approval height") }
	if policy.Status != "ACTIVE" || policy.EffectiveFromHeight > action.ApprovedAtHeight || (policy.EffectiveUntilHeight != nil && *policy.EffectiveUntilHeight <= action.ApprovedAtHeight) { return ValidatorSetChangeVerification{}, errors.New("validator governance policy was not ACTIVE at approval height") }
	requiredScope := governanceRequiredScope(action.ActionType); hasScope := false
	for _, scope := range policy.Scope { if scope == requiredScope { hasScope = true } }
	if !hasScope { return ValidatorSetChangeVerification{}, fmt.Errorf("validator governance policy lacks %s authority", requiredScope) }
	policyHash, err := canonicalGovernancePolicyHash(policy); if err != nil { return ValidatorSetChangeVerification{}, err }
	if policyHash != expectedGovernancePolicyHash || action.GovernancePolicyHash != policyHash { return ValidatorSetChangeVerification{}, errors.New("validator governance policy hash does not match independently trusted policy") }
	previousHash, err := validatorSetStateHash(previous); if err != nil { return ValidatorSetChangeVerification{}, err }
	nextHash, err := validatorSetStateHash(next); if err != nil { return ValidatorSetChangeVerification{}, err }
	if action.PreviousValidatorSetHash != previousHash || action.NextValidatorSetHash != nextHash { return ValidatorSetChangeVerification{}, errors.New("validator-set state hash mismatch") }
	previousRoot, err := snapshotValidatorSetRoot(previous, action.EffectiveHeight-1); if err != nil { return ValidatorSetChangeVerification{}, err }
	if previousRoot != expectedPreviousValidatorSetRoot || action.PreviousValidatorSetRoot != previousRoot { return ValidatorSetChangeVerification{}, errors.New("previous validator-set root does not match independently trusted canonical root") }
	nextRoot, err := snapshotValidatorSetRoot(next, action.EffectiveHeight); if err != nil { return ValidatorSetChangeVerification{}, err }
	if action.NextValidatorSetRoot != nextRoot { return ValidatorSetChangeVerification{}, errors.New("next validator-set root mismatch") }
	if err := assertOnlyGovernedTargetChanged(previous, next, action.ValidatorID); err != nil { return ValidatorSetChangeVerification{}, err }
	var subject SnapshotValidator
	if action.ActionType == "ROTATE_CONSENSUS_KEY" { subject, err = assertGovernedConsensusKeyRotation(proof) } else { subject, err = assertGovernedMembershipTransition(proof) }
	if err != nil { return ValidatorSetChangeVerification{}, err }
	subjectHash, err := validatorSubjectIdentityHash(subject); if err != nil { return ValidatorSetChangeVerification{}, err }
	if action.SubjectIdentityHash != subjectHash { return ValidatorSetChangeVerification{}, errors.New("validator subject identity hash mismatch") }
	for label, value := range map[string]string{"governancePolicyHash":action.GovernancePolicyHash,"previousValidatorSetRoot":action.PreviousValidatorSetRoot,"nextValidatorSetRoot":action.NextValidatorSetRoot,"previousValidatorSetHash":action.PreviousValidatorSetHash,"nextValidatorSetHash":action.NextValidatorSetHash,"subjectIdentityHash":action.SubjectIdentityHash,"reasonHash":action.ReasonHash} { if !isSHA256(value) { return ValidatorSetChangeVerification{}, fmt.Errorf("%s must be lowercase SHA-256", label) } }

	eligible := map[string]ValidatorGovernanceMember{}
	for _, member := range policy.Members {
		if governanceMemberEligibleAtHeight(member, action.ApprovedAtHeight) {
			if _, exists := eligible[member.AuthorityMemberID]; exists { return ValidatorSetChangeVerification{}, fmt.Errorf("duplicate governance authority member %s", member.AuthorityMemberID) }
			eligible[member.AuthorityMemberID] = member
		}
	}
	supermajority, err := requiredGovernanceSupermajority(len(eligible)); if err != nil { return ValidatorSetChangeVerification{}, err }
	required := supermajority; if policy.Threshold > required { required = policy.Threshold }
	if required > len(eligible) { return ValidatorSetChangeVerification{}, fmt.Errorf("validator governance threshold %d exceeds %d eligible authority members", required, len(eligible)) }
	normalizedAction, err := canonicalValue(action); if err != nil { return ValidatorSetChangeVerification{}, err }
	canonicalAction, err := canonicalJSON(normalizedAction); if err != nil { return ValidatorSetChangeVerification{}, err }
	payload := []byte(canonicalAction)
	valid := map[string]bool{}
	for _, sig := range proof.Signatures {
		if valid[sig.AuthorityMemberID] { continue }
		member, ok := eligible[sig.AuthorityMemberID]; if !ok || sig.KeyID != member.KeyID || sig.Algorithm != "Ed25519" || sig.Domain != validatorSetChangeDomain { continue }
		der, err := base64.StdEncoding.DecodeString(member.PublicKeyDerB64); if err != nil { continue }
		parsed, err := x509.ParsePKIXPublicKey(der); if err != nil { continue }
		pub, ok := parsed.(ed25519.PublicKey); if !ok { continue }
		signature, err := base64.StdEncoding.DecodeString(sig.SignatureB64); if err != nil { continue }
		if ed25519.Verify(pub, payload, signature) { valid[sig.AuthorityMemberID] = true }
	}
	validSigners := make([]string,0,len(valid)); for signer := range valid { validSigners=append(validSigners,signer) }; sort.Strings(validSigners)
	if len(validSigners) < required { return ValidatorSetChangeVerification{}, fmt.Errorf("validator governance supermajority not met: %d/%d; %d required", len(validSigners), len(eligible), required) }
	return ValidatorSetChangeVerification{true,action.ActionID,action.ActionType,action.ValidatorID,action.ApprovedAtHeight,action.EffectiveHeight,policyHash,previousRoot,nextRoot,previousHash,nextHash,len(eligible),required,validSigners},nil
}
