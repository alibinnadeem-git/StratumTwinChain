package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
)

const (
	snapshotCertificateVersion = "STRATUM-SNAPSHOT-CERT/1"
	snapshotCertificateDomain  = "STRATUM/SNAPSHOT/CERT/1"
	validatorSetProfile        = "STRATUM-VALIDATOR-SET/1"
	validatorSetRootDomain     = "STRATUM/VALIDATOR_SET/1"
)

type SnapshotConsensusKey struct {
	KeyID           string `json:"keyId"`
	Purpose         string `json:"purpose"`
	Algorithm       string `json:"algorithm"`
	PublicKeyDerB64 string `json:"publicKeyDerB64"`
	ActiveFromHeight int64 `json:"activeFromHeight"`
	RetiredAtHeight *int64 `json:"retiredAtHeight"`
}

type SnapshotValidator struct {
	ValidatorID      string                 `json:"validatorId"`
	IdentityUUID     string                 `json:"identityUuid"`
	OperatorOrg      string                 `json:"operatorOrg"`
	ActivationHeight int64                  `json:"activationHeight"`
	RetirementHeight *int64                 `json:"retirementHeight"`
	Keys             []SnapshotConsensusKey `json:"keys"`
}

type SnapshotValidatorSet struct {
	SetVersion string              `json:"setVersion"`
	ChainID    string              `json:"chainId"`
	Members    []SnapshotValidator `json:"members"`
}

type SnapshotSignature struct {
	SignerID     string `json:"signerId"`
	KeyID        string `json:"keyId"`
	Algorithm    string `json:"algorithm"`
	Domain       string `json:"domain"`
	SignatureB64 string `json:"signatureB64"`
}

type SnapshotTrustCertificate struct {
	Domain               string              `json:"domain"`
	CertificateVersion   string              `json:"certificateVersion"`
	ChainID              string              `json:"chainId"`
	SnapshotHeight       int64               `json:"snapshotHeight"`
	DIRHash              string              `json:"DIRHash"`
	StateRoot            string              `json:"stateRoot"`
	ValidatorSetRoot     string              `json:"validatorSetRoot"`
	ProtocolVersion      string              `json:"protocolVersion"`
	StateManifestRoot    string              `json:"stateManifestRoot"`
	SpatialManifestRoot  string              `json:"SpatialManifestRoot"`
	EvidenceManifestRoot string              `json:"evidenceManifestRoot"`
	Signatures           []SnapshotSignature `json:"signatures"`
}

type SnapshotVerification struct {
	Valid                bool     `json:"valid"`
	SnapshotHeight       int64    `json:"snapshotHeight"`
	DIRHash              string   `json:"DIRHash"`
	StateRoot            string   `json:"stateRoot"`
	ValidatorSetRoot     string   `json:"validatorSetRoot"`
	ProtocolVersion      string   `json:"protocolVersion"`
	ActiveValidatorCount int      `json:"activeValidatorCount"`
	RequiredQuorum       int      `json:"requiredQuorum"`
	ValidSigners         []string `json:"validSigners"`
}

type snapshotCertificatePayload struct {
	Domain               string `json:"domain"`
	CertificateVersion   string `json:"certificateVersion"`
	ChainID              string `json:"chainId"`
	SnapshotHeight       int64  `json:"snapshotHeight"`
	DIRHash              string `json:"DIRHash"`
	StateRoot            string `json:"stateRoot"`
	ValidatorSetRoot     string `json:"validatorSetRoot"`
	ProtocolVersion      string `json:"protocolVersion"`
	StateManifestRoot    string `json:"stateManifestRoot"`
	SpatialManifestRoot  string `json:"SpatialManifestRoot"`
	EvidenceManifestRoot string `json:"evidenceManifestRoot"`
}

func snapshotValidatorActive(member SnapshotValidator, height int64) bool {
	return member.ActivationHeight <= height && (member.RetirementHeight == nil || *member.RetirementHeight > height)
}

func activeSnapshotConsensusKey(member SnapshotValidator, height int64) (SnapshotConsensusKey, error) {
	active := []SnapshotConsensusKey{}
	for _, key := range member.Keys {
		if key.Purpose != "CONSENSUS" || key.Algorithm != "Ed25519" { continue }
		if key.ActiveFromHeight <= height && (key.RetiredAtHeight == nil || *key.RetiredAtHeight > height) {
			active = append(active, key)
		}
	}
	if len(active) != 1 { return SnapshotConsensusKey{}, fmt.Errorf("validator %s must have exactly one active CONSENSUS key at height %d; found %d", member.ValidatorID, height, len(active)) }
	return active[0], nil
}

func canonicalValue(value any) (any, error) {
	b, err := json.Marshal(value); if err != nil { return nil, err }
	dec := json.NewDecoder(bytes.NewReader(b)); dec.UseNumber()
	var normalized any
	if err := dec.Decode(&normalized); err != nil { return nil, err }
	return normalized, nil
}

func snapshotValidatorSetRoot(set SnapshotValidatorSet, height int64) (string, error) {
	if set.SetVersion != validatorSetProfile { return "", fmt.Errorf("unsupported validator set profile %q", set.SetVersion) }
	if set.ChainID == "" { return "", errors.New("validator set chainId is required") }
	validators := make([]map[string]any, 0, len(set.Members))
	seen := map[string]bool{}
	for _, member := range set.Members {
		if seen[member.ValidatorID] { return "", fmt.Errorf("duplicate validatorId %s", member.ValidatorID) }
		seen[member.ValidatorID] = true
		if !snapshotValidatorActive(member, height) { continue }
		key, err := activeSnapshotConsensusKey(member, height); if err != nil { return "", err }
		validators = append(validators, map[string]any{
			"validatorId": member.ValidatorID,
			"identityUuid": member.IdentityUUID,
			"operatorOrg": member.OperatorOrg,
			"consensusKeyId": key.KeyID,
			"consensusPublicKeyDerB64": key.PublicKeyDerB64,
		})
	}
	if len(validators) == 0 { return "", fmt.Errorf("no ACTIVE validators at height %d", height) }
	sort.Slice(validators, func(i,j int) bool { return validators[i]["validatorId"].(string) < validators[j]["validatorId"].(string) })
	wrapped := map[string]any{"domain":validatorSetRootDomain,"profile":validatorSetProfile,"chainId":set.ChainID,"height":height,"validators":validators}
	normalized, err := canonicalValue(wrapped); if err != nil { return "", err }
	preimage, err := canonicalJSON(normalized); if err != nil { return "", err }
	digest := sha256.Sum256([]byte(preimage))
	return hex.EncodeToString(digest[:]), nil
}

func snapshotPayload(cert SnapshotTrustCertificate) snapshotCertificatePayload {
	return snapshotCertificatePayload{
		cert.Domain,cert.CertificateVersion,cert.ChainID,cert.SnapshotHeight,cert.DIRHash,cert.StateRoot,cert.ValidatorSetRoot,cert.ProtocolVersion,cert.StateManifestRoot,cert.SpatialManifestRoot,cert.EvidenceManifestRoot,
	}
}

func canonicalSnapshotPayload(cert SnapshotTrustCertificate) ([]byte,error) {
	normalized, err := canonicalValue(snapshotPayload(cert)); if err != nil { return nil, err }
	canonical, err := canonicalJSON(normalized); if err != nil { return nil, err }
	return []byte(canonical), nil
}

func requiredSnapshotQuorum(n int) (int,error) {
	if n < 1 { return 0, errors.New("snapshot requires at least one ACTIVE validator") }
	return (2*n)/3 + 1, nil
}

func verifySnapshotCertificate(set SnapshotValidatorSet, cert SnapshotTrustCertificate, expectedChainID, expectedValidatorSetRoot, expectedProtocolVersion string) (SnapshotVerification,error) {
	if cert.Domain != snapshotCertificateDomain || cert.CertificateVersion != snapshotCertificateVersion { return SnapshotVerification{}, errors.New("unsupported snapshot certificate domain/version") }
	if set.ChainID != expectedChainID || cert.ChainID != expectedChainID { return SnapshotVerification{}, errors.New("snapshot chainId mismatch") }
	if expectedProtocolVersion != "" && cert.ProtocolVersion != expectedProtocolVersion { return SnapshotVerification{}, errors.New("snapshot protocolVersion mismatch") }
	for label,value := range map[string]string{"DIRHash":cert.DIRHash,"stateRoot":cert.StateRoot,"validatorSetRoot":cert.ValidatorSetRoot,"stateManifestRoot":cert.StateManifestRoot,"SpatialManifestRoot":cert.SpatialManifestRoot,"evidenceManifestRoot":cert.EvidenceManifestRoot} {
		if !isSHA256(value) { return SnapshotVerification{}, fmt.Errorf("%s must be a lowercase SHA-256 digest", label) }
	}
	computedRoot, err := snapshotValidatorSetRoot(set, cert.SnapshotHeight); if err != nil { return SnapshotVerification{}, err }
	if computedRoot != expectedValidatorSetRoot { return SnapshotVerification{}, fmt.Errorf("trusted validator-set root mismatch: computed %s", computedRoot) }
	if cert.ValidatorSetRoot != computedRoot { return SnapshotVerification{}, errors.New("snapshot certificate does not bind the trusted validator-set root") }

	active := map[string]SnapshotValidator{}
	for _, member := range set.Members { if snapshotValidatorActive(member,cert.SnapshotHeight) { active[member.ValidatorID]=member } }
	required, err := requiredSnapshotQuorum(len(active)); if err != nil { return SnapshotVerification{}, err }
	payload, err := canonicalSnapshotPayload(cert); if err != nil { return SnapshotVerification{}, err }
	valid := map[string]bool{}
	for _, sig := range cert.Signatures {
		if valid[sig.SignerID] { continue }
		member, ok := active[sig.SignerID]; if !ok { continue }
		key, err := activeSnapshotConsensusKey(member,cert.SnapshotHeight); if err != nil { return SnapshotVerification{}, err }
		if sig.KeyID != key.KeyID || sig.Algorithm != "Ed25519" || sig.Domain != snapshotCertificateDomain { continue }
		der, err := base64.StdEncoding.DecodeString(key.PublicKeyDerB64); if err != nil { continue }
		parsed, err := x509.ParsePKIXPublicKey(der); if err != nil { continue }
		pub, ok := parsed.(ed25519.PublicKey); if !ok { continue }
		signature, err := base64.StdEncoding.DecodeString(sig.SignatureB64); if err != nil { continue }
		if ed25519.Verify(pub,payload,signature) { valid[sig.SignerID]=true }
	}
	validSigners := make([]string,0,len(valid)); for signer := range valid { validSigners=append(validSigners,signer) }; sort.Strings(validSigners)
	if len(validSigners) < required { return SnapshotVerification{}, fmt.Errorf("snapshot PoVI quorum not met: %d/%d; %d required",len(validSigners),len(active),required) }
	return SnapshotVerification{true,cert.SnapshotHeight,cert.DIRHash,cert.StateRoot,computedRoot,cert.ProtocolVersion,len(active),required,validSigners},nil
}
