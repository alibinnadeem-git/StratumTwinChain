package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type finalityVector struct {
	TrustedPreviousHeight    int64                `json:"trustedPreviousHeight"`
	TrustedPreviousDIRHash   string               `json:"trustedPreviousDIRHash"`
	ExpectedValidatorSetRoot string               `json:"expectedValidatorSetRoot"`
	ValidatorSet             SnapshotValidatorSet `json:"validatorSet"`
	Proof                    DIRFinalityProof     `json:"proof"`
}

func loadFinalityVector(t *testing.T) finalityVector {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "lib", "redbook", "test-vectors", "finality-v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var v finalityVector
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestFinalityVectorVerifies(t *testing.T) {
	v := loadFinalityVector(t)
	got, err := verifyDIRFinalityProof(v.ValidatorSet, v.Proof, "stratum-devnet-1", v.TrustedPreviousHeight, v.TrustedPreviousDIRHash, v.ExpectedValidatorSetRoot, "POVI/1")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Valid || got.Height != 11 || got.RequiredQuorum != 3 || len(got.ValidSigners) != 3 {
		t.Fatalf("unexpected verification %+v", got)
	}
	if got.DIRHash != "33f0ff2b7802b7b0a577d39e90974ac0cc3cd36d3ca308439e7d81c96558cf73" {
		t.Fatalf("unexpected DIR hash %s", got.DIRHash)
	}
}

func TestFinalityRejectsTwoOfThreeCommits(t *testing.T) {
	v := loadFinalityVector(t)
	v.Proof.PFC.CommitSignatures = v.Proof.PFC.CommitSignatures[:2]
	v.Proof.PFC.SignerIDs = v.Proof.PFC.SignerIDs[:2]
	if _, err := verifyDIRFinalityProof(v.ValidatorSet, v.Proof, "stratum-devnet-1", v.TrustedPreviousHeight, v.TrustedPreviousDIRHash, v.ExpectedValidatorSetRoot, "POVI/1"); err == nil {
		t.Fatal("2-of-3 COMMIT signatures unexpectedly finalized DIR")
	}
}

func TestFinalityRejectsBrokenPreviousDIRContinuity(t *testing.T) {
	v := loadFinalityVector(t)
	wrong := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := verifyDIRFinalityProof(v.ValidatorSet, v.Proof, "stratum-devnet-1", v.TrustedPreviousHeight, wrong, v.ExpectedValidatorSetRoot, "POVI/1"); err == nil {
		t.Fatal("broken previous DIR continuity unexpectedly verified")
	}
}

func TestFinalityRejectsTamperedState(t *testing.T) {
	v := loadFinalityVector(t)
	v.Proof.Header.StateRoot = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := verifyDIRFinalityProof(v.ValidatorSet, v.Proof, "stratum-devnet-1", v.TrustedPreviousHeight, v.TrustedPreviousDIRHash, v.ExpectedValidatorSetRoot, "POVI/1"); err == nil {
		t.Fatal("tampered state unexpectedly verified")
	}
}

func TestFinalityRejectsWrongValidatorSetRootPin(t *testing.T) {
	v := loadFinalityVector(t)
	wrong := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := verifyDIRFinalityProof(v.ValidatorSet, v.Proof, "stratum-devnet-1", v.TrustedPreviousHeight, v.TrustedPreviousDIRHash, wrong, "POVI/1"); err == nil {
		t.Fatal("wrong validator-set root pin unexpectedly verified")
	}
}
