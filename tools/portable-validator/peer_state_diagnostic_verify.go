package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// peerStateDiagnosticVerifyProfile identifies integrity-only, non-authoritative diagnostic verification.
const peerStateDiagnosticVerifyProfile = "STRATUM-PEER-STATE-DIAGNOSTIC-VERIFY/1"

type PeerStateDiagnosticVerification struct {
	ProfileVersion          string `json:"profileVersion"`
	BundleProfileVersion    string `json:"bundleProfileVersion"`
	ChainID                 string `json:"chainId"`
	ValidatorID             string `json:"validatorId"`
	ConfigFingerprintSHA256 string `json:"configFingerprintSha256"`
	TransportPublicKeyHash  string `json:"transportPublicKeyHash,omitempty"`
	BundleDigestSHA256      string `json:"bundleDigestSha256,omitempty"`
	BundleDigestVerified    bool   `json:"bundleDigestVerified"`
	IntegrityVerified       bool   `json:"integrityVerified"`
	AuthenticityEstablished bool   `json:"authenticityEstablished"`
	ConsensusAuthority      bool   `json:"consensusAuthority"`
	FileCount               int    `json:"fileCount"`
}

func diagnosticPathHasForbiddenSegment(path string) bool {
	for _, segment := range strings.Split(filepath.ToSlash(path), "/") {
		if strings.EqualFold(segment, "keys") || strings.EqualFold(segment, "private") {
			return true
		}
	}
	return false
}

func verifyPeerStateDiagnosticBundle(bundleDir string) (PeerStateDiagnosticVerification, error) {
	if strings.TrimSpace(bundleDir) == "" {
		return PeerStateDiagnosticVerification{}, errors.New("diagnostic bundle directory must not be empty")
	}
	manifestPath := filepath.Join(bundleDir, "manifest.json")
	var manifest PeerStateDiagnosticManifest
	if err := readJSON(manifestPath, &manifest); err != nil {
		return PeerStateDiagnosticVerification{}, fmt.Errorf("read diagnostic manifest: %w", err)
	}
	switch manifest.ProfileVersion {
	case peerStateDiagnosticExportProfile:
		if manifest.BundleDigestSHA256 != "" {
			return PeerStateDiagnosticVerification{}, errors.New("diagnostic export profile /1 must not claim a version-2 bundle digest")
		}
	case peerStateDiagnosticExportProfileV2:
		if !isSHA256(manifest.BundleDigestSHA256) {
			return PeerStateDiagnosticVerification{}, errors.New("diagnostic export profile /2 requires a SHA-256 bundle digest")
		}
	default:
		return PeerStateDiagnosticVerification{}, errors.New("unsupported diagnostic export profile")
	}
	if !isSHA256(manifest.ConfigFingerprintSHA256) {
		return PeerStateDiagnosticVerification{}, errors.New("diagnostic config fingerprint must be a SHA-256 digest")
	}
	if manifest.TransportPublicKeyHash != "" && !isSHA256(manifest.TransportPublicKeyHash) {
		return PeerStateDiagnosticVerification{}, errors.New("diagnostic transport public-key hash must be empty or a SHA-256 digest")
	}
	if manifest.ConsensusAuthority || manifest.ConsensusParticipation || manifest.VoteAuthority || manifest.SourceMutation || manifest.PrivateKeysIncluded {
		return PeerStateDiagnosticVerification{}, errors.New("diagnostic manifest violates non-authority/private-key boundary")
	}
	if manifest.Health.VoteAuthority || manifest.Health.ConsensusParticipation || manifest.Health.MutationPerformed {
		return PeerStateDiagnosticVerification{}, errors.New("embedded state-health report violates non-authority/non-mutation boundary")
	}
	if manifest.Health.ProfileVersion != peerStateHealthProfile || manifest.Health.ChainID != manifest.ChainID {
		return PeerStateDiagnosticVerification{}, errors.New("embedded state-health trust context mismatch")
	}

	allowed := map[string]string{}
	for _, source := range peerStateDiagnosticSources() {
		allowed[source.Name] = filepath.Clean(source.RelativePath)
	}
	expectedPaths := map[string]bool{"manifest.json": true}
	seenNames := map[string]bool{}
	seenExports := map[string]bool{}
	for _, entry := range manifest.Files {
		if seenNames[entry.Name] {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("duplicate diagnostic file name: %s", entry.Name)
		}
		seenNames[entry.Name] = true
		expectedSource, ok := allowed[entry.Name]
		if !ok || filepath.Clean(entry.SourcePath) != expectedSource {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("diagnostic file is not in the allowlist: %s", entry.Name)
		}
		cleanExport := filepath.Clean(entry.ExportPath)
		if cleanExport == "." || filepath.IsAbs(cleanExport) || cleanExport == ".." || strings.HasPrefix(cleanExport, ".."+string(os.PathSeparator)) || diagnosticPathHasForbiddenSegment(cleanExport) {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("unsafe diagnostic export path: %s", entry.ExportPath)
		}
		if seenExports[cleanExport] {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("duplicate diagnostic export path: %s", cleanExport)
		}
		seenExports[cleanExport] = true
		fullPath := filepath.Join(bundleDir, cleanExport)
		inside, err := pathWithin(bundleDir, fullPath)
		if err != nil || !inside {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("diagnostic export path escapes bundle: %s", entry.ExportPath)
		}
		info, err := os.Lstat(fullPath)
		if err != nil {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("read diagnostic file %s: %w", entry.Name, err)
		}
		if !info.Mode().IsRegular() || info.Size() > peerStateDiagnosticMaxFileBytes {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("diagnostic file is not an acceptable regular file: %s", entry.Name)
		}
		data, err := os.ReadFile(fullPath)
		if err != nil {
			return PeerStateDiagnosticVerification{}, err
		}
		digest := sha256.Sum256(data)
		if entry.SizeBytes != int64(len(data)) || !strings.EqualFold(entry.SHA256, hex.EncodeToString(digest[:])) {
			return PeerStateDiagnosticVerification{}, fmt.Errorf("diagnostic file integrity mismatch: %s", entry.Name)
		}
		expectedPaths[filepath.ToSlash(cleanExport)] = true
	}

	if err := filepath.Walk(bundleDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if path == bundleDir {
			return nil
		}
		rel, err := filepath.Rel(bundleDir, path)
		if err != nil {
			return err
		}
		if diagnosticPathHasForbiddenSegment(rel) {
			return fmt.Errorf("diagnostic bundle contains forbidden path: %s", rel)
		}
		if info.IsDir() {
			return nil
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("diagnostic bundle contains non-regular file: %s", rel)
		}
		if !expectedPaths[filepath.ToSlash(rel)] {
			return fmt.Errorf("diagnostic bundle contains unexpected file: %s", rel)
		}
		return nil
	}); err != nil {
		return PeerStateDiagnosticVerification{}, err
	}

	bundleDigestVerified := false
	bundleDigest := ""
	if manifest.ProfileVersion == peerStateDiagnosticExportProfileV2 {
		expectedDigest, err := peerStateDiagnosticBundleDigestV2(manifest)
		if err != nil {
			return PeerStateDiagnosticVerification{}, err
		}
		if !strings.EqualFold(manifest.BundleDigestSHA256, expectedDigest) {
			return PeerStateDiagnosticVerification{}, errors.New("diagnostic bundle digest mismatch")
		}
		bundleDigestVerified = true
		bundleDigest = strings.ToLower(manifest.BundleDigestSHA256)
	}

	return PeerStateDiagnosticVerification{
		ProfileVersion:          peerStateDiagnosticVerifyProfile,
		BundleProfileVersion:    manifest.ProfileVersion,
		ChainID:                 manifest.ChainID,
		ValidatorID:             manifest.ValidatorID,
		ConfigFingerprintSHA256: strings.ToLower(manifest.ConfigFingerprintSHA256),
		TransportPublicKeyHash:  strings.ToLower(manifest.TransportPublicKeyHash),
		BundleDigestSHA256:      bundleDigest,
		BundleDigestVerified:    bundleDigestVerified,
		IntegrityVerified:       true,
		AuthenticityEstablished: false,
		ConsensusAuthority:      false,
		FileCount:               len(manifest.Files),
	}, nil
}

func peerStateDiagnosticVerifyCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-verify")
	bundleDir := fs.String("bundle", "", "diagnostic bundle directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *bundleDir == "" {
		return errors.New("--bundle is required")
	}
	verification, err := verifyPeerStateDiagnosticBundle(*bundleDir)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(verification, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
