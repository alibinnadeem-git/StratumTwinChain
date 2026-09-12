package main

import (
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const peerFollowerLaunchdProfile = "STRATUM-PEER-FOLLOWER-LAUNCHD/1"
const peerFollowerLaunchdLabel = "com.stratum.validator-follower"
const peerFollowerLaunchdPlistName = peerFollowerLaunchdLabel + ".plist"

type PeerFollowerLaunchdManifest struct {
	ProfileVersion         string   `json:"profileVersion"`
	PlistFile              string   `json:"plistFile"`
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

func launchdXMLString(value string) (string, error) {
	if strings.ContainsRune(value, '\x00') {
		return "", errors.New("launchd value contains NUL")
	}
	var b strings.Builder
	if err := xml.EscapeText(&b, []byte(value)); err != nil {
		return "", err
	}
	return b.String(), nil
}

func renderPeerFollowerLaunchdPlist(cfg BootstrapConfig, binaryPath, validatorDir, serviceUser, registryPath string, registryHeight int64, registryRoot string, targets []string, policyHash string, pollInterval, maxBackoff time.Duration) (string, error) {
	if cfg.State != candidateState || cfg.VoteAuthority {
		return "", errors.New("launchd follower package requires CANDIDATE state with voteAuthority=false")
	}
	if !filepath.IsAbs(binaryPath) || !filepath.IsAbs(validatorDir) || !filepath.IsAbs(registryPath) {
		return "", errors.New("launchd follower package requires absolute binary, validator-dir, and peer-registry paths")
	}
	if strings.TrimSpace(serviceUser) == "" || strings.ContainsAny(serviceUser, " \t/\\\r\n") {
		return "", errors.New("launchd follower package requires a simple non-empty service user")
	}
	if registryHeight < 0 || !isSHA256(strings.ToLower(registryRoot)) || !isSHA256(strings.ToLower(policyHash)) {
		return "", errors.New("launchd follower package requires valid registry height/root and governance policy hash")
	}
	if len(targets) == 0 {
		return "", errors.New("launchd follower package requires at least one peer target")
	}
	if pollInterval < time.Second || pollInterval > time.Hour || maxBackoff < pollInterval || maxBackoff > 6*time.Hour {
		return "", errors.New("launchd follower package polling/backoff values are outside managed follower limits")
	}

	args := []string{
		binaryPath,
		"peer-sync-follow",
		"--dir", validatorDir,
		"--peer-registry", registryPath,
		"--height", fmt.Sprintf("%d", registryHeight),
		"--peer-registry-root", strings.ToLower(registryRoot),
		"--targets", strings.Join(targets, ","),
		"--governance-policy-hash", strings.ToLower(policyHash),
		"--poll-interval", pollInterval.String(),
		"--max-backoff", maxBackoff.String(),
	}
	var argXML strings.Builder
	for _, arg := range args {
		escaped, err := launchdXMLString(arg)
		if err != nil {
			return "", err
		}
		argXML.WriteString("    <string>")
		argXML.WriteString(escaped)
		argXML.WriteString("</string>\n")
	}
	workingDir, err := launchdXMLString(validatorDir)
	if err != nil {
		return "", err
	}
	userName, err := launchdXMLString(serviceUser)
	if err != nil {
		return "", err
	}
	stdoutPath, err := launchdXMLString(filepath.Join(validatorDir, "logs", "follower.stdout.log"))
	if err != nil {
		return "", err
	}
	stderrPath, err := launchdXMLString(filepath.Join(validatorDir, "logs", "follower.stderr.log"))
	if err != nil {
		return "", err
	}
	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>%s</string>
  <key>ProgramArguments</key>
  <array>
%s  </array>
  <key>WorkingDirectory</key>
  <string>%s</string>
  <key>UserName</key>
  <string>%s</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>%s</string>
  <key>StandardErrorPath</key>
  <string>%s</string>
</dict>
</plist>
`, peerFollowerLaunchdLabel, argXML.String(), workingDir, userName, stdoutPath, stderrPath)
	plist = strings.ReplaceAll(plist, `\"`, `"`)
	return plist, nil
}

func writePeerFollowerLaunchdPackage(packageDir string, manifest PeerFollowerLaunchdManifest, plist string) error {
	if strings.TrimSpace(packageDir) == "" {
		return errors.New("launchd package directory is required")
	}
	if err := os.MkdirAll(packageDir, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(packageDir, peerFollowerLaunchdPlistName), []byte(plist), 0o600); err != nil {
		return err
	}
	install := `#!/bin/sh
set -eu
PLIST_SOURCE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/com.stratum.validator-follower.plist"
PLIST_TARGET="/Library/LaunchDaemons/com.stratum.validator-follower.plist"
install -o root -g wheel -m 0644 "$PLIST_SOURCE" "$PLIST_TARGET"
launchctl bootout system/com.stratum.validator-follower 2>/dev/null || true
launchctl bootstrap system "$PLIST_TARGET"
launchctl enable system/com.stratum.validator-follower
launchctl kickstart -k system/com.stratum.validator-follower
`
	uninstall := `#!/bin/sh
set -eu
launchctl bootout system/com.stratum.validator-follower 2>/dev/null || true
rm -f /Library/LaunchDaemons/com.stratum.validator-follower.plist
`
	if err := os.WriteFile(filepath.Join(packageDir, "install-launchd.sh"), []byte(install), 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(packageDir, "uninstall-launchd.sh"), []byte(uninstall), 0o700); err != nil {
		return err
	}
	manifest.PlistFile = peerFollowerLaunchdPlistName
	manifest.InstallScript = "install-launchd.sh"
	manifest.UninstallScript = "uninstall-launchd.sh"
	b, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(packageDir, "manifest.json"), append(b, '\n'), 0o600)
}

func peerFollowerLaunchdPackageCommand(args []string) error {
	fs := newFlagSet("peer-service-package-launchd")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	binaryPath := fs.String("binary", "", "absolute path to stratum-validator-bootstrap")
	packageDir := fs.String("package-dir", "", "output directory for reviewable launchd package")
	serviceUser := fs.String("service-user", "", "non-root macOS user that owns validator state")
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
		return errors.New("refusing launchd service package outside CANDIDATE/voteAuthority=false state")
	}
	targets := splitNonEmpty(*targetsRaw)
	plist, err := renderPeerFollowerLaunchdPlist(cfg, *binaryPath, *dir, *serviceUser, *registryPath, *height, *registryRoot, targets, *policyHash, *pollInterval, *maxBackoff)
	if err != nil {
		return err
	}
	manifest := PeerFollowerLaunchdManifest{
		ProfileVersion:         peerFollowerLaunchdProfile,
		ValidatorState:         cfg.State,
		VoteAuthority:          false,
		ConsensusParticipation: false,
		BinaryPath:             *binaryPath,
		ValidatorDir:           *dir,
		ServiceUser:            *serviceUser,
		PeerTargets:            targets,
		GeneratedAt:            time.Now().UTC().Format(time.RFC3339Nano),
	}
	if err := writePeerFollowerLaunchdPackage(*packageDir, manifest, plist); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(manifest, "", "  ")
	fmt.Println(string(out))
	return nil
}
