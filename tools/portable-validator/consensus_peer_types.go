package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const (
	consensusPeerProfile = "STRATUM-CONSENSUS-PEER/1"
	consensusPeerDomain  = "STRATUM/POVI/PEER_MESSAGE/1"
)

var consensusPeerSteps = map[string]bool{
	"VERIFY":       true,
	"COMMIT":       true,
	"ROUND_CHANGE": true,
}

type ConsensusPeerPacket struct {
	ProfileVersion        string          `json:"profileVersion"`
	Domain                string          `json:"domain"`
	ChainID               string          `json:"chainId"`
	NetworkName           string          `json:"networkName"`
	GenesisDIRHash        string          `json:"GenesisDIRHash"`
	ProtocolVersion       string          `json:"protocolVersion"`
	SenderValidatorID     string          `json:"senderValidatorId"`
	SenderConsensusKeyID  string          `json:"senderConsensusKeyId"`
	SenderTransportKeyID  string          `json:"senderTransportKeyId"`
	Height                int64           `json:"height"`
	Round                 int64           `json:"round"`
	Step                  string          `json:"step"`
	ValidatorSetRoot      string          `json:"validatorSetRoot"`
	PeerRegistryRoot      string          `json:"peerRegistryRoot"`
	IssuedAt              string          `json:"issuedAt"`
	ExpiresAt             string          `json:"expiresAt"`
	Sequence              uint64          `json:"sequence"`
	Nonce                 string          `json:"nonce"`
	Payload               json.RawMessage `json:"payload"`
	PayloadHash           string          `json:"payloadHash"`
	ConsensusMessageHash  string          `json:"consensusMessageHash"`
	ConsensusSignatureB64 string          `json:"consensusSignatureB64"`
	SafetyRecordHash      string          `json:"safetyRecordHash"`
	SafetySequence        uint64          `json:"safetySequence"`
	PacketHash            string          `json:"packetHash"`
	TransportSignatureB64 string          `json:"transportSignatureB64"`
}

type ConsensusPeerVerification struct {
	Valid                bool   `json:"valid"`
	SenderValidatorID    string `json:"senderValidatorId"`
	Height               int64  `json:"height"`
	Round                int64  `json:"round"`
	Step                 string `json:"step"`
	ValidatorSetRoot     string `json:"validatorSetRoot"`
	PeerRegistryRoot     string `json:"peerRegistryRoot"`
	ConsensusMessageHash string `json:"consensusMessageHash"`
	PacketHash           string `json:"packetHash"`
	PersistBeforeSign    bool   `json:"persistBeforeSign"`
}

func consensusPeerPacketHash(p ConsensusPeerPacket) (string, error) {
	return canonicalHashValue(map[string]any{
		"domain": consensusPeerDomain,
		"profileVersion": consensusPeerProfile,
		"chainId": p.ChainID,
		"networkName": p.NetworkName,
		"GenesisDIRHash": strings.ToLower(p.GenesisDIRHash),
		"protocolVersion": p.ProtocolVersion,
		"senderValidatorId": p.SenderValidatorID,
		"senderConsensusKeyId": p.SenderConsensusKeyID,
		"senderTransportKeyId": p.SenderTransportKeyID,
		"height": p.Height,
		"round": p.Round,
		"step": p.Step,
		"validatorSetRoot": p.ValidatorSetRoot,
		"peerRegistryRoot": p.PeerRegistryRoot,
		"issuedAt": p.IssuedAt,
		"expiresAt": p.ExpiresAt,
		"sequence": p.Sequence,
		"nonce": p.Nonce,
		"payloadHash": p.PayloadHash,
		"consensusMessageHash": p.ConsensusMessageHash,
		"safetyRecordHash": p.SafetyRecordHash,
		"safetySequence": p.SafetySequence,
	})
}

func consensusPeerPayloadHash(payload json.RawMessage) (string, error) {
	var value any
	if len(payload) == 0 {
		return "", errors.New("consensus peer payload is required")
	}
	if err := json.Unmarshal(payload, &value); err != nil {
		return "", fmt.Errorf("parse consensus peer payload: %w", err)
	}
	return canonicalHashValue(value)
}
