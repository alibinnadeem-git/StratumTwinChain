package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"
)

const consensusTransportProfile = "STRATUM-CONSENSUS-TRANSPORT/1"

type ConsensusCommitVoteProof struct {
	Domain           string `json:"domain"`
	ChainID          string `json:"chainId"`
	Height           int64  `json:"height"`
	Round            int64  `json:"round"`
	Step             string `json:"step"`
	ProposalHash     string `json:"proposalHash"`
	StateRoot        string `json:"stateRoot"`
	ValidatorID      string `json:"validatorId"`
	ValidatorSetRoot string `json:"validatorSetRoot"`
	ProtocolVersion  string `json:"protocolVersion"`
	KeyID            string `json:"keyId"`
	Algorithm        string `json:"algorithm"`
	MessageHash      string `json:"messageHash"`
	SignatureB64     string `json:"signatureB64"`
}

type ConsensusWireMessage struct {
	ProfileVersion string                    `json:"profileVersion"`
	MessageType    string                    `json:"messageType"`
	TriggerRound   *int64                    `json:"triggerRound,omitempty"`
	Verify         *VerifyVoteProof          `json:"verify,omitempty"`
	Commit         *ConsensusCommitVoteProof `json:"commit,omitempty"`
	RoundChange    *RoundChangeVoteProof     `json:"roundChange,omitempty"`
}

func commitWireMessageHash(v ConsensusCommitVoteProof) (string, error) {
	return canonicalHashValue(map[string]any{
		"domain": v.Domain, "chainId": v.ChainID, "height": v.Height, "round": v.Round, "step": "COMMIT",
		"proposalHash": v.ProposalHash, "stateRoot": v.StateRoot, "validatorSetRoot": v.ValidatorSetRoot, "protocolVersion": v.ProtocolVersion,
	})
}

func consensusRootAtHeight(set SnapshotValidatorSet, height int64, expectedRoot string) (string, error) {
	root, err := snapshotValidatorSetRoot(set, height)
	if err != nil {
		return "", err
	}
	if root != expectedRoot {
		return "", fmt.Errorf("trusted validator-set root mismatch: computed %s", root)
	}
	return root, nil
}

func verifySingleConsensusVerify(set SnapshotValidatorSet, vote VerifyVoteProof, expectedChainID, expectedRoot, expectedProtocol string) error {
	if vote.Domain != poviVerifyDomain || vote.Step != "VERIFY" || vote.Algorithm != "Ed25519" {
		return errors.New("unsupported VERIFY vote profile")
	}
	if vote.ChainID != expectedChainID || set.ChainID != expectedChainID {
		return errors.New("VERIFY chainId mismatch")
	}
	if vote.Height < 1 || vote.Round < 0 || (vote.ProposalHash != "NIL" && !isSHA256(vote.ProposalHash)) {
		return errors.New("VERIFY height/round/proposalHash invalid")
	}
	if expectedProtocol != "" && vote.ProtocolVersion != expectedProtocol {
		return errors.New("VERIFY protocolVersion mismatch")
	}
	root, err := consensusRootAtHeight(set, vote.Height, expectedRoot)
	if err != nil {
		return err
	}
	if vote.ValidatorSetRoot != root {
		return errors.New("VERIFY does not bind trusted validator-set root")
	}
	expectedHash, err := verifyVoteMessageHashPortable(vote)
	if err != nil {
		return err
	}
	if vote.MessageHash != expectedHash {
		return errors.New("VERIFY messageHash mismatch")
	}
	if !verifyConsensusHashSignature(set, vote.Height, vote.ValidatorID, vote.KeyID, expectedHash, vote.SignatureB64) {
		return errors.New("VERIFY consensus signature verification failed")
	}
	return nil
}

func verifySingleConsensusCommit(set SnapshotValidatorSet, vote ConsensusCommitVoteProof, expectedChainID, expectedRoot, expectedProtocol string) error {
	if vote.Domain != poviCommitDomain || vote.Step != "COMMIT" || vote.Algorithm != "Ed25519" {
		return errors.New("unsupported COMMIT vote profile")
	}
	if vote.ChainID != expectedChainID || set.ChainID != expectedChainID {
		return errors.New("COMMIT chainId mismatch")
	}
	if vote.Height < 1 || vote.Round < 0 || !isSHA256(vote.ProposalHash) || !isSHA256(vote.StateRoot) {
		return errors.New("COMMIT height/round/proposal/state invalid")
	}
	if expectedProtocol != "" && vote.ProtocolVersion != expectedProtocol {
		return errors.New("COMMIT protocolVersion mismatch")
	}
	root, err := consensusRootAtHeight(set, vote.Height, expectedRoot)
	if err != nil {
		return err
	}
	if vote.ValidatorSetRoot != root {
		return errors.New("COMMIT does not bind trusted validator-set root")
	}
	expectedHash, err := commitWireMessageHash(vote)
	if err != nil {
		return err
	}
	if vote.MessageHash != expectedHash {
		return errors.New("COMMIT messageHash mismatch")
	}
	if !verifyConsensusHashSignature(set, vote.Height, vote.ValidatorID, vote.KeyID, expectedHash, vote.SignatureB64) {
		return errors.New("COMMIT consensus signature verification failed")
	}
	return nil
}

func verifySingleConsensusRoundChange(set SnapshotValidatorSet, triggerRound int64, vote RoundChangeVoteProof, expectedChainID, expectedRoot, expectedProtocol string) error {
	if triggerRound < 0 || vote.NewRound <= triggerRound {
		return errors.New("ROUND_CHANGE trigger/new round progression invalid")
	}
	if vote.Domain != poviRoundChangeDomain || vote.Algorithm != "Ed25519" {
		return errors.New("unsupported ROUND_CHANGE vote profile")
	}
	if vote.ChainID != expectedChainID || set.ChainID != expectedChainID {
		return errors.New("ROUND_CHANGE chainId mismatch")
	}
	if vote.Height < 1 {
		return errors.New("ROUND_CHANGE height invalid")
	}
	if expectedProtocol != "" && vote.ProtocolVersion != expectedProtocol {
		return errors.New("ROUND_CHANGE protocolVersion mismatch")
	}
	if err := validateRoundChangeVoteShape(vote); err != nil {
		return err
	}
	root, err := consensusRootAtHeight(set, vote.Height, expectedRoot)
	if err != nil {
		return err
	}
	if vote.ValidatorSetRoot != root {
		return errors.New("ROUND_CHANGE does not bind trusted validator-set root")
	}
	expectedHash, err := roundChangeMessageHashPortable(vote)
	if err != nil {
		return err
	}
	if vote.MessageHash != expectedHash {
		return errors.New("ROUND_CHANGE messageHash mismatch")
	}
	if !verifyConsensusHashSignature(set, vote.Height, vote.ValidatorID, vote.KeyID, expectedHash, vote.SignatureB64) {
		return errors.New("ROUND_CHANGE consensus signature verification failed")
	}
	return nil
}

func verifyConsensusWireMessage(set SnapshotValidatorSet, wire ConsensusWireMessage, expectedChainID, expectedRoot, expectedProtocol string) error {
	if wire.ProfileVersion != consensusTransportProfile {
		return errors.New("unsupported consensus transport profile")
	}
	payloadCount := 0
	if wire.Verify != nil {
		payloadCount++
	}
	if wire.Commit != nil {
		payloadCount++
	}
	if wire.RoundChange != nil {
		payloadCount++
	}
	if payloadCount != 1 {
		return errors.New("consensus wire message must carry exactly one signed payload")
	}
	switch wire.MessageType {
	case "VERIFY":
		if wire.Verify == nil || wire.Commit != nil || wire.RoundChange != nil || wire.TriggerRound != nil {
			return errors.New("VERIFY wire payload mismatch")
		}
		return verifySingleConsensusVerify(set, *wire.Verify, expectedChainID, expectedRoot, expectedProtocol)
	case "COMMIT":
		if wire.Commit == nil || wire.Verify != nil || wire.RoundChange != nil || wire.TriggerRound != nil {
			return errors.New("COMMIT wire payload mismatch")
		}
		return verifySingleConsensusCommit(set, *wire.Commit, expectedChainID, expectedRoot, expectedProtocol)
	case "ROUND_CHANGE":
		if wire.RoundChange == nil || wire.Verify != nil || wire.Commit != nil || wire.TriggerRound == nil {
			return errors.New("ROUND_CHANGE wire payload mismatch")
		}
		return verifySingleConsensusRoundChange(set, *wire.TriggerRound, *wire.RoundChange, expectedChainID, expectedRoot, expectedProtocol)
	default:
		return fmt.Errorf("consensus message type %s is not enabled in staging profile", wire.MessageType)
	}
}

func consensusSigningRuntimeReady(cfg BootstrapConfig) error {
	if cfg.State != "ACTIVE" || !cfg.VoteAuthority {
		return errors.New("consensus signing requires governed ACTIVE state with voteAuthority=true")
	}
	if len(cfg.ActivationBlockedReasons) != 0 {
		return fmt.Errorf("consensus signing blocked by unresolved activation gates: %s", strings.Join(cfg.ActivationBlockedReasons, ","))
	}
	return nil
}

func localConsensusKeyForHeight(cfg BootstrapConfig, set SnapshotValidatorSet, height int64, expectedRoot string) (SnapshotConsensusKey, error) {
	if _, err := consensusRootAtHeight(set, height, expectedRoot); err != nil {
		return SnapshotConsensusKey{}, err
	}
	member, ok := activeValidatorMap(set, height)[cfg.ValidatorID]
	if !ok {
		return SnapshotConsensusKey{}, errors.New("local validator is not ACTIVE in trusted validator set at message height")
	}
	key, err := activeSnapshotConsensusKey(member, height)
	if err != nil {
		return SnapshotConsensusKey{}, err
	}
	ref, ok := cfg.Keys["CONSENSUS"]
	if !ok || ref.PublicKeyB64 != key.PublicKeyDerB64 {
		return SnapshotConsensusKey{}, errors.New("local CONSENSUS key does not match trusted validator-set key")
	}
	return key, nil
}

func prepareConsensusTransportSignature(dir string, decision ConsensusSafetyDecision) (ConsensusSafetyRecord, string, error) {
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil {
		return ConsensusSafetyRecord{}, "", err
	}
	if err := consensusSigningRuntimeReady(cfg); err != nil {
		return ConsensusSafetyRecord{}, "", err
	}
	return prepareConsensusSignature(dir, decision)
}

func signVerifyWireMessage(dir string, set SnapshotValidatorSet, height, round int64, proposalHash, expectedRoot, expectedProtocol, unlockProofHash string, unlockProofRound *uint64) (ConsensusWireMessage, error) {
	if height < 1 || round < 0 {
		return ConsensusWireMessage{}, errors.New("VERIFY height/round invalid")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil {
		return ConsensusWireMessage{}, err
	}
	if expectedProtocol != "" && cfg.ProtocolVersion != expectedProtocol {
		return ConsensusWireMessage{}, errors.New("local protocolVersion mismatch")
	}
	key, err := localConsensusKeyForHeight(cfg, set, height, expectedRoot)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote := VerifyVoteProof{Domain: poviVerifyDomain, ChainID: cfg.ChainID, Height: height, Round: round, Step: "VERIFY", ProposalHash: proposalHash, ValidatorID: cfg.ValidatorID, ValidatorSetRoot: expectedRoot, ProtocolVersion: cfg.ProtocolVersion, KeyID: key.KeyID, Algorithm: "Ed25519"}
	hash, err := verifyVoteMessageHashPortable(vote)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote.MessageHash = hash
	decision := ConsensusSafetyDecision{Height: uint64(height), Round: uint64(round), Step: "VERIFY", ProposalHash: proposalHash, MessageHash: hash, UnlockProofHash: unlockProofHash, UnlockProofRound: unlockProofRound}
	_, sig, err := prepareConsensusTransportSignature(dir, decision)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote.SignatureB64 = sig
	return ConsensusWireMessage{ProfileVersion: consensusTransportProfile, MessageType: "VERIFY", Verify: &vote}, nil
}

func signCommitWireMessage(dir string, set SnapshotValidatorSet, height, round int64, proposalHash, stateRoot, expectedRoot, expectedProtocol string) (ConsensusWireMessage, error) {
	if height < 1 || round < 0 {
		return ConsensusWireMessage{}, errors.New("COMMIT height/round invalid")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil {
		return ConsensusWireMessage{}, err
	}
	if expectedProtocol != "" && cfg.ProtocolVersion != expectedProtocol {
		return ConsensusWireMessage{}, errors.New("local protocolVersion mismatch")
	}
	key, err := localConsensusKeyForHeight(cfg, set, height, expectedRoot)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote := ConsensusCommitVoteProof{Domain: poviCommitDomain, ChainID: cfg.ChainID, Height: height, Round: round, Step: "COMMIT", ProposalHash: proposalHash, StateRoot: stateRoot, ValidatorID: cfg.ValidatorID, ValidatorSetRoot: expectedRoot, ProtocolVersion: cfg.ProtocolVersion, KeyID: key.KeyID, Algorithm: "Ed25519"}
	hash, err := commitWireMessageHash(vote)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote.MessageHash = hash
	decision := ConsensusSafetyDecision{Height: uint64(height), Round: uint64(round), Step: "COMMIT", ProposalHash: proposalHash, StateRoot: stateRoot, MessageHash: hash}
	_, sig, err := prepareConsensusTransportSignature(dir, decision)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote.SignatureB64 = sig
	return ConsensusWireMessage{ProfileVersion: consensusTransportProfile, MessageType: "COMMIT", Commit: &vote}, nil
}

func signRoundChangeWireMessage(dir string, set SnapshotValidatorSet, height, triggerRound, newRound int64, expectedRoot, expectedProtocol string, evidenceRefs []string) (ConsensusWireMessage, error) {
	if height < 1 || triggerRound < 0 || newRound <= triggerRound {
		return ConsensusWireMessage{}, errors.New("ROUND_CHANGE height/round progression invalid")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil {
		return ConsensusWireMessage{}, err
	}
	if expectedProtocol != "" && cfg.ProtocolVersion != expectedProtocol {
		return ConsensusWireMessage{}, errors.New("local protocolVersion mismatch")
	}
	key, err := localConsensusKeyForHeight(cfg, set, height, expectedRoot)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	_, latest, _, err := latestConsensusSafetyRecord(dir)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	if latest.Height != uint64(height) || recoveredConsensusRound(latest) != uint64(triggerRound) {
		return ConsensusWireMessage{}, errors.New("ROUND_CHANGE trigger does not match recovered consensus safety state")
	}
	var lockedDIR, validDIR *string
	var lockedRound, validRound *int64
	if latest.LockedDIR != "" {
		v := latest.LockedDIR
		lockedDIR = &v
		r := int64(valueOrZero(latest.LockedRound))
		lockedRound = &r
	}
	if latest.ValidDIR != "" {
		v := latest.ValidDIR
		validDIR = &v
		r := int64(valueOrZero(latest.ValidRound))
		validRound = &r
	}
	vote := RoundChangeVoteProof{Domain: poviRoundChangeDomain, ChainID: cfg.ChainID, Height: height, NewRound: newRound, ValidatorID: cfg.ValidatorID, ValidatorSetRoot: expectedRoot, ProtocolVersion: cfg.ProtocolVersion, LockedDIR: lockedDIR, LockedRound: lockedRound, ValidDIR: validDIR, ValidRound: validRound, EvidenceRefs: append([]string(nil), evidenceRefs...), KeyID: key.KeyID, Algorithm: "Ed25519"}
	if err := validateRoundChangeVoteShape(vote); err != nil {
		return ConsensusWireMessage{}, err
	}
	hash, err := roundChangeMessageHashPortable(vote)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote.MessageHash = hash
	nr := uint64(newRound)
	decision := ConsensusSafetyDecision{Height: uint64(height), Round: uint64(triggerRound), NewRound: &nr, Step: "ROUND_CHANGE", MessageHash: hash}
	_, sig, err := prepareConsensusTransportSignature(dir, decision)
	if err != nil {
		return ConsensusWireMessage{}, err
	}
	vote.SignatureB64 = sig
	tr := triggerRound
	return ConsensusWireMessage{ProfileVersion: consensusTransportProfile, MessageType: "ROUND_CHANGE", TriggerRound: &tr, RoundChange: &vote}, nil
}

func verifyConsensusWireCommand(args []string) error {
	fs := flag.NewFlagSet("verify-consensus-wire", flag.ContinueOnError)
	messagePath := fs.String("message", "", "consensus wire message JSON")
	setPath := fs.String("validator-set", "", "trusted validator set JSON")
	chainID := fs.String("chain-id", "", "expected chain ID")
	root := fs.String("validator-set-root", "", "trusted validator-set root")
	protocol := fs.String("protocol-version", "POVI/1", "expected protocol version")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *messagePath == "" || *setPath == "" || *chainID == "" || !isSHA256(*root) {
		return errors.New("--message, --validator-set, --chain-id and a SHA-256 --validator-set-root are required")
	}
	set, err := readSnapshotValidatorSet(*setPath)
	if err != nil {
		return err
	}
	var wire ConsensusWireMessage
	if err := readJSON(*messagePath, &wire); err != nil {
		return err
	}
	if err := verifyConsensusWireMessage(set, wire, *chainID, *root, *protocol); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(map[string]any{"valid": true, "profileVersion": wire.ProfileVersion, "messageType": wire.MessageType, "consensusBearing": true, "voteAuthorityGranted": false}, "", "  ")
	fmt.Println(string(out))
	return nil
}
