package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

const expectedGenesisV1Hash = "51d5fd798fca7a43feb4904ba42ca4f15300ba630dab9ba19a61fba28a0bbe07"

func genesisVectorPath(t *testing.T) string {
	t.Helper()
	return filepath.Join("..", "..", "lib", "redbook", "test-vectors", "genesis-v1.json")
}

func TestCanonicalGenesisVector(t *testing.T) {
	path := genesisVectorPath(t)
	v, err := verifyCanonicalGenesis(path, "stratum-devnet-1", expectedGenesisV1Hash)
	if err != nil { t.Fatal(err) }
	if !v.Valid || v.ComputedHash != expectedGenesisV1Hash { t.Fatalf("unexpected verification: %+v", v) }
}

func TestCanonicalGenesisMutationFails(t *testing.T) {
	b, err := os.ReadFile(genesisVectorPath(t)); if err != nil { t.Fatal(err) }
	var g map[string]any
	if err := json.Unmarshal(b, &g); err != nil { t.Fatal(err) }
	g["networkName"] = "Tampered Network"
	tmp := filepath.Join(t.TempDir(), "genesis.json")
	out, _ := json.MarshalIndent(g, "", "  ")
	if err := os.WriteFile(tmp, out, 0o600); err != nil { t.Fatal(err) }
	if _, err := verifyCanonicalGenesis(tmp, "stratum-devnet-1", expectedGenesisV1Hash); err == nil { t.Fatal("tampered Genesis unexpectedly verified") }
}

func TestGenesisSelfIdentifiersExcludedOnlyFromPreimage(t *testing.T) {
	g, err := readCanonicalJSON(genesisVectorPath(t)); if err != nil { t.Fatal(err) }
	h, _, err := canonicalGenesisHash(g); if err != nil { t.Fatal(err) }
	if h != expectedGenesisV1Hash { t.Fatalf("wrong hash: %s", h) }
	g["objectId"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	h2, _, err := canonicalGenesisHash(g); if err != nil { t.Fatal(err) }
	if h2 != h { t.Fatal("objectId must be excluded from its own hash preimage") }
	g["networkName"] = "Changed"
	h3, _, err := canonicalGenesisHash(g); if err != nil { t.Fatal(err) }
	if h3 == h { t.Fatal("canonical Genesis content mutation must change hash") }
}
