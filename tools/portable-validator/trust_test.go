package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

const expectedBootstrapTrustHash = "3015412c19e6c1b7af0f362dad3b8089eed42c3aaba2f569e7008080891e315e"

func vectorPath(name string) string {
	return filepath.Join("..", "..", "lib", "redbook", "test-vectors", name)
}

func TestGenesisTrustVector(t *testing.T) {
	result, err := verifyGenesisTrust(vectorPath("bootstrap-trust-v1.json"), vectorPath("genesis-certificate-v1.json"), expectedBootstrapTrustHash, "stratum-devnet-1", expectedGenesisV1Hash, "POVI/1")
	if err != nil {
		t.Fatal(err)
	}
	if !result.Valid || len(result.ValidSigners) != 2 || result.ValidSigners[0] != "root-a" || result.ValidSigners[1] != "root-b" {
		t.Fatalf("unexpected trust result: %+v", result)
	}
}

func TestGenesisTrustRejectsWrongBundlePin(t *testing.T) {
	wrong := "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	if _, err := verifyGenesisTrust(vectorPath("bootstrap-trust-v1.json"), vectorPath("genesis-certificate-v1.json"), wrong, "stratum-devnet-1", expectedGenesisV1Hash, "POVI/1"); err == nil {
		t.Fatal("wrong trust-bundle pin unexpectedly verified")
	}
}

func TestGenesisTrustRejectsTamperedSignature(t *testing.T) {
	b, err := os.ReadFile(vectorPath("genesis-certificate-v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cert map[string]any
	if err := json.Unmarshal(b, &cert); err != nil {
		t.Fatal(err)
	}
	sigs := cert["signatures"].([]any)
	second := sigs[1].(map[string]any)
	second["signatureB64"] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
	path := filepath.Join(t.TempDir(), "cert.json")
	out, _ := json.MarshalIndent(cert, "", "  ")
	if err := os.WriteFile(path, out, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyGenesisTrust(vectorPath("bootstrap-trust-v1.json"), path, expectedBootstrapTrustHash, "stratum-devnet-1", expectedGenesisV1Hash, "POVI/1"); err == nil {
		t.Fatal("tampered certificate unexpectedly met threshold")
	}
}

func TestGenesisTrustRejectsDuplicateSigner(t *testing.T) {
	b, err := os.ReadFile(vectorPath("genesis-certificate-v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cert map[string]any
	if err := json.Unmarshal(b, &cert); err != nil {
		t.Fatal(err)
	}
	sigs := cert["signatures"].([]any)
	sigs[1] = sigs[0]
	cert["signatures"] = sigs
	path := filepath.Join(t.TempDir(), "cert.json")
	out, _ := json.MarshalIndent(cert, "", "  ")
	if err := os.WriteFile(path, out, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyGenesisTrust(vectorPath("bootstrap-trust-v1.json"), path, expectedBootstrapTrustHash, "stratum-devnet-1", expectedGenesisV1Hash, "POVI/1"); err == nil {
		t.Fatal("duplicate signer unexpectedly counted twice")
	}
}
