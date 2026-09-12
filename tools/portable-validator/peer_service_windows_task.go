package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
	"unicode"
)

const peerFollowerWindowsTaskProfile = "STRATUM-PEER-FOLLOWER-WINDOWS-TASK/1"
const peerFollowerWindowsTaskName = "STRATUM Validator Candidate Follower"

type PeerFollowerWindowsTaskManifest struct {
	ProfileVersion         string   `json:"profileVersion"`
	InstallScript          string   `json:"installScript"`
	UninstallScript        string   `json:"uninstallScript"`
	TaskName               string   `json:"taskName"`
	ValidatorState         string   `json:"validatorState"`
	VoteAuthority          bool     `json:"voteAuthority"`
	ConsensusParticipation bool     `json:"consensusParticipation"`
	BinaryPath             string   `json:"binaryPath"`
	ValidatorDir           string   `json:"validatorDir"`
	ServiceUser            string   `json:"serviceUser"`
	PeerTargets            []string `json:"peerTargets"`
	GeneratedAt            string   `json:"generatedAt"`
}

func isWindowsAbsolutePath(value string) bool {
	if len(value) >= 3 && unicode.IsLetter(rune(value[0])) && value[1] == ':' && (value[2] == '\\' || value[2] == '/') {
		return true
	}
	return strings.HasPrefix(value, `\\`) && len(strings.TrimPrefix(value, `\\`)) > 0
}

func quoteWindowsCommandArg(value string) string {
	if value == "" {
		return `""`
	}
	needsQuotes := strings.IndexFunc(value, func(r rune) bool {
		return unicode.IsSpace(r) || r == '"'
	}) >= 0
	if !needsQuotes {
		return value
	}
	var b strings.Builder
	b.WriteByte('"')
	backslashes := 0
	for _, r := range value {
		if r == '\\' {
			backslashes++
			continue
		}
		if r == '"' {
			b.WriteString(strings.Repeat(`\`, backslashes*2+1))
			b.WriteRune('"')
			backslashes = 0
			continue
		}
		if backslashes > 0 {
			b.WriteString(strings.Repeat(`\`, backslashes))
			backslashes = 0
		}
		b.WriteRune(r)
	}
	if backslashes > 0 {
		b.WriteString(strings.Repeat(`\`, backslashes*2))
	}
	b.WriteByte('"')
	return b.String()
}

func powershellSingleQuoted(value string) (string, error) {
	if strings.ContainsRune(value, '\x00') || strings.ContainsAny(value, "\r\n") {
		return "", errors.New("PowerShell package value contains forbidden control characters")
	}
	return "'" + strings.ReplaceAll(value, "'", "''") + "'", nil
}

func renderPeerFollowerWindowsTaskScripts(cfg BootstrapConfig, binaryPath, validatorDir, serviceUser, registryPath string, registryHeight int64, registryRoot string, targets []string, policyHash string, pollInterval, maxBackoff time.Duration) (string, string, error) {
	if cfg.State != candidateState || cfg.VoteAuthority {
		return "", "", errors.New("Windows startup task package requires CANDIDATE state with voteAuthority=false")
	}
	if !isWindowsAbsolutePath(binaryPath) || !isWindowsAbsolutePath(validatorDir) || !isWindowsAbsolutePath(registryPath) {
		return "", "", errors.New("Windows startup task package requires absolute Windows binary, validator-dir, and peer-registry paths")
	}
	serviceUser = strings.TrimSpace(serviceUser)
	if serviceUser == "" || strings.ContainsAny(serviceUser, "\r\n") {
		return "", "", errors.New("Windows startup task package requires a non-empty service user")
	}
	if registryHeight < 0 || !isSHA256(strings.ToLower(registryRoot)) || !isSHA256(strings.ToLower(policyHash)) {
		return "", "", errors.New("Windows startup task package requires valid registry height/root and governance policy hash")
	}
	if len(targets) == 0 {
		return "", "", errors.New("Windows startup task package requires at least one peer target")
	}
	if pollInterval < time.Second || pollInterval > time.Hour || maxBackoff < pollInterval || maxBackoff > 6*time.Hour {
		return "", "", errors.New("Windows startup task package polling/backoff values are outside managed follower limits")
	}

	args := []string{
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
	quotedArgs := make([]string, 0, len(args))
	for _, arg := range args {
		quotedArgs = append(quotedArgs, quoteWindowsCommandArg(arg))
	}
	argumentLine := strings.Join(quotedArgs, " ")

	binaryPS, err := powershellSingleQuoted(binaryPath)
	if err != nil {
		return "", "", err
	}
	dirPS, err := powershellSingleQuoted(validatorDir)
	if err != nil {
		return "", "", err
	}
	argsPS, err := powershellSingleQuoted(argumentLine)
	if err != nil {
		return "", "", err
	}
	userPS, err := powershellSingleQuoted(serviceUser)
	if err != nil {
		return "", "", err
	}
	taskPS, _ := powershellSingleQuoted(peerFollowerWindowsTaskName)

	install := fmt.Sprintf(`# STRATUM CANDIDATE follower startup task package.
# This is Windows Task Scheduler auto-start packaging, not a Windows SCM service.
# It launches peer-sync-follow only and grants no ACTIVE/vote authority.
param(
  [System.Management.Automation.PSCredential]$Credential
)
$ErrorActionPreference = 'Stop'
$TaskName = %s
$ServiceUser = %s
if ($null -eq $Credential) {
  $Credential = Get-Credential -UserName $ServiceUser -Message 'Credential for STRATUM candidate follower startup task'
}
if ($Credential.UserName -ne $ServiceUser) {
  throw "Credential user must match configured service user: $ServiceUser"
}
$Action = New-ScheduledTaskAction -Execute %s -Argument %s -WorkingDirectory %s
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -RestartCount 12 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$Password = [System.Net.NetworkCredential]::new('', $Credential.Password).Password
try {
  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User $Credential.UserName -Password $Password -RunLevel Limited -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName
} finally {
  $Password = $null
}
`, taskPS, userPS, binaryPS, argsPS, dirPS)
	uninstall := fmt.Sprintf(`$ErrorActionPreference = 'Stop'
$TaskName = %s
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
`, taskPS)
	return install, uninstall, nil
}

func writePeerFollowerWindowsTaskPackage(packageDir string, manifest PeerFollowerWindowsTaskManifest, installScript, uninstallScript string) error {
	if strings.TrimSpace(packageDir) == "" {
		return errors.New("Windows startup task package directory is required")
	}
	if err := os.MkdirAll(packageDir, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(packageDir+string(os.PathSeparator)+"install-windows-task.ps1", []byte(installScript), 0o600); err != nil {
		return err
	}
	if err := os.WriteFile(packageDir+string(os.PathSeparator)+"uninstall-windows-task.ps1", []byte(uninstallScript), 0o600); err != nil {
		return err
	}
	manifest.InstallScript = "install-windows-task.ps1"
	manifest.UninstallScript = "uninstall-windows-task.ps1"
	b, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(packageDir+string(os.PathSeparator)+"manifest.json", append(b, '\n'), 0o600)
}

func peerFollowerWindowsTaskPackageCommand(args []string) error {
	fs := newFlagSet("peer-service-package-windows-task")
	dir := fs.String("dir", defaultHome(), "validator data directory containing config.json")
	binaryPath := fs.String("binary", "", "absolute Windows path to stratum-validator-bootstrap.exe")
	validatorDir := fs.String("windows-validator-dir", "", "absolute Windows validator data directory used by the scheduled task")
	packageDir := fs.String("package-dir", "", "output directory for reviewable Windows Task Scheduler package")
	serviceUser := fs.String("service-user", "", "Windows user that owns validator state, for example DOMAIN\\validator")
	registryPath := fs.String("peer-registry", "", "absolute Windows path to trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	registryRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	targetsRaw := fs.String("targets", "", "comma-separated peer base URLs")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned validator-governance policy SHA-256")
	pollInterval := fs.Duration("poll-interval", 15*time.Second, "successful follower polling interval")
	maxBackoff := fs.Duration("max-backoff", 2*time.Minute, "maximum retry delay after transient follower failure")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *binaryPath == "" || *validatorDir == "" || *packageDir == "" || *serviceUser == "" || *registryPath == "" || strings.TrimSpace(*targetsRaw) == "" {
		return errors.New("--binary, --windows-validator-dir, --package-dir, --service-user, --peer-registry and --targets are required")
	}
	var cfg BootstrapConfig
	if err := readJSON(*dir+string(os.PathSeparator)+"config.json", &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing Windows startup task package outside CANDIDATE/voteAuthority=false state")
	}
	targets := splitNonEmpty(*targetsRaw)
	install, uninstall, err := renderPeerFollowerWindowsTaskScripts(cfg, *binaryPath, *validatorDir, *serviceUser, *registryPath, *height, *registryRoot, targets, *policyHash, *pollInterval, *maxBackoff)
	if err != nil {
		return err
	}
	manifest := PeerFollowerWindowsTaskManifest{
		ProfileVersion:         peerFollowerWindowsTaskProfile,
		TaskName:               peerFollowerWindowsTaskName,
		ValidatorState:         cfg.State,
		VoteAuthority:          false,
		ConsensusParticipation: false,
		BinaryPath:             *binaryPath,
		ValidatorDir:           *validatorDir,
		ServiceUser:            *serviceUser,
		PeerTargets:            targets,
		GeneratedAt:            time.Now().UTC().Format(time.RFC3339Nano),
	}
	if err := writePeerFollowerWindowsTaskPackage(*packageDir, manifest, install, uninstall); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(manifest, "", "  ")
	fmt.Println(string(out))
	return nil
}
