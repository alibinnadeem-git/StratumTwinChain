package main

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
)

const (
	poviVerifyDomain           = "STRATUM/POVI/VERIFY/1"
	poviRoundChangeDomain      = "STRATUM/POVI/ROUND_CHANGE/1"
	roundChangeEvidenceVersion = "STRATUM-ROUND-CHANGE-EVIDENCE/1"
)

type VerifyVoteProof struct {
	Domain           string `json:"domain"`
	ChainID          string `json:"chainId"`
	Height           int64  `json:"height"`
	Round            int64  `json:"round"`
	Step             string `json:"step"`
	ProposalHash     string `json:"proposalHash"`
	ValidatorID      string `json:"validatorId"`
	ValidatorSetRoot string `json:"validatorSetRoot"`
	ProtocolVersion  string `json:"protocolVersion"`
	KeyID            string `json:"keyId"`
	Algorithm        string `json:"algorithm"`
	MessageHash      string `json:"messageHash"`
	SignatureB64     string `json:"signatureB64"`
}

type RoundChangeVoteProof struct {
	Domain           string   `json:"domain"`
	ChainID          string   `json:"chainId"`
	Height           int64    `json:"height"`
	NewRound         int64    `json:"newRound"`
	ValidatorID      string   `json:"validatorId"`
	ValidatorSetRoot string   `json:"validatorSetRoot"`
	ProtocolVersion  string   `json:"protocolVersion"`
	LockedDIR        *string  `json:"lockedDIR"`
	LockedRound      *int64   `json:"lockedRound"`
	ValidDIR         *string  `json:"validDIR"`
	ValidRound       *int64   `json:"validRound"`
	EvidenceRefs     []string `json:"evidenceRefs"`
	KeyID            string   `json:"keyId"`
	Algorithm        string   `json:"algorithm"`
	MessageHash      string   `json:"messageHash"`
	SignatureB64     string   `json:"signatureB64"`
}

type RoundChangeQuorumEvidence struct {
	EvidenceVersion    string                 `json:"evidenceVersion"`
	ChainID            string                 `json:"chainId"`
	Height             int64                  `json:"height"`
	TriggerRound       int64                  `json:"triggerRound"`
	NewRound           int64                  `json:"newRound"`
	ValidatorSetRoot   string                 `json:"validatorSetRoot"`
	ProtocolVersion    string                 `json:"protocolVersion"`
	RoundChangeVotes   []RoundChangeVoteProof `json:"roundChangeVotes"`
	PriorRoundNILVotes []VerifyVoteProof      `json:"priorRoundNILVotes"`
}

type RoundChangeVerification struct {
	Valid                bool     `json:"valid"`
	ChainID              string   `json:"chainId"`
	Height               int64    `json:"height"`
	TriggerRound         int64    `json:"triggerRound"`
	NewRound             int64    `json:"newRound"`
	ValidatorSetRoot     string   `json:"validatorSetRoot"`
	ProtocolVersion      string   `json:"protocolVersion"`
	ActiveValidatorCount int      `json:"activeValidatorCount"`
	RequiredQuorum       int      `json:"requiredQuorum"`
	ValidSigners         []string `json:"validSigners"`
	NILQuorumVerified    bool     `json:"nilQuorumVerified"`
	SafeUnlockAuthorized bool     `json:"safeUnlockAuthorized"`
}

func verifyVoteMessageHashPortable(v VerifyVoteProof) (string, error) {
	return canonicalHashValue(map[string]any{
		"domain":           poviVerifyDomain,
		"chainId":          v.ChainID,
		"height":           v.Height,
		"round":            v.Round,
		"step":             "VERIFY",
		"proposalHash":     v.ProposalHash,
		"validatorId":      v.ValidatorID,
		"validatorSetRoot": v.ValidatorSetRoot,
		"protocolVersion":  v.ProtocolVersion,
	})
}

func roundChangeMessageHashPortable(v RoundChangeVoteProof) (string, error) {
	return canonicalHashValue(map[string]any{
		"domain":           poviRoundChangeDomain,
		"chainId":          v.ChainID,
		"height":           v.Height,
		"newRound":         v.NewRound,
		"validatorId":      v.ValidatorID,
		"validatorSetRoot": v.ValidatorSetRoot,
		"protocolVersion":  v.ProtocolVersion,
		"lockedDIR":        v.LockedDIR,
		"lockedRound":      v.LockedRound,
		"validDIR":         v.ValidDIR,
		"validRound":       v.ValidRound,
		"evidenceRefs":     v.EvidenceRefs,
	})
}

func activeValidatorMap(set SnapshotValidatorSet, height int64) map[string]SnapshotValidator {
	active := map[string]SnapshotValidator{}
	for _, member := range set.Members {
		if snapshotValidatorActive(member, height) {
			active[member.ValidatorID] = member
		}
	}
	return active
}

func verifyConsensusHashSignature(set SnapshotValidatorSet, height int64, validatorID, keyID, messageHash, signatureB64 string) bool {
	member, ok := activeValidatorMap(set, height)[validatorID]
	if !ok {
		return false
	}
	key, err := activeSnapshotConsensusKey(member, height)
	if err != nil || key.KeyID != keyID {
		return false
	}
	der, err := base64.StdEncoding.DecodeString(key.PublicKeyDerB64)
	if err != nil {
		return false
	}
	parsed, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return false
	}
	pub, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return false
	}
	sig, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return false
	}
	message, err := hex.DecodeString(messageHash)
	if err != nil {
		return false
	}
	return ed25519.Verify(pub, message, sig)
}

func verifyNILQuorum(set SnapshotValidatorSet, votes []VerifyVoteProof, expectedChainID string, height, round int64, expectedRoot, expectedProtocol string) ([]string, error) {
	root, err := snapshotValidatorSetRoot(set, height)
	if err != nil {
		return nil, err
	}
	if root != expectedRoot {
		return nil, fmt.Errorf("NIL VERIFY trusted validator-set root mismatch: computed %s", root)
	}
	active := activeValidatorMap(set, height)
	required, err := requiredSnapshotQuorum(len(active))
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	valid := map[string]bool{}
	for _, vote := range votes {
		if seen[vote.ValidatorID] {
			return nil, fmt.Errorf("duplicate NIL VERIFY signer %s", vote.ValidatorID)
		}
		seen[vote.ValidatorID] = true
		if vote.Domain != poviVerifyDomain || vote.ChainID != expectedChainID || vote.Height != height || vote.Round != round || vote.Step != "VERIFY" || vote.ProposalHash != "NIL" || vote.ValidatorSetRoot != root || vote.ProtocolVersion != expectedProtocol || vote.Algorithm != "Ed25519" {
			continue
		}
		expectedHash, err := verifyVoteMessageHashPortable(vote)
		if err != nil {
			return nil, err
		}
		if vote.MessageHash != expectedHash {
			continue
		}
		if verifyConsensusHashSignature(set, height, vote.ValidatorID, vote.KeyID, expectedHash, vote.SignatureB64) {
			valid[vote.ValidatorID] = true
		}
	}
	signers := make([]string, 0, len(valid))
	for id := range valid {
		signers = append(signers, id)
	}
	sort.Strings(signers)
	if len(signers) < required {
		return nil, fmt.Errorf("NIL VERIFY quorum not met: %d/%d; %d required", len(signers), len(active), required)
	}
	return signers, nil
}

func validateRoundChangeVoteShape(v RoundChangeVoteProof) error {
	if (v.LockedDIR == nil) != (v.LockedRound == nil) {
		return errors.New("lockedDIR and lockedRound must be supplied together")
	}
	if (v.ValidDIR == nil) != (v.ValidRound == nil) {
		return errors.New("validDIR and validRound must be supplied together")
	}
	if v.LockedRound != nil && *v.LockedRound >= v.NewRound {
		return errors.New("lockedRound must precede newRound")
	}
	if v.ValidRound != nil && *v.ValidRound >= v.NewRound {
		return errors.New("validRound must precede newRound")
	}
	if (v.LockedDIR != nil || v.ValidDIR != nil) && len(v.EvidenceRefs) == 0 {
		return errors.New("lock/valid-value claims require evidenceRefs; ROUND_CHANGE alone never proves an unlock")
	}
	return nil
}

func verifyRoundChangeEvidence(set SnapshotValidatorSet, evidence RoundChangeQuorumEvidence, expectedChainID, expectedRoot, expectedProtocol string, expectedCurrentRound *int64) (RoundChangeVerification, error) {
	if evidence.EvidenceVersion != roundChangeEvidenceVersion {
		return RoundChangeVerification{}, errors.New("unsupported ROUND_CHANGE evidence version")
	}
	if set.ChainID != expectedChainID || evidence.ChainID != expectedChainID {
		return RoundChangeVerification{}, errors.New("ROUND_CHANGE chainId mismatch")
	}
	if evidence.Height < 1 || evidence.TriggerRound < 0 || evidence.NewRound <= evidence.TriggerRound {
		return RoundChangeVerification{}, errors.New("ROUND_CHANGE height/round progression is invalid")
	}
	if expectedCurrentRound != nil && evidence.TriggerRound != *expectedCurrentRound {
		return RoundChangeVerification{}, fmt.Errorf("ROUND_CHANGE triggerRound mismatch: expected %d", *expectedCurrentRound)
	}
	if expectedProtocol != "" && evidence.ProtocolVersion != expectedProtocol {
		return RoundChangeVerification{}, errors.New("ROUND_CHANGE protocolVersion mismatch")
	}
	root, err := snapshotValidatorSetRoot(set, evidence.Height)
	if err != nil {
		return RoundChangeVerification{}, err
	}
	if root != expectedRoot {
		return RoundChangeVerification{}, fmt.Errorf("ROUND_CHANGE trusted validator-set root mismatch: computed %s", root)
	}
	if evidence.ValidatorSetRoot != root {
		return RoundChangeVerification{}, errors.New("ROUND_CHANGE evidence does not bind the trusted validator-set root")
	}
	active := activeValidatorMap(set, evidence.Height)
	required, err := requiredSnapshotQuorum(len(active))
	if err != nil {
		return RoundChangeVerification{}, err
	}
	seen := map[string]bool{}
	valid := map[string]bool{}
	for _, vote := range evidence.RoundChangeVotes {
		if seen[vote.ValidatorID] {
			return RoundChangeVerification{}, fmt.Errorf("duplicate ROUND_CHANGE signer %s", vote.ValidatorID)
		}
		seen[vote.ValidatorID] = true
		if err := validateRoundChangeVoteShape(vote); err != nil {
			return RoundChangeVerification{}, err
		}
		if vote.Domain != poviRoundChangeDomain || vote.ChainID != expectedChainID || vote.Height != evidence.Height || vote.NewRound != evidence.NewRound || vote.ValidatorSetRoot != root || vote.ProtocolVersion != evidence.ProtocolVersion || vote.Algorithm != "Ed25519" {
			continue
		}
		expectedHash, err := roundChangeMessageHashPortable(vote)
		if err != nil {
			return RoundChangeVerification{}, err
		}
		if vote.MessageHash != expectedHash {
			continue
		}
		if verifyConsensusHashSignature(set, evidence.Height, vote.ValidatorID, vote.KeyID, expectedHash, vote.SignatureB64) {
			valid[vote.ValidatorID] = true
		}
	}
	signers := make([]string, 0, len(valid))
	for id := range valid {
		signers = append(signers, id)
	}
	sort.Strings(signers)
	if len(signers) < required {
		return RoundChangeVerification{}, fmt.Errorf("ROUND_CHANGE quorum not met: %d/%d; %d required", len(signers), len(active), required)
	}
	nilVerified := false
	if len(evidence.PriorRoundNILVotes) > 0 {
		if _, err := verifyNILQuorum(set, evidence.PriorRoundNILVotes, expectedChainID, evidence.Height, evidence.TriggerRound, root, evidence.ProtocolVersion); err != nil {
			return RoundChangeVerification{}, err
		}
		nilVerified = true
	}
	// A ROUND_CHANGE quorum authorizes only the round transition. It never authorizes a safe unlock.
	return RoundChangeVerification{true, evidence.ChainID, evidence.Height, evidence.TriggerRound, evidence.NewRound, root, evidence.ProtocolVersion, len(active), required, signers, nilVerified, false}, nil
}

func readRoundChangeEvidence(path string) (RoundChangeQuorumEvidence, error) {
	var evidence RoundChangeQuorumEvidence
	err := readJSON(path, &evidence)
	return evidence, err
}
