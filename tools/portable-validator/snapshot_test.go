package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type snapshotVector struct {
	ExpectedValidatorSetRoot string                   `json:"expectedValidatorSetRoot"`
	ValidatorSet             SnapshotValidatorSet     `json:"validatorSet"`
	Certificate              SnapshotTrustCertificate `json:"certificate"`
}

func snapshotVectorPath(t *testing.T) string {
	t.Helper()
	return filepath.Join("..", "..", "lib", "redbook", "test-vectors", "snapshot-v1.json")
}

func loadSnapshotVector(t *testing.T) snapshotVector {
	t.Helper()
	b, err := os.ReadFile(snapshotVectorPath(t))
	if err != nil {
		t.Fatal(err)
	}
	var v snapshotVector
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestSnapshotVectorVerifiesWithThreeOfThree(t *testing.T) {
	v := loadSnapshotVector(t)
	got, err := verifySnapshotCertificate(v.ValidatorSet, v.Certificate, "stratum-devnet-1", v.ExpectedValidatorSetRoot, "POVI/1")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Valid || got.RequiredQuorum != 3 || got.ActiveValidatorCount != 3 || len(got.ValidSigners) != 3 {
		t.Fatalf("unexpected verification: %+v", got)
	}
	if got.ValidatorSetRoot != v.ExpectedValidatorSetRoot {
		t.Fatalf("unexpected root %s", got.ValidatorSetRoot)
	}
}

func TestSnapshotTwoOfThreeCannotFinalize(t *testing.T) {
	v := loadSnapshotVector(t)
	v.Certificate.Signatures = v.Certificate.Signatures[:2]
	if _, err := verifySnapshotCertificate(v.ValidatorSet, v.Certificate, "stratum-devnet-1", v.ExpectedValidatorSetRoot, "POVI/1"); err == nil {
		t.Fatal("2-of-3 snapshot signatures unexpectedly met PoVI quorum")
	}
}

func TestSnapshotRejectsWrongTrustedValidatorSetRoot(t *testing.T) {
	v := loadSnapshotVector(t)
	wrong := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := verifySnapshotCertificate(v.ValidatorSet, v.Certificate, "stratum-devnet-1", wrong, "POVI/1"); err == nil {
		t.Fatal("snapshot unexpectedly accepted untrusted validator-set root")
	}
}

func TestSnapshotPayloadMutationInvalidatesSignatures(t *testing.T) {
	v := loadSnapshotVector(t)
	v.Certificate.StateRoot = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if _, err := verifySnapshotCertificate(v.ValidatorSet, v.Certificate, "stratum-devnet-1", v.ExpectedValidatorSetRoot, "POVI/1"); err == nil {
		t.Fatal("tampered snapshot unexpectedly verified")
	}
}

func TestSnapshotValidatorSetRootMatchesSharedVector(t *testing.T) {
	v := loadSnapshotVector(t)
	root, err := snapshotValidatorSetRoot(v.ValidatorSet, v.Certificate.SnapshotHeight)
	if err != nil {
		t.Fatal(err)
	}
	if root != v.ExpectedValidatorSetRoot {
		t.Fatalf("validator set root mismatch: %s", root)
	}
}
