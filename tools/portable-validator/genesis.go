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
	maxSafeJSONInteger = int64(9007199254740991)
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
	var extra any
	if err := dec.Decode(&extra); err == nil { return nil, errors.New("unexpected trailing JSON content") }
	return value, nil
}

func canonicalJSON(value any) (string, error) {
	switch v := value.(type) {
	case nil:
		return "null", nil
	case bool:
		if v { return "true", nil }; return "false", nil
	case string:
		return strconv.Quote(v), nil
	case json.Number:
		if strings.ContainsAny(v.String(), "eE.") { return "", fmt.Errorf("Genesis v1 numeric value %q is not a safe integer; encode decimal/high-precision values as canonical strings", v.String()) }
		n, err := strconv.ParseInt(v.String(), 10, 64); if err != nil { return "", fmt.Errorf("invalid Genesis integer %q", v.String()) }
		if n > maxSafeJSONInteger || n < -maxSafeJSONInteger { return "", fmt.Errorf("Genesis integer %q exceeds the JavaScript safe-integer range", v.String()) }
		return strconv.FormatInt(n, 10), nil
	case float64:
		if v != float64(int64(v)) || v > float64(maxSafeJSONInteger) || v < -float64(maxSafeJSONInteger) { return "", fmt.Errorf("Genesis v1 numeric value %v is not a safe integer", v) }
		return strconv.FormatInt(int64(v), 10), nil
	case []any:
		parts := make([]string, len(v))
		for i, item := range v { s, err := canonicalJSON(item); if err != nil { return "", err }; parts[i] = s }
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(v)); for k := range v { keys = append(keys, k) }; sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			vs, err := canonicalJSON(v[k]); if err != nil { return "", err }
			parts = append(parts, strconv.Quote(k)+":"+vs)
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
