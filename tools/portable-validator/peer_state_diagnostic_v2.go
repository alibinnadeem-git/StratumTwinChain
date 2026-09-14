package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	peerStateDiagnosticExportProfileV2 = "STRATUM-PEER-STATE-DIAGNOSTIC-EXPORT/2"
	peerStateDiagnosticBundleDomainV2  = "STRATUM/PEER-STATE/DIAGNOSTIC-BUNDLE/2"
)

type peerStateDiagnosticManifestDigestPayload struct {
	ProfileVersion          string                    `json:"profileVersion"`
	ChainID                 string                    `json:"chainId"`
	ValidatorID             string                    `json:"validatorId"`
	CreatedAt               string                    `json:"createdAt"`
	ConfigFingerprintSHA256 string                    `json:"configFingerprintSha256"`
	TransportPublicKeyHash  string                    `json:"transportPublicKeyHash,omitempty"`
	ConsensusAuthority      bool                      `json:"consensusAuthority"`
	ConsensusParticipation  bool                      `json:"consensusParticipation"`
	VoteAuthority           bool                      `json:"voteAuthority"`
	SourceMutation          bool                      `json:"sourceMutation"`
	PrivateKeysIncluded     bool                      `json:"privateKeysIncluded"`
	Health                  PeerStateHealthReport     `json:"health"`
	Files                   []PeerStateDiagnosticFile `json:"files"`
}

func canonicalDiagnosticManifestDigestPayload(manifest PeerStateDiagnosticManifest) peerStateDiagnosticManifestDigestPayload {
	files := append([]PeerStateDiagnosticFile(nil), manifest.Files...)
	sort.Slice(files, func(i, j int) bool {
		if files[i].Name == files[j].Name {
			return filepath.ToSlash(files[i].ExportPath) < filepath.ToSlash(files[j].ExportPath)
		}
		return files[i].Name < files[j].Name
	})
	health := manifest.Health
	health.Entries = append([]PeerStateHealthEntry(nil), manifest.Health.Entries...)
	sort.Slice(health.Entries, func(i, j int) bool {
		if health.Entries[i].Name == health.Entries[j].Name {
			return filepath.ToSlash(health.Entries[i].Path) < filepath.ToSlash(health.Entries[j].Path)
		}
		return health.Entries[i].Name < health.Entries[j].Name
	})
	return peerStateDiagnosticManifestDigestPayload{
		ProfileVersion:          manifest.ProfileVersion,
		ChainID:                 manifest.ChainID,
		ValidatorID:             manifest.ValidatorID,
		CreatedAt:               manifest.CreatedAt,
		ConfigFingerprintSHA256: strings.ToLower(manifest.ConfigFingerprintSHA256),
		TransportPublicKeyHash:  strings.ToLower(manifest.TransportPublicKeyHash),
		ConsensusAuthority:      manifest.ConsensusAuthority,
		ConsensusParticipation:  manifest.ConsensusParticipation,
		VoteAuthority:           manifest.VoteAuthority,
		SourceMutation:          manifest.SourceMutation,
		PrivateKeysIncluded:     manifest.PrivateKeysIncluded,
		Health:                  health,
		Files:                   files,
	}
}

func peerStateDiagnosticBundleDigestV2(manifest PeerStateDiagnosticManifest) (string, error) {
	if manifest.ProfileVersion != peerStateDiagnosticExportProfileV2 {
		return "", errors.New("diagnostic bundle digest requires export profile /2")
	}
	payload, err := json.Marshal(canonicalDiagnosticManifestDigestPayload(manifest))
	if err != nil {
		return "", err
	}
	message := append([]byte(peerStateDiagnosticBundleDomainV2+"\n"), payload...)
	digest := sha256.Sum256(message)
	return hex.EncodeToString(digest[:]), nil
}

func finalizePeerStateDiagnosticManifestV2(manifest PeerStateDiagnosticManifest) (PeerStateDiagnosticManifest, error) {
	manifest.ProfileVersion = peerStateDiagnosticExportProfileV2
	manifest.BundleDigestSHA256 = ""
	digest, err := peerStateDiagnosticBundleDigestV2(manifest)
	if err != nil {
		return PeerStateDiagnosticManifest{}, err
	}
	manifest.BundleDigestSHA256 = digest
	return manifest, nil
}

func exportPeerStateDiagnosticsV2(dir, outputDir string, cfg BootstrapConfig, now time.Time) (PeerStateDiagnosticManifest, error) {
	if strings.TrimSpace(outputDir) == "" {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic output directory must not be empty")
	}
	if _, err := os.Stat(outputDir); err == nil {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic output directory already exists; refusing to overwrite")
	} else if !os.IsNotExist(err) {
		return PeerStateDiagnosticManifest{}, err
	}
	stagingDir := outputDir + ".v2-staging"
	if _, err := os.Stat(stagingDir); err == nil {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic v2 staging directory already exists; refusing to overwrite")
	} else if !os.IsNotExist(err) {
		return PeerStateDiagnosticManifest{}, err
	}
	manifest, err := exportPeerStateDiagnostics(dir, stagingDir, cfg, now)
	if err != nil {
		return PeerStateDiagnosticManifest{}, err
	}
	cleanup := func() { _ = os.RemoveAll(stagingDir) }
	manifest, err = finalizePeerStateDiagnosticManifestV2(manifest)
	if err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	if err := writePeerStateDiagnosticFile(filepath.Join(stagingDir, "manifest.json"), append(manifestBytes, '\n')); err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	if err := os.Rename(stagingDir, outputDir); err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	if err := syncParentDirectoryAfterRename(outputDir); err != nil {
		return PeerStateDiagnosticManifest{}, err
	}
	return manifest, nil
}

func peerStateDiagnosticExportV2Command(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-export-v2")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	outputDir := fs.String("output", "", "new version-2 diagnostic output directory outside validator data directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *outputDir == "" {
		return errors.New("--output is required")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return fmt.Errorf("read validator config: %w", err)
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("peer-state-diagnostic-export-v2 requires CANDIDATE state with voteAuthority=false")
	}
	manifest, err := exportPeerStateDiagnosticsV2(*dir, *outputDir, cfg, time.Now().UTC())
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
