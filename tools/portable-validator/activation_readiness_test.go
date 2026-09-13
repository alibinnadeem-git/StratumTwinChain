package main

import "testing"

func activationReadinessFixture() (BootstrapConfig, ValidatorSetChangeProof, ValidatorSetChangeVerification) {
	cfg := BootstrapConfig{
		ValidatorID:              "validator-d",
		ChainID:                  "stratum-devnet-1",
		State:                    candidateState,
		VoteAuthority:            false,
		ActivationBlockedReasons: []string{"GOVERNANCE_ACTIVATION_REQUIRED", "VRF_CONFORMANCE_NOT_YET_IMPLEMENTED", "LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED"},
		Keys:                     map[string]KeyRef{"CONSENSUS": {Purpose: "CONSENSUS", Algorithm: "ED25519", PublicKeyB64: "LOCAL-CONSENSUS-PUB", PublicKeyHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", KeyVersion: 1}},
	}
	proof := ValidatorSetChangeProof{
		Action: ValidatorSetChangeAction{ActionType: "ACTIVATE", ValidatorID: "validator-d", EffectiveHeight: 10},
		NextValidatorSet: SnapshotValidatorSet{SetVersion: validatorSetProfile, ChainID: cfg.ChainID, Members: []SnapshotValidator{{
			ValidatorID: "validator-d", IdentityUUID: "identity-d", OperatorOrg: "STRATUM", ActivationHeight: 10,
			Keys: []SnapshotConsensusKey{{KeyID: "consensus-d-1", Purpose: "CONSENSUS", Algorithm: "Ed25519", PublicKeyDerB64: "LOCAL-CONSENSUS-PUB", ActiveFromHeight: 10}},
		}}},
	}
	verified := ValidatorSetChangeVerification{Valid: true, ActionType: "ACTIVATE", ValidatorID: "validator-d", EffectiveHeight: 10}
	return cfg, proof, verified
}

func TestActivationReadinessPreservesCandidateAndReportsRemainingBlockers(t *testing.T) {
	cfg, proof, verified := activationReadinessFixture()
	got, err := evaluateActivationReadiness(cfg, proof, verified, 9)
	if err != nil {
		t.Fatal(err)
	}
	if !got.GovernanceProofValid || !got.LocalIdentityMatch || !got.LocalConsensusKeyMatch {
		t.Fatal("expected governed identity/key match")
	}
	if got.GovernanceActivationDue {
		t.Fatal("activation must not be due before effective height")
	}
	if got.VoteAuthority || got.ReadyForVoteAuthority {
		t.Fatal("readiness verification must not grant vote authority")
	}
	if len(got.RemainingActivationBlockers) != 2 {
		t.Fatalf("expected two non-governance blockers, got %v", got.RemainingActivationBlockers)
	}
	if cfg.VoteAuthority || cfg.State != candidateState {
		t.Fatal("input candidate must remain unchanged")
	}
}

func TestActivationReadinessCanBecomeReadyOnlyWhenAllOtherBlockersClear(t *testing.T) {
	cfg, proof, verified := activationReadinessFixture()
	cfg.ActivationBlockedReasons = []string{"GOVERNANCE_ACTIVATION_REQUIRED"}
	got, err := evaluateActivationReadiness(cfg, proof, verified, 10)
	if err != nil {
		t.Fatal(err)
	}
	if !got.GovernanceActivationDue || !got.ReadyForVoteAuthority {
		t.Fatal("expected readiness at effective height when no other blockers remain")
	}
	if got.VoteAuthority {
		t.Fatal("readiness result must never itself grant vote authority")
	}
}

func TestActivationReadinessRejectsMismatchedLocalConsensusKey(t *testing.T) {
	cfg, proof, verified := activationReadinessFixture()
	cfg.Keys["CONSENSUS"] = KeyRef{Purpose: "CONSENSUS", Algorithm: "ED25519", PublicKeyB64: "WRONG-PUB", PublicKeyHash: cfg.Keys["CONSENSUS"].PublicKeyHash, KeyVersion: 1}
	if _, err := evaluateActivationReadiness(cfg, proof, verified, 10); err == nil {
		t.Fatal("expected governed/local consensus key mismatch to fail")
	}
}

func TestActivationReadinessRejectsWrongTarget(t *testing.T) {
	cfg, proof, verified := activationReadinessFixture()
	verified.ValidatorID = "validator-e"
	if _, err := evaluateActivationReadiness(cfg, proof, verified, 10); err == nil {
		t.Fatal("expected wrong activation target to fail")
	}
}
