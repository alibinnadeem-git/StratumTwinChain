package main

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

const (
	bootstrapTrustBundleVersion = "STRATUM-BOOTSTRAP-TRUST/1"
	bootstrapTrustHashDomain    = "STRATUM/BOOTSTRAP/TRUST/1"
	bootstrapTrustHashProfile   = "STRATUM-BOOTSTRAP-TRUST-HASH/1"
	genesisCertificateVersion   = "STRATUM-GENESIS-CERT/1"
	genesisCertificateDomain    = "STRATUM/GENESIS/CERT/1"
)

type BootstrapRootKey struct {
	RootID          string  `json:"rootId"`
	KeyID           string  `json:"keyId"`
	Purpose         string  `json:"purpose"`
	Algorithm       string  `json:"algorithm"`
	PublicKeyDerB64 string  `json:"publicKeyDerB64"`
	State           string  `json:"state"`
	ValidFrom       string  `json:"validFrom"`
	ValidUntil      *string `json:"validUntil"`
}

type BootstrapTrustBundle struct {
	BundleVersion string             `json:"bundleVersion"`
	ChainID       string             `json:"chainId"`
	PolicyID      string             `json:"policyId"`
	Threshold     int                `json:"threshold"`
	Roots         []BootstrapRootKey `json:"roots"`
	ValidFrom     string             `json:"validFrom"`
	ValidUntil    *string            `json:"validUntil"`
}

type GenesisCertificateSignature struct {
	RootID       string `json:"rootId"`
	KeyID        string `json:"keyId"`
	Algorithm    string `json:"algorithm"`
	SignatureB64 string `json:"signatureB64"`
}

type GenesisTrustCertificate struct {
	Domain             string                        `json:"domain"`
	CertificateVersion string                        `json:"certificateVersion"`
	ChainID            string                        `json:"chainId"`
	GenesisDIRHash     string                        `json:"GenesisDIRHash"`
	ProtocolVersion    string                        `json:"protocolVersion"`
	IssuedAt           string                        `json:"issuedAt"`
	TrustBundleHash    string                        `json:"trustBundleHash"`
	Signatures         []GenesisCertificateSignature `json:"signatures"`
}

type GenesisTrustVerification struct {
	Valid               bool     `json:"valid"`
	ComputedBundleHash  string   `json:"computedBundleHash"`
	Threshold           int      `json:"threshold"`
	ValidSigners        []string `json:"validSigners"`
	GenesisDIRHash      string   `json:"GenesisDIRHash"`
	ChainID             string   `json:"chainId"`
}

func trustBundleHashFromMap(bundle map[string]any) (string, error) {
	wrapped := map[string]any{"domain": bootstrapTrustHashDomain, "profile": bootstrapTrustHashProfile, "bundle": bundle}
	preimage, err := canonicalJSON(wrapped)
	if err != nil { return "", err }
	return sha256Hex([]byte(preimage)), nil
}

func parseTime(value string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339Nano, value)
	if err != nil { return time.Time{}, fmt.Errorf("invalid RFC3339 timestamp %q: %w", value, err) }
	return t, nil
}

func validAt(issued time.Time, from string, until *string) bool {
	start, err := parseTime(from); if err != nil { return false }
	if issued.Before(start) { return false }
	if until == nil { return true }
	end, err := parseTime(*until); if err != nil { return false }
	return !issued.After(end)
}

func certificatePayload(cert GenesisTrustCertificate) map[string]any {
	return map[string]any{
		"domain": genesisCertificateDomain,
		"certificateVersion": genesisCertificateVersion,
		"chainId": cert.ChainID,
		"GenesisDIRHash": cert.GenesisDIRHash,
		"protocolVersion": cert.ProtocolVersion,
		"issuedAt": cert.IssuedAt,
		"trustBundleHash": cert.TrustBundleHash,
	}
}

func verifyGenesisTrust(bundlePath, certificatePath, pinnedBundleHash, expectedChainID, expectedGenesisHash, expectedProtocolVersion string) (GenesisTrustVerification, error) {
	bundleMap, err := readCanonicalJSON(bundlePath); if err != nil { return GenesisTrustVerification{}, err }
	computedBundleHash, err := trustBundleHashFromMap(bundleMap); if err != nil { return GenesisTrustVerification{}, err }
	if !isSHA256(strings.ToLower(pinnedBundleHash)) || computedBundleHash != strings.ToLower(pinnedBundleHash) { return GenesisTrustVerification{}, fmt.Errorf("bootstrap trust bundle pin mismatch: computed %s", computedBundleHash) }

	var bundle BootstrapTrustBundle
	if err := readJSON(bundlePath, &bundle); err != nil { return GenesisTrustVerification{}, err }
	if bundle.BundleVersion != bootstrapTrustBundleVersion { return GenesisTrustVerification{}, fmt.Errorf("unsupported bootstrap trust bundle version %q", bundle.BundleVersion) }
	if bundle.ChainID != expectedChainID { return GenesisTrustVerification{}, errors.New("bootstrap trust bundle chainId mismatch") }
	if bundle.Threshold < 1 { return GenesisTrustVerification{}, errors.New("bootstrap trust threshold must be positive") }
	activeRoots := 0; rootIDs := map[string]bool{}; keyIDs := map[string]bool{}
	for _, root := range bundle.Roots {
		if rootIDs[root.RootID] || keyIDs[root.KeyID] { return GenesisTrustVerification{}, errors.New("bootstrap trust bundle contains duplicate rootId/keyId") }
		rootIDs[root.RootID]=true; keyIDs[root.KeyID]=true
		if root.State == "ACTIVE" { activeRoots++ }
	}
	if bundle.Threshold > activeRoots { return GenesisTrustVerification{}, errors.New("bootstrap trust threshold exceeds ACTIVE roots") }

	var cert GenesisTrustCertificate
	if err := readJSON(certificatePath, &cert); err != nil { return GenesisTrustVerification{}, err }
	if cert.Domain != genesisCertificateDomain || cert.CertificateVersion != genesisCertificateVersion { return GenesisTrustVerification{}, errors.New("unsupported Genesis certificate domain/version") }
	if cert.ChainID != expectedChainID { return GenesisTrustVerification{}, errors.New("Genesis certificate chainId mismatch") }
	if cert.GenesisDIRHash != strings.ToLower(expectedGenesisHash) { return GenesisTrustVerification{}, errors.New("Genesis certificate hash mismatch") }
	if expectedProtocolVersion != "" && cert.ProtocolVersion != expectedProtocolVersion { return GenesisTrustVerification{}, errors.New("Genesis certificate protocolVersion mismatch") }
	if cert.TrustBundleHash != computedBundleHash { return GenesisTrustVerification{}, errors.New("Genesis certificate does not bind the pinned bootstrap trust bundle") }
	issuedAt, err := parseTime(cert.IssuedAt); if err != nil { return GenesisTrustVerification{}, err }
	if !validAt(issuedAt,bundle.ValidFrom,bundle.ValidUntil) { return GenesisTrustVerification{}, errors.New("Genesis certificate issued outside bootstrap trust-bundle validity") }

	payloadText, err := canonicalJSON(certificatePayload(cert)); if err != nil { return GenesisTrustVerification{}, err }
	seen := map[string]bool{}; validSigners := []string{}
	for _, sig := range cert.Signatures {
		if seen[sig.RootID] { return GenesisTrustVerification{}, fmt.Errorf("duplicate Genesis signer %s", sig.RootID) }
		seen[sig.RootID]=true
		var root *BootstrapRootKey
		for i := range bundle.Roots { if bundle.Roots[i].RootID==sig.RootID && bundle.Roots[i].KeyID==sig.KeyID { root=&bundle.Roots[i]; break } }
		if root==nil || root.State!="ACTIVE" || root.Purpose!="GOVERNANCE" || root.Algorithm!="Ed25519" || sig.Algorithm!="Ed25519" { continue }
		if !validAt(issuedAt,root.ValidFrom,root.ValidUntil) { continue }
		der, err := base64.StdEncoding.DecodeString(root.PublicKeyDerB64); if err != nil { continue }
		parsed, err := x509.ParsePKIXPublicKey(der); if err != nil { continue }
		pub, ok := parsed.(ed25519.PublicKey); if !ok { continue }
		signature, err := base64.StdEncoding.DecodeString(sig.SignatureB64); if err != nil { continue }
		if ed25519.Verify(pub,[]byte(payloadText),signature) { validSigners=append(validSigners,root.RootID) }
	}
	sort.Strings(validSigners)
	if len(validSigners)<bundle.Threshold { return GenesisTrustVerification{}, fmt.Errorf("Genesis trust threshold not met: %d/%d",len(validSigners),bundle.Threshold) }
	return GenesisTrustVerification{true,computedBundleHash,bundle.Threshold,validSigners,cert.GenesisDIRHash,cert.ChainID},nil
}
