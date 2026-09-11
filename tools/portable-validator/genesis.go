package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

const (
	genesisHashDomain  = "STRATUM/GENESIS/DIR/1"
	genesisHashProfile = "STRATUM-GENESIS-HASH/1"
)

type GenesisVerification struct {
	Valid        bool   `json:"valid"`
	ComputedHash string `json:"computedHash"`
	ChainID      string `json:"chainId"`
	ObjectID     string `json:"objectId"`
}

func readCanonicalJSON(path string) (map[string]any, error) {
	b, err := os.ReadFile(path)
	if err != nil { return nil, err }
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.UseNumber()
	var value map[string]any
	if err := dec.Decode(&value); err != nil { return nil, fmt.Errorf("decode Genesis DIR: %w", err) }
	if dec.More() { return nil, errors.New("unexpected trailing JSON content") }
	return value, nil
}

func canonicalJSON(value any) (string, error) {
	switch v := value.(type) {
	case nil:
		return "null", nil
	case bool:
		if v { return "true", nil }; return "false", nil
	case string:
		b, _ := json.Marshal(v); return string(b), nil
	case json.Number:
		if strings.ContainsAny(v.String(), "eE.") {
			f, err := strconv.ParseFloat(v.String(), 64); if err != nil { return "", err }
			return strconv.FormatFloat(f, 'g', -1, 64), nil
		}
		if _, err := strconv.ParseInt(v.String(), 10, 64); err != nil { return "", fmt.Errorf("invalid integer %q", v.String()) }
		return v.String(), nil
	case float64:
		return strconv.FormatFloat(v, 'g', -1, 64), nil
	case []any:
		parts := make([]string, len(v))
		for i, item := range v { s, err := canonicalJSON(item); if err != nil { return "", err }; parts[i] = s }
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(v)); for k := range v { keys = append(keys, k) }; sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			ks, _ := json.Marshal(k); vs, err := canonicalJSON(v[k]); if err != nil { return "", err }
			parts = append(parts, string(ks)+":"+vs)
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	default:
		return "", fmt.Errorf("unsupported canonical JSON type %T", value)
	}
}

func canonicalGenesisHash(genesis map[string]any) (string, string, error) {
	material := make(map[string]any, len(genesis)-2)
	for k, v := range genesis {
		if k == "objectId" || k == "GenesisDIRHash" { continue }
		material[k] = v
	}
	wrapped := map[string]any{"domain": genesisHashDomain, "profile": genesisHashProfile, "genesis": material}
	preimage, err := canonicalJSON(wrapped)
	if err != nil { return "", "", err }
	digest := sha256.Sum256([]byte(preimage))
	return hex.EncodeToString(digest[:]), preimage, nil
}

func verifyCanonicalGenesis(path, expectedChainID, pinnedHash string) (GenesisVerification, error) {
	genesis, err := readCanonicalJSON(path)
	if err != nil { return GenesisVerification{}, err }
	objectType, _ := genesis["objectType"].(string)
	if objectType != "GenesisDIR" { return GenesisVerification{}, fmt.Errorf("expected objectType GenesisDIR, got %q", objectType) }
	chainID, _ := genesis["chainId"].(string)
	if chainID == "" || chainID != expectedChainID { return GenesisVerification{}, fmt.Errorf("Genesis chainId mismatch: expected %s got %s", expectedChainID, chainID) }
	objectID, _ := genesis["objectId"].(string)
	declaredHash, _ := genesis["GenesisDIRHash"].(string)
	if !isSHA256(objectID) || !isSHA256(declaredHash) { return GenesisVerification{}, errors.New("Genesis objectId and GenesisDIRHash must be lowercase SHA-256 digests") }
	if refs, ok := genesis["DIRRefs"].([]any); ok && len(refs) != 0 { return GenesisVerification{}, errors.New("Genesis DIR must not reference later DIRs") }
	computed, _, err := canonicalGenesisHash(genesis)
	if err != nil { return GenesisVerification{}, err }
	if declaredHash != computed { return GenesisVerification{}, fmt.Errorf("GenesisDIRHash mismatch: declared %s computed %s", declaredHash, computed) }
	if objectID != computed { return GenesisVerification{}, fmt.Errorf("Genesis objectId mismatch: declared %s computed %s", objectID, computed) }
	if strings.ToLower(pinnedHash) != computed { return GenesisVerification{}, fmt.Errorf("Genesis trust-root mismatch: pinned %s computed %s", strings.ToLower(pinnedHash), computed) }
	return GenesisVerification{true, computed, chainID, objectID}, nil
}
