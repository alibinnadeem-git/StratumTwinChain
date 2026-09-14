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

const peerStateDiagnosticExportProfile = "STRATUM-PEER-STATE-DIAGNOSTIC-EXPORT/1"
const peerStateDiagnosticMaxFileBytes int64 = 16 * 1024 * 1024

type PeerStateDiagnosticFile struct {
	Name       string `json:"name"`
	SourcePath string `json:"sourcePath"`
	ExportPath string `json:"exportPath"`
	SizeBytes  int64  `json:"sizeBytes"`
	SHA256     string `json:"sha256"`
}

type PeerStateDiagnosticManifest struct {
	ProfileVersion          string                    `json:"profileVersion"`
	ChainID                 string                    `json:"chainId"`
	ValidatorID             string                    `json:"validatorId"`
	CreatedAt               string                    `json:"createdAt"`
	ConfigFingerprintSHA256 string                    `json:"configFingerprintSha256"`
	TransportPublicKeyHash  string                    `json:"transportPublicKeyHash,omitempty"`
	BundleDigestSHA256      string                    `json:"bundleDigestSha256,omitempty"`
	ConsensusAuthority      bool                      `json:"consensusAuthority"`
	ConsensusParticipation  bool                      `json:"consensusParticipation"`
	VoteAuthority           bool                      `json:"voteAuthority"`
	SourceMutation          bool                      `json:"sourceMutation"`
	PrivateKeysIncluded     bool                      `json:"privateKeysIncluded"`
	Health                  PeerStateHealthReport     `json:"health"`
	Files                   []PeerStateDiagnosticFile `json:"files"`
}

type peerStateDiagnosticSource struct {
	Name         string
	RelativePath string
}

func peerStateDiagnosticSources() []peerStateDiagnosticSource {
	return []peerStateDiagnosticSource{
		{Name: "trusted-head", RelativePath: filepath.Join("state", "peer-sync-head.json")},
		{Name: "peer-session-replay", RelativePath: filepath.Join("state", "peer-session.json")},
		{Name: "peer-evidence", RelativePath: filepath.Join("state", "peer-evidence.json")},
		{Name: "peer-quarantine", RelativePath: filepath.Join("state", "peer-quarantine.json")},
		{Name: "authenticated-peer-heads", RelativePath: filepath.Join("state", "peer-heads.json")},
		{Name: "follower-status", RelativePath: filepath.Join("state", "peer-follower-status.json")},
		{Name: "peer-reliability", RelativePath: filepath.Join("state", "peer-reliability.json")},
		{Name: "proof-cache-manifest", RelativePath: filepath.Join("state", "peer-proof-cache", peerProofCacheManifestName)},
	}
}

func diagnosticConfigFingerprint(cfg BootstrapConfig) (string, error) {
	encoded, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func diagnosticTransportPublicKeyHash(cfg BootstrapConfig) string {
	ref, ok := cfg.Keys["TRANSPORT"]
	if !ok || !isSHA256(ref.PublicKeyHash) {
		return ""
	}
	return strings.ToLower(ref.PublicKeyHash)
}

func pathWithin(parent, child string) (bool, error) {
	parentAbs, err := filepath.Abs(parent)
	if err != nil {
		return false, err
	}
	childAbs, err := filepath.Abs(child)
	if err != nil {
		return false, err
	}
	rel, err := filepath.Rel(parentAbs, childAbs)
	if err != nil {
		return false, err
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))), nil
}

func writePeerStateDiagnosticFile(path string, data []byte) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return syncParentDirectoryAfterRename(path)
}

func exportPeerStateDiagnostics(dir, outputDir string, cfg BootstrapConfig, now time.Time) (PeerStateDiagnosticManifest, error) {
	if strings.TrimSpace(outputDir) == "" {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic output directory must not be empty")
	}
	inside, err := pathWithin(dir, outputDir)
	if err != nil {
		return PeerStateDiagnosticManifest{}, err
	}
	if inside {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic output directory must be outside the validator data directory")
	}
	if _, err := os.Stat(outputDir); err == nil {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic output directory already exists; refusing to overwrite")
	} else if !os.IsNotExist(err) {
		return PeerStateDiagnosticManifest{}, err
	}

	configFingerprint, err := diagnosticConfigFingerprint(cfg)
	if err != nil {
		return PeerStateDiagnosticManifest{}, fmt.Errorf("fingerprint validator config: %w", err)
	}
	health := inspectPeerStateHealth(dir, cfg)
	manifest := PeerStateDiagnosticManifest{
		ProfileVersion:          peerStateDiagnosticExportProfile,
		ChainID:                 cfg.ChainID,
		ValidatorID:             cfg.ValidatorID,
		CreatedAt:               now.UTC().Format(time.RFC3339Nano),
		ConfigFingerprintSHA256: configFingerprint,
		TransportPublicKeyHash:  diagnosticTransportPublicKeyHash(cfg),
		ConsensusAuthority:      false,
		ConsensusParticipation:  false,
		VoteAuthority:           false,
		SourceMutation:          false,
		PrivateKeysIncluded:     false,
		Health:                  health,
		Files:                   []PeerStateDiagnosticFile{},
	}

	tmpDir := outputDir + ".tmp"
	if _, err := os.Stat(tmpDir); err == nil {
		return PeerStateDiagnosticManifest{}, errors.New("diagnostic temporary output directory already exists; refusing to overwrite")
	} else if !os.IsNotExist(err) {
		return PeerStateDiagnosticManifest{}, err
	}
	if err := os.MkdirAll(filepath.Join(tmpDir, "state"), 0o700); err != nil {
		return PeerStateDiagnosticManifest{}, err
	}
	cleanup := func() { _ = os.RemoveAll(tmpDir) }

	for _, source := range peerStateDiagnosticSources() {
		sourcePath := filepath.Join(dir, source.RelativePath)
		info, err := os.Stat(sourcePath)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			cleanup()
			return PeerStateDiagnosticManifest{}, err
		}
		if !info.Mode().IsRegular() {
			cleanup()
			return PeerStateDiagnosticManifest{}, fmt.Errorf("diagnostic source is not a regular file: %s", source.RelativePath)
		}
		if info.Size() > peerStateDiagnosticMaxFileBytes {
			cleanup()
			return PeerStateDiagnosticManifest{}, fmt.Errorf("diagnostic source exceeds %d-byte limit: %s", peerStateDiagnosticMaxFileBytes, source.RelativePath)
		}
		data, err := os.ReadFile(sourcePath)
		if err != nil {
			cleanup()
			return PeerStateDiagnosticManifest{}, err
		}
		digest := sha256.Sum256(data)
		exportPath := filepath.Join("state", source.Name+".json")
		fullExportPath := filepath.Join(tmpDir, exportPath)
		if err := os.MkdirAll(filepath.Dir(fullExportPath), 0o700); err != nil {
			cleanup()
			return PeerStateDiagnosticManifest{}, err
		}
		if err := writePeerStateDiagnosticFile(fullExportPath, data); err != nil {
			cleanup()
			return PeerStateDiagnosticManifest{}, err
		}
		manifest.Files = append(manifest.Files, PeerStateDiagnosticFile{
			Name:       source.Name,
			SourcePath: source.RelativePath,
			ExportPath: exportPath,
			SizeBytes:  int64(len(data)),
			SHA256:     hex.EncodeToString(digest[:]),
		})
	}
	sort.Slice(manifest.Files, func(i, j int) bool { return manifest.Files[i].Name < manifest.Files[j].Name })

	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	manifestPath := filepath.Join(tmpDir, "manifest.json")
	if err := writePeerStateDiagnosticFile(manifestPath, append(manifestBytes, '\n')); err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	if err := os.Rename(tmpDir, outputDir); err != nil {
		cleanup()
		return PeerStateDiagnosticManifest{}, err
	}
	if err := syncParentDirectoryAfterRename(outputDir); err != nil {
		return PeerStateDiagnosticManifest{}, err
	}
	return manifest, nil
}

func peerStateDiagnosticExportCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-export")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	outputDir := fs.String("output", "", "new diagnostic output directory outside validator data directory")
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
		return errors.New("peer-state-diagnostic-export requires CANDIDATE state with voteAuthority=false")
	}
	manifest, err := exportPeerStateDiagnostics(*dir, *outputDir, cfg, time.Now().UTC())
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
