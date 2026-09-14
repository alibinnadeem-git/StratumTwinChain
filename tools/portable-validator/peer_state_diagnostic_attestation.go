package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	peerStateDiagnosticAttestationProfile = "STRATUM-PEER-STATE-DIAGNOSTIC-ATTESTATION/1"
	peerStateDiagnosticAttestationDomain  = "STRATUM/PEER-STATE/DIAGNOSTIC-ATTESTATION/1"
)

type PeerStateDiagnosticAttestation struct {
	ProfileVersion          string `json:"profileVersion"`
	Domain                  string `json:"domain"`
	BundleProfileVersion    string `json:"bundleProfileVersion"`
	BundleDigestSHA256      string `json:"bundleDigestSha256"`
	ChainID                 string `json:"chainId"`
	ValidatorID             string `json:"validatorId"`
	ConfigFingerprintSHA256 string `json:"configFingerprintSha256"`
	SignerPurpose           string `json:"signerPurpose"`
	SignerAlgorithm         string `json:"signerAlgorithm"`
	SignerKeyVersion        int    `json:"signerKeyVersion"`
	SignerPublicKeyHash     string `json:"signerPublicKeyHash"`
	SignerPublicKeyB64      string `json:"signerPublicKeyB64"`
	AttestedAt              string `json:"attestedAt"`
	ConsensusAuthority      bool   `json:"consensusAuthority"`
	CanonicalHistorySelect  bool   `json:"canonicalHistorySelection"`
	RecoveryAuthority       bool   `json:"recoveryAuthority"`
	VoteAuthority           bool   `json:"voteAuthority"`
	SignatureB64            string `json:"signatureB64"`
}

type peerStateDiagnosticAttestationPayload struct {
	ProfileVersion          string `json:"profileVersion"`
	Domain                  string `json:"domain"`
	BundleProfileVersion    string `json:"bundleProfileVersion"`
	BundleDigestSHA256      string `json:"bundleDigestSha256"`
	ChainID                 string `json:"chainId"`
	ValidatorID             string `json:"validatorId"`
	ConfigFingerprintSHA256 string `json:"configFingerprintSha256"`
	SignerPurpose           string `json:"signerPurpose"`
	SignerAlgorithm         string `json:"signerAlgorithm"`
	SignerKeyVersion        int    `json:"signerKeyVersion"`
	SignerPublicKeyHash     string `json:"signerPublicKeyHash"`
	SignerPublicKeyB64      string `json:"signerPublicKeyB64"`
	AttestedAt              string `json:"attestedAt"`
	ConsensusAuthority      bool   `json:"consensusAuthority"`
	CanonicalHistorySelect  bool   `json:"canonicalHistorySelection"`
	RecoveryAuthority       bool   `json:"recoveryAuthority"`
	VoteAuthority           bool   `json:"voteAuthority"`
}

type PeerStateDiagnosticAttestationVerification struct {
	ProfileVersion              string `json:"profileVersion"`
	BundleIntegrityVerified     bool   `json:"bundleIntegrityVerified"`
	BundleDigestVerified        bool   `json:"bundleDigestVerified"`
	CryptographicSignatureValid bool   `json:"cryptographicSignatureValid"`
	TrustedConfigUsed           bool   `json:"trustedConfigUsed"`
	AuthenticityEstablished     bool   `json:"authenticityEstablished"`
	ChainID                     string `json:"chainId"`
	ValidatorID                 string `json:"validatorId"`
	BundleDigestSHA256          string `json:"bundleDigestSha256"`
	SignerPublicKeyHash         string `json:"signerPublicKeyHash"`
	ConsensusAuthority          bool   `json:"consensusAuthority"`
	CanonicalHistorySelection   bool   `json:"canonicalHistorySelection"`
	RecoveryAuthority           bool   `json:"recoveryAuthority"`
	VoteAuthority               bool   `json:"voteAuthority"`
}

func diagnosticAttestationPayload(att PeerStateDiagnosticAttestation) peerStateDiagnosticAttestationPayload {
	return peerStateDiagnosticAttestationPayload{
		ProfileVersion:          att.ProfileVersion,
		Domain:                  att.Domain,
		BundleProfileVersion:    att.BundleProfileVersion,
		BundleDigestSHA256:      strings.ToLower(att.BundleDigestSHA256),
		ChainID:                 att.ChainID,
		ValidatorID:             att.ValidatorID,
		ConfigFingerprintSHA256: strings.ToLower(att.ConfigFingerprintSHA256),
		SignerPurpose:           att.SignerPurpose,
		SignerAlgorithm:         att.SignerAlgorithm,
		SignerKeyVersion:        att.SignerKeyVersion,
		SignerPublicKeyHash:     strings.ToLower(att.SignerPublicKeyHash),
		SignerPublicKeyB64:      att.SignerPublicKeyB64,
		AttestedAt:              att.AttestedAt,
		ConsensusAuthority:      att.ConsensusAuthority,
		CanonicalHistorySelect:  att.CanonicalHistorySelect,
		RecoveryAuthority:       att.RecoveryAuthority,
		VoteAuthority:           att.VoteAuthority,
	}
}

func diagnosticAttestationSigningDigest(att PeerStateDiagnosticAttestation) ([]byte, error) {
	payload, err := json.Marshal(diagnosticAttestationPayload(att))
	if err != nil {
		return nil, err
	}
	message := append([]byte(peerStateDiagnosticAttestationDomain+"\n"), payload...)
	digest := sha256.Sum256(message)
	return digest[:], nil
}

func transportPublicKeyFromRef(ref KeyRef) (ed25519.PublicKey, error) {
	if ref.Purpose != "TRANSPORT" || ref.Algorithm != "ED25519_TRANSPORT_IDENTITY" || ref.KeyVersion < 1 {
		return nil, errors.New("TRANSPORT key reference is not an approved Ed25519 transport identity")
	}
	if !isSHA256(ref.PublicKeyHash) || strings.TrimSpace(ref.PublicKeyB64) == "" {
		return nil, errors.New("TRANSPORT key reference is incomplete")
	}
	raw, err := base64.StdEncoding.DecodeString(ref.PublicKeyB64)
	if err != nil {
		return nil, fmt.Errorf("decode TRANSPORT public key: %w", err)
	}
	digest := sha256.Sum256(raw)
	if !strings.EqualFold(ref.PublicKeyHash, hex.EncodeToString(digest[:])) {
		return nil, errors.New("TRANSPORT public-key hash does not match configured public key")
	}
	parsed, err := x509.ParsePKIXPublicKey(raw)
	if err != nil {
		return nil, fmt.Errorf("parse TRANSPORT public key: %w", err)
	}
	pub, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("TRANSPORT public key is not Ed25519")
	}
	return pub, nil
}

func loadTransportPrivateKey(dir string, ref KeyRef) (ed25519.PrivateKey, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "keys", "private", "transport.pk8"))
	if err != nil {
		return nil, err
	}
	parsed, err := x509.ParsePKCS8PrivateKey(raw)
	if err != nil {
		return nil, fmt.Errorf("parse TRANSPORT private key: %w", err)
	}
	priv, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("TRANSPORT private key is not Ed25519")
	}
	configuredPub, err := transportPublicKeyFromRef(ref)
	if err != nil {
		return nil, err
	}
	derivedPub, ok := priv.Public().(ed25519.PublicKey)
	if !ok || !derivedPub.Equal(configuredPub) {
		return nil, errors.New("TRANSPORT private key does not match configured public identity")
	}
	return priv, nil
}

func createPeerStateDiagnosticAttestation(dir, bundleDir string, cfg BootstrapConfig, now time.Time) (PeerStateDiagnosticAttestation, error) {
	verification, err := verifyPeerStateDiagnosticBundle(bundleDir)
	if err != nil {
		return PeerStateDiagnosticAttestation{}, fmt.Errorf("verify diagnostic bundle before attestation: %w", err)
	}
	if verification.BundleProfileVersion != peerStateDiagnosticExportProfileV2 || !verification.BundleDigestVerified {
		return PeerStateDiagnosticAttestation{}, errors.New("diagnostic attestation requires a verified export profile /2 bundle")
	}
	configFingerprint, err := diagnosticConfigFingerprint(cfg)
	if err != nil {
		return PeerStateDiagnosticAttestation{}, err
	}
	if verification.ChainID != cfg.ChainID || verification.ValidatorID != cfg.ValidatorID || !strings.EqualFold(verification.ConfigFingerprintSHA256, configFingerprint) {
		return PeerStateDiagnosticAttestation{}, errors.New("diagnostic bundle does not match the attesting validator config")
	}
	ref, ok := cfg.Keys["TRANSPORT"]
	if !ok {
		return PeerStateDiagnosticAttestation{}, errors.New("TRANSPORT key is missing from validator config")
	}
	if verification.TransportPublicKeyHash == "" || !strings.EqualFold(verification.TransportPublicKeyHash, ref.PublicKeyHash) {
		return PeerStateDiagnosticAttestation{}, errors.New("diagnostic bundle TRANSPORT fingerprint does not match attesting validator config")
	}
	priv, err := loadTransportPrivateKey(dir, ref)
	if err != nil {
		return PeerStateDiagnosticAttestation{}, err
	}
	att := PeerStateDiagnosticAttestation{
		ProfileVersion:          peerStateDiagnosticAttestationProfile,
		Domain:                  peerStateDiagnosticAttestationDomain,
		BundleProfileVersion:    verification.BundleProfileVersion,
		BundleDigestSHA256:      verification.BundleDigestSHA256,
		ChainID:                 verification.ChainID,
		ValidatorID:             verification.ValidatorID,
		ConfigFingerprintSHA256: verification.ConfigFingerprintSHA256,
		SignerPurpose:           "TRANSPORT",
		SignerAlgorithm:         ref.Algorithm,
		SignerKeyVersion:        ref.KeyVersion,
		SignerPublicKeyHash:     strings.ToLower(ref.PublicKeyHash),
		SignerPublicKeyB64:      ref.PublicKeyB64,
		AttestedAt:              now.UTC().Format(time.RFC3339Nano),
		ConsensusAuthority:      false,
		CanonicalHistorySelect:  false,
		RecoveryAuthority:       false,
		VoteAuthority:           false,
	}
	digest, err := diagnosticAttestationSigningDigest(att)
	if err != nil {
		return PeerStateDiagnosticAttestation{}, err
	}
	att.SignatureB64 = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, digest))
	return att, nil
}

func verifyPeerStateDiagnosticAttestation(bundleDir, attestationPath string, trustedCfg *BootstrapConfig) (PeerStateDiagnosticAttestationVerification, error) {
	bundleVerification, err := verifyPeerStateDiagnosticBundle(bundleDir)
	if err != nil {
		return PeerStateDiagnosticAttestationVerification{}, fmt.Errorf("verify diagnostic bundle: %w", err)
	}
	if bundleVerification.BundleProfileVersion != peerStateDiagnosticExportProfileV2 || !bundleVerification.BundleDigestVerified {
		return PeerStateDiagnosticAttestationVerification{}, errors.New("diagnostic attestation verification requires a verified export profile /2 bundle")
	}
	var att PeerStateDiagnosticAttestation
	if err := readJSON(attestationPath, &att); err != nil {
		return PeerStateDiagnosticAttestationVerification{}, fmt.Errorf("read diagnostic attestation: %w", err)
	}
	if att.ProfileVersion != peerStateDiagnosticAttestationProfile || att.Domain != peerStateDiagnosticAttestationDomain {
		return PeerStateDiagnosticAttestationVerification{}, errors.New("unsupported diagnostic attestation profile/domain")
	}
	if att.ConsensusAuthority || att.CanonicalHistorySelect || att.RecoveryAuthority || att.VoteAuthority {
		return PeerStateDiagnosticAttestationVerification{}, errors.New("diagnostic attestation violates non-authority boundary")
	}
	if att.BundleProfileVersion != bundleVerification.BundleProfileVersion || !strings.EqualFold(att.BundleDigestSHA256, bundleVerification.BundleDigestSHA256) || att.ChainID != bundleVerification.ChainID || att.ValidatorID != bundleVerification.ValidatorID || !strings.EqualFold(att.ConfigFingerprintSHA256, bundleVerification.ConfigFingerprintSHA256) || !strings.EqualFold(att.SignerPublicKeyHash, bundleVerification.TransportPublicKeyHash) {
		return PeerStateDiagnosticAttestationVerification{}, errors.New("diagnostic attestation does not match verified bundle context")
	}
	ref := KeyRef{
		Purpose:       att.SignerPurpose,
		Algorithm:     att.SignerAlgorithm,
		PublicKeyB64:  att.SignerPublicKeyB64,
		PublicKeyHash: att.SignerPublicKeyHash,
		KeyVersion:    att.SignerKeyVersion,
	}
	pub, err := transportPublicKeyFromRef(ref)
	if err != nil {
		return PeerStateDiagnosticAttestationVerification{}, err
	}
	sig, err := base64.StdEncoding.DecodeString(att.SignatureB64)
	if err != nil {
		return PeerStateDiagnosticAttestationVerification{}, fmt.Errorf("decode diagnostic attestation signature: %w", err)
	}
	digest, err := diagnosticAttestationSigningDigest(att)
	if err != nil {
		return PeerStateDiagnosticAttestationVerification{}, err
	}
	if !ed25519.Verify(pub, digest, sig) {
		return PeerStateDiagnosticAttestationVerification{}, errors.New("diagnostic attestation signature verification failed")
	}

	authenticityEstablished := false
	trustedConfigUsed := trustedCfg != nil
	if trustedCfg != nil {
		trustedFingerprint, err := diagnosticConfigFingerprint(*trustedCfg)
		if err != nil {
			return PeerStateDiagnosticAttestationVerification{}, err
		}
		trustedRef, ok := trustedCfg.Keys["TRANSPORT"]
		if !ok {
			return PeerStateDiagnosticAttestationVerification{}, errors.New("trusted config is missing TRANSPORT key")
		}
		trustedPub, err := transportPublicKeyFromRef(trustedRef)
		if err != nil {
			return PeerStateDiagnosticAttestationVerification{}, fmt.Errorf("trusted config TRANSPORT key: %w", err)
		}
		if trustedCfg.ChainID != att.ChainID || trustedCfg.ValidatorID != att.ValidatorID || !strings.EqualFold(trustedFingerprint, att.ConfigFingerprintSHA256) || !strings.EqualFold(trustedRef.PublicKeyHash, att.SignerPublicKeyHash) || !trustedPub.Equal(pub) {
			return PeerStateDiagnosticAttestationVerification{}, errors.New("diagnostic attestation does not match independently supplied trusted config")
		}
		authenticityEstablished = true
	}

	return PeerStateDiagnosticAttestationVerification{
		ProfileVersion:              peerStateDiagnosticAttestationProfile,
		BundleIntegrityVerified:     bundleVerification.IntegrityVerified,
		BundleDigestVerified:        bundleVerification.BundleDigestVerified,
		CryptographicSignatureValid: true,
		TrustedConfigUsed:           trustedConfigUsed,
		AuthenticityEstablished:     authenticityEstablished,
		ChainID:                     att.ChainID,
		ValidatorID:                 att.ValidatorID,
		BundleDigestSHA256:          strings.ToLower(att.BundleDigestSHA256),
		SignerPublicKeyHash:         strings.ToLower(att.SignerPublicKeyHash),
		ConsensusAuthority:          false,
		CanonicalHistorySelection:   false,
		RecoveryAuthority:           false,
		VoteAuthority:               false,
	}, nil
}

func peerStateDiagnosticAttestCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-attest")
	dir := fs.String("dir", defaultHome(), "validator data directory containing the TRANSPORT private key")
	bundleDir := fs.String("bundle", "", "verified version-2 diagnostic bundle directory")
	output := fs.String("output", "", "new detached attestation JSON path outside validator and bundle directories")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*bundleDir) == "" || strings.TrimSpace(*output) == "" {
		return errors.New("--bundle and --output are required")
	}
	if inside, err := pathWithin(*dir, *output); err != nil {
		return err
	} else if inside {
		return errors.New("detached diagnostic attestation output must be outside validator data directory")
	}
	if inside, err := pathWithin(*bundleDir, *output); err != nil {
		return err
	} else if inside {
		return errors.New("detached diagnostic attestation output must be outside diagnostic bundle directory")
	}
	if _, err := os.Stat(*output); err == nil {
		return errors.New("diagnostic attestation output already exists; refusing to overwrite")
	} else if !os.IsNotExist(err) {
		return err
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return fmt.Errorf("read validator config: %w", err)
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("peer-state-diagnostic-attest requires CANDIDATE state with voteAuthority=false")
	}
	att, err := createPeerStateDiagnosticAttestation(*dir, *bundleDir, cfg, time.Now().UTC())
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(att, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(*output), 0o700); err != nil {
		return err
	}
	if err := writePeerStateDiagnosticFile(*output, append(encoded, '\n')); err != nil {
		return err
	}
	fmt.Println(string(encoded))
	return nil
}

func peerStateDiagnosticAttestationVerifyCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-attestation-verify")
	bundleDir := fs.String("bundle", "", "version-2 diagnostic bundle directory")
	attestationPath := fs.String("attestation", "", "detached diagnostic attestation JSON path")
	trustedConfigPath := fs.String("trusted-config", "", "optional independently trusted validator config used to establish signer authenticity")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*bundleDir) == "" || strings.TrimSpace(*attestationPath) == "" {
		return errors.New("--bundle and --attestation are required")
	}
	var trustedCfg *BootstrapConfig
	if strings.TrimSpace(*trustedConfigPath) != "" {
		var cfg BootstrapConfig
		if err := readJSON(*trustedConfigPath, &cfg); err != nil {
			return fmt.Errorf("read trusted validator config: %w", err)
		}
		trustedCfg = &cfg
	}
	verification, err := verifyPeerStateDiagnosticAttestation(*bundleDir, *attestationPath, trustedCfg)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(verification, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(encoded))
	return nil
}
