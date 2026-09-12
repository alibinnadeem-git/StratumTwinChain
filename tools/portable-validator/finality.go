package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
)

const (
	pfcProofVersion         = "STRATUM-PFC-PROOF/1"
	pfcProofDomain          = "STRATUM/PFC/PROOF/1"
	dirFinalityProofVersion = "STRATUM-DIR-FINALITY-PROOF/1"
	poviProposalDomain      = "STRATUM/POVI/PROPOSAL/1"
	poviCommitDomain        = "STRATUM/POVI/COMMIT/1"
	dirHashDomain           = "STRATUM/DIR/1"
)

type DIRCandidateHeader struct {
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

type CommitVoteProof struct {
	ValidatorID  string `json:"validatorId"`
	ProposalHash string `json:"proposalHash"`
	StateRoot    string `json:"stateRoot"`
	MessageHash  string `json:"messageHash"`
	Signature    string `json:"signature"`
}

type PFCProofEnvelope struct {
	Domain           string            `json:"domain"`
	ProofVersion     string            `json:"proofVersion"`
	ChainID          string            `json:"chainId"`
	Height           int64             `json:"height"`
	Round            int64             `json:"round"`
	DIRHash          string            `json:"DIRHash"`
	ProposalHash     string            `json:"proposalHash"`
	StateRoot        string            `json:"stateRoot"`
	ValidatorSetRoot string            `json:"validatorSetRoot"`
	ProtocolVersion  string            `json:"protocolVersion"`
	SignerIDs        []string          `json:"signerIds"`
	CommitSignatures []CommitVoteProof `json:"COMMITSignatures"`
}

type DIRFinalityProof struct {
	ProofVersion string             `json:"proofVersion"`
	Header       DIRCandidateHeader `json:"header"`
	PFC          PFCProofEnvelope   `json:"PFC"`
}

type FinalityVerification struct {
	Valid                bool     `json:"valid"`
	Height               int64    `json:"height"`
	Round                int64    `json:"round"`
	DIRHash              string   `json:"DIRHash"`
	ProposalHash         string   `json:"proposalHash"`
	StateRoot            string   `json:"stateRoot"`
	ValidatorSetRoot     string   `json:"validatorSetRoot"`
	ProtocolVersion      string   `json:"protocolVersion"`
	ActiveValidatorCount int      `json:"activeValidatorCount"`
	RequiredQuorum       int      `json:"requiredQuorum"`
	ValidSigners         []string `json:"validSigners"`
}

func canonicalHashValue(value any) (string, error) {
	normalized, err := canonicalValue(value)
	if err != nil {
		return "", err
	}
	canonical, err := canonicalJSON(normalized)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(digest[:]), nil
}

func proposalHashForHeader(header DIRCandidateHeader) (string, error) {
	return canonicalHashValue(map[string]any{"domain": poviProposalDomain, "DIRCandidateHeader": header})
}

func commitMessageHashForProof(header DIRCandidateHeader, proposalHash string) (string, error) {
	return canonicalHashValue(map[string]any{
		"domain": poviCommitDomain, "chainId": header.ChainID, "height": header.Height, "round": header.Round, "step": "COMMIT",
		"proposalHash": proposalHash, "stateRoot": header.StateRoot, "validatorSetRoot": header.ValidatorSetRoot, "protocolVersion": header.ProtocolVersion,
	})
}

func finalizedDIRHashForProof(header DIRCandidateHeader, proposalHash string, signerIDs []string) (string, error) {
	return canonicalHashValue(map[string]any{
		"domain":   dirHashDomain,
		"header":   header,
		"finality": map[string]any{"proposalHash": proposalHash, "stateRoot": header.StateRoot, "validatorSetRoot": header.ValidatorSetRoot, "protocolVersion": header.ProtocolVersion, "signerIds": signerIDs},
	})
}

func verifyDIRFinalityProof(set SnapshotValidatorSet, proof DIRFinalityProof, expectedChainID string, trustedPreviousHeight int64, trustedPreviousDIRHash, expectedValidatorSetRoot, expectedProtocolVersion string) (FinalityVerification, error) {
	if proof.ProofVersion != dirFinalityProofVersion {
		return FinalityVerification{}, errors.New("unsupported DIR finality proof version")
	}
	header := proof.Header
	pfc := proof.PFC
	if pfc.Domain != pfcProofDomain || pfc.ProofVersion != pfcProofVersion {
		return FinalityVerification{}, errors.New("unsupported PFC proof domain/version")
	}
	if header.Height != trustedPreviousHeight+1 {
		return FinalityVerification{}, fmt.Errorf("DIR height discontinuity: expected %d, received %d", trustedPreviousHeight+1, header.Height)
	}
	if header.PreviousDIRHash != trustedPreviousDIRHash {
		return FinalityVerification{}, errors.New("DIR previousDIRHash does not continue the trusted head")
	}
	if header.ChainID != expectedChainID || pfc.ChainID != expectedChainID || set.ChainID != expectedChainID {
		return FinalityVerification{}, errors.New("DIR/PFC chainId mismatch")
	}
	if expectedProtocolVersion != "" && (header.ProtocolVersion != expectedProtocolVersion || pfc.ProtocolVersion != expectedProtocolVersion) {
		return FinalityVerification{}, errors.New("DIR/PFC protocolVersion mismatch")
	}
	if pfc.Height != header.Height || pfc.Round != header.Round {
		return FinalityVerification{}, errors.New("PFC height/round does not bind the DIR header")
	}
	if pfc.StateRoot != header.StateRoot {
		return FinalityVerification{}, errors.New("PFC stateRoot does not bind the DIR header")
	}
	for label, value := range map[string]string{"previousDIRHash": header.PreviousDIRHash, "orderedMicroDIRRoot": header.OrderedMicroDIRRoot, "stateRoot": header.StateRoot, "validatorSetRoot": header.ValidatorSetRoot, "PFC.DIRHash": pfc.DIRHash, "PFC.proposalHash": pfc.ProposalHash} {
		if !isSHA256(value) {
			return FinalityVerification{}, fmt.Errorf("%s must be a lowercase SHA-256 digest", label)
		}
	}
	root, err := snapshotValidatorSetRoot(set, header.Height)
	if err != nil {
		return FinalityVerification{}, err
	}
	if root != expectedValidatorSetRoot {
		return FinalityVerification{}, fmt.Errorf("trusted validator-set root mismatch: computed %s", root)
	}
	if header.ValidatorSetRoot != root || pfc.ValidatorSetRoot != root {
		return FinalityVerification{}, errors.New("DIR/PFC does not bind the trusted validator-set root")
	}
	proposalHash, err := proposalHashForHeader(header)
	if err != nil {
		return FinalityVerification{}, err
	}
	if pfc.ProposalHash != proposalHash {
		return FinalityVerification{}, errors.New("PFC proposalHash does not match the DIR candidate header")
	}
	messageHash, err := commitMessageHashForProof(header, proposalHash)
	if err != nil {
		return FinalityVerification{}, err
	}

	active := map[string]SnapshotValidator{}
	for _, member := range set.Members {
		if snapshotValidatorActive(member, header.Height) {
			active[member.ValidatorID] = member
		}
	}
	required, err := requiredSnapshotQuorum(len(active))
	if err != nil {
		return FinalityVerification{}, err
	}
	valid := map[string]bool{}
	for _, vote := range pfc.CommitSignatures {
		member, ok := active[vote.ValidatorID]
		if !ok {
			continue
		}
		if vote.ProposalHash != proposalHash || vote.StateRoot != header.StateRoot || vote.MessageHash != messageHash {
			continue
		}
		key, err := activeSnapshotConsensusKey(member, header.Height)
		if err != nil {
			return FinalityVerification{}, err
		}
		der, err := base64.StdEncoding.DecodeString(key.PublicKeyDerB64)
		if err != nil {
			continue
		}
		parsed, err := x509.ParsePKIXPublicKey(der)
		if err != nil {
			continue
		}
		pub, ok := parsed.(ed25519.PublicKey)
		if !ok {
			continue
		}
		sig, err := base64.StdEncoding.DecodeString(vote.Signature)
		if err != nil {
			continue
		}
		messageBytes, err := hex.DecodeString(messageHash)
		if err != nil {
			return FinalityVerification{}, err
		}
		if ed25519.Verify(pub, messageBytes, sig) {
			valid[vote.ValidatorID] = true
		}
	}
	validSigners := make([]string, 0, len(valid))
	for id := range valid {
		validSigners = append(validSigners, id)
	}
	sort.Strings(validSigners)
	if len(validSigners) < required {
		return FinalityVerification{}, fmt.Errorf("PFC PoVI quorum not met: %d/%d; %d required", len(validSigners), len(active), required)
	}
	declared := append([]string(nil), pfc.SignerIDs...)
	sortedDeclared := append([]string(nil), declared...)
	sort.Strings(sortedDeclared)
	if len(declared) != len(sortedDeclared) {
		return FinalityVerification{}, errors.New("PFC signerIds invalid")
	}
	for i := range declared {
		if declared[i] != sortedDeclared[i] {
			return FinalityVerification{}, errors.New("PFC signerIds must be canonically sorted")
		}
		if i > 0 && declared[i] == declared[i-1] {
			return FinalityVerification{}, errors.New("PFC signerIds must be unique")
		}
	}
	if len(declared) != len(validSigners) {
		return FinalityVerification{}, errors.New("PFC signerIds do not exactly match valid COMMIT signatures")
	}
	for i := range declared {
		if declared[i] != validSigners[i] {
			return FinalityVerification{}, errors.New("PFC signerIds do not exactly match valid COMMIT signatures")
		}
	}
	dirHash, err := finalizedDIRHashForProof(header, proposalHash, declared)
	if err != nil {
		return FinalityVerification{}, err
	}
	if pfc.DIRHash != dirHash {
		return FinalityVerification{}, fmt.Errorf("DIRHash mismatch: computed %s", dirHash)
	}
	return FinalityVerification{true, header.Height, header.Round, dirHash, proposalHash, header.StateRoot, root, header.ProtocolVersion, len(active), required, validSigners}, nil
}

func readFinalityProof(path string) (DIRFinalityProof, error) {
	var proof DIRFinalityProof
	err := readJSON(path, &proof)
	return proof, err
}
func readSnapshotValidatorSet(path string) (SnapshotValidatorSet, error) {
	var set SnapshotValidatorSet
	err := readJSON(path, &set)
	return set, err
}

var _ = json.Valid
