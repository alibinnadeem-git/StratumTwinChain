package main

import (
	"encoding/json"
	"testing"
)

func TestConsensusPeerPacketHashDeterministicAndTamperSensitive(t *testing.T) {
	payload := json.RawMessage(`{"proposalHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`)
	payloadHash, err := consensusPeerPayloadHash(payload)
	if err != nil { t.Fatal(err) }
	packet := ConsensusPeerPacket{
		ProfileVersion: consensusPeerProfile,
		Domain: consensusPeerDomain,
		ChainID: "stratum-devnet-1",
		NetworkName: "STRATUM Devnet",
		GenesisDIRHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		ProtocolVersion: "POVI/1",
		SenderValidatorID: "validator-a",
		SenderConsensusKeyID: "consensus-a-1",
		SenderTransportKeyID: "transport-a-1",
		Height: 12,
		Round: 2,
		Step: "VERIFY",
		ValidatorSetRoot: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
		PeerRegistryRoot: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		IssuedAt: "2026-09-13T23:00:00Z",
		ExpiresAt: "2026-09-13T23:01:30Z",
		Sequence: 9,
		Nonce: "nonce-0123456789abcdef",
		Payload: payload,
		PayloadHash: payloadHash,
		ConsensusMessageHash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
		ConsensusSignatureB64: "consensus-signature",
		SafetyRecordHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
		SafetySequence: 7,
	}
	a, err := consensusPeerPacketHash(packet)
	if err != nil { t.Fatal(err) }
	b, err := consensusPeerPacketHash(packet)
	if err != nil { t.Fatal(err) }
	if a != b { t.Fatal("canonical consensus peer hash must be deterministic") }
	packet.Sequence++
	c, err := consensusPeerPacketHash(packet)
	if err != nil { t.Fatal(err) }
	if c == a { t.Fatal("sequence tampering must change packet hash") }
}

func TestConsensusPeerVoteProfileDoesNotEnableProposalOrCertificates(t *testing.T) {
	for _, step := range []string{"VERIFY", "COMMIT", "ROUND_CHANGE"} {
		if !consensusPeerSteps[step] { t.Fatalf("expected %s to be enabled", step) }
	}
	for _, step := range []string{"PROPOSAL", "LOCK", "PLC", "PFC", "FINALIZE"} {
		if consensusPeerSteps[step] { t.Fatalf("consensus peer vote profile must not enable %s", step) }
	}
}
