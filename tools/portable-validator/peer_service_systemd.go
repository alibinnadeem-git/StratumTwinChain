package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const peerFollowerSystemdProfile = "STRATUM-PEER-FOLLOWER-SYSTEMD/1"
const peerFollowerSystemdUnitName = "stratum-validator-follower.service"

type PeerFollowerSystemdManifest struct {
	ProfileVersion         string   `json:"profileVersion"`
	ServiceUnit            string   `json:"serviceUnit"`
	InstallScript          string   `json:"installScript"`
	UninstallScript        string   `json:"uninstallScript"`
	ValidatorState         string   `json:"validatorState"`
	VoteAuthority          bool     `json:"voteAuthority"`
	ConsensusParticipation bool     `json:"consensusParticipation"`
	BinaryPath             string   `json:"binaryPath"`
	ValidatorDir           string   `json:"validatorDir"`
	ServiceUser            string   `json:"serviceUser"`
	PeerTargets            []string `json:"peerTargets"`
	GeneratedAt            string   `json:"generatedAt"`
}

func safeSystemdValue(value string) (string, error) {
	if strings.ContainsAny(value, "\x00\r\n") {
		return "", errors.New("systemd service value contains forbidden control characters")
	}
	value = strings.ReplaceAll(value, "%", "%%")
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, "\"", "\\\"")
	return "\"" + value + "\"", nil
}

func renderPeerFollowerSystemdUnit(cfg BootstrapConfig, binaryPath, validatorDir, serviceUser, registryPath string, registryHeight int64, registryRoot string, targets []string, policyHash string, pollInterval, maxBackoff time.Duration) (string, error) {
	if cfg.State != candidateState || cfg.VoteAuthority {
		return "", errors.New("systemd follower package requires CANDIDATE state with voteAuthority=false")
	}
	if !filepath.IsAbs(binaryPath) || !filepath.IsAbs(validatorDir) || !filepath.IsAbs(registryPath) {
		return "", errors.New("systemd follower package requires absolute binary, validator-dir, and peer-registry paths")
	}
	if strings.TrimSpace(serviceUser) == "" || strings.ContainsAny(serviceUser, " \t/\\\r\n") {
		return "", errors.New("systemd follower package requires a simple non-empty service user")
	}
	if registryHeight < 0 || !isSHA256(strings.ToLower(registryRoot)) || !isSHA256(strings.ToLower(policyHash)) {
		return "", errors.New("systemd follower package requires valid registry height/root and governance policy hash")
	}
	if len(targets) == 0 {
		return "", errors.New("systemd follower package requires at least one peer target")
	}
	if pollInterval < time.Second || pollInterval > time.Hour || maxBackoff < pollInterval || maxBackoff > 6*time.Hour {
		return "", errors.New("systemd follower package polling/backoff values are outside managed follower limits")
	}

	binaryQ, err := safeSystemdValue(binaryPath)
	if err != nil {
		return "", err
	}
	dirQ, err := safeSystemdValue(validatorDir)
	if err != nil {
		return "", err
	}
	registryQ, err := safeSystemdValue(registryPath)
	if err != nil {
		return "", err
	}
	targetsQ, err := safeSystemdValue(strings.Join(targets, ","))
	if err != nil {
		return "", err
	}
	rootQ, _ := safeSystemdValue(strings.ToLower(registryRoot))
	policyQ, _ := safeSystemdValue(strings.ToLower(policyHash))

	execStart := strings.Join([]string{
		binaryQ,
		"peer-sync-follow",
		"--dir", dirQ,
		"--peer-registry", registryQ,
		"--height", fmt.Sprintf("%d", registryHeight),
		"--peer-registry-root", rootQ,
		"--targets", targetsQ,
		"--governance-policy-hash", policyQ,
		"--poll-interval", pollInterval.String(),
		"--max-backoff", maxBackoff.String(),
	}, " ")

	unit := fmt.Sprintf(`[Unit]
Description=STRATUM candidate proof-verifying follower
Documentation=https://github.com/alibinnadeem-git/StratumTwinChain
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=%s
WorkingDirectory=%s
ExecStart=%s
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=%s
UMask=0077

# Safety boundary: this service runs peer-sync-follow only.
# It does not grant ACTIVE state or vote authority and exposes no consensus command.

[Install]
WantedBy=multi-user.target
`, serviceUser, dirQ, execStart, dirQ)
	return unit, nil
}

func writePeerFollowerSystemdPackage(packageDir string, manifest PeerFollowerSystemdManifest, unit string) error {
	if strings.TrimSpace(packageDir) == "" {
		return errors.New("systemd package directory is required")
	}
	if err := os.MkdirAll(packageDir, 0o700); err != nil {
		return err
	}
	unitPath := filepath.Join(packageDir, peerFollowerSystemdUnitName)
	if err := os.WriteFile(unitPath, []byte(unit), 0o600); err != nil {
		return err
	}
	install := `#!/bin/sh
set -eu
UNIT_SOURCE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/stratum-validator-follower.service"
UNIT_TARGET="/etc/systemd/system/stratum-validator-follower.service"
install -o root -g root -m 0644 "$UNIT_SOURCE" "$UNIT_TARGET"
systemctl daemon-reload
systemctl enable --now stratum-validator-follower.service
`
	uninstall := `#!/bin/sh
set -eu
systemctl disable --now stratum-validator-follower.service 2>/dev/null || true
rm -f /etc/systemd/system/stratum-validator-follower.service
systemctl daemon-reload
`
	if err := os.WriteFile(filepath.Join(packageDir, "install-systemd.sh"), []byte(install), 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(packageDir, "uninstall-systemd.sh"), []byte(uninstall), 0o700); err != nil {
		return err
	}
	manifest.ServiceUnit = peerFollowerSystemdUnitName
	manifest.InstallScript = "install-systemd.sh"
	manifest.UninstallScript = "uninstall-systemd.sh"
	b, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(packageDir, "manifest.json"), append(b, '\n'), 0o600)
}

func peerFollowerSystemdPackageCommand(args []string) error {
	fs := newFlagSet("peer-service-package-systemd")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	binaryPath := fs.String("binary", "", "absolute path to stratum-validator-bootstrap")
	packageDir := fs.String("package-dir", "", "output directory for reviewable systemd package")
	serviceUser := fs.String("service-user", "", "non-root operating-system user that owns validator state")
	registryPath := fs.String("peer-registry", "", "absolute path to trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	registryRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	targetsRaw := fs.String("targets", "", "comma-separated peer base URLs")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned validator-governance policy SHA-256")
	pollInterval := fs.Duration("poll-interval", 15*time.Second, "successful follower polling interval")
	maxBackoff := fs.Duration("max-backoff", 2*time.Minute, "maximum retry delay after transient follower failure")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *binaryPath == "" || *packageDir == "" || *serviceUser == "" || *registryPath == "" || strings.TrimSpace(*targetsRaw) == "" {
		return errors.New("--binary, --package-dir, --service-user, --peer-registry and --targets are required")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing service package outside CANDIDATE/voteAuthority=false state")
	}
	targets := splitNonEmpty(*targetsRaw)
	unit, err := renderPeerFollowerSystemdUnit(cfg, *binaryPath, *dir, *serviceUser, *registryPath, *height, *registryRoot, targets, *policyHash, *pollInterval, *maxBackoff)
	if err != nil {
		return err
	}
	manifest := PeerFollowerSystemdManifest{
		ProfileVersion:         peerFollowerSystemdProfile,
		ValidatorState:         cfg.State,
		VoteAuthority:          false,
		ConsensusParticipation: false,
		BinaryPath:             *binaryPath,
		ValidatorDir:           *dir,
		ServiceUser:            *serviceUser,
		PeerTargets:            targets,
		GeneratedAt:            time.Now().UTC().Format(time.RFC3339Nano),
	}
	if err := writePeerFollowerSystemdPackage(*packageDir, manifest, unit); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(manifest, "", "  ")
	fmt.Println(string(out))
	return nil
}
