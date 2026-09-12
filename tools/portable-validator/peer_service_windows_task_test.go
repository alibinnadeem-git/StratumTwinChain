package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWindowsAbsolutePathRecognition(t *testing.T) {
	for _, valid := range []string{`C:\Program Files\STRATUM\validator.exe`, `D:/stratum/state`, `\\server\share\registry.json`} {
		if !isWindowsAbsolutePath(valid) {
			t.Fatalf("expected Windows absolute path: %s", valid)
		}
	}
	for _, invalid := range []string{`validator.exe`, `\relative\path`, `/usr/local/bin/validator`} {
		if isWindowsAbsolutePath(invalid) {
			t.Fatalf("unexpected Windows absolute path: %s", invalid)
		}
	}
}

func TestQuoteWindowsCommandArg(t *testing.T) {
	cases := map[string]string{
		`plain`:                        `plain`,
		`C:\STRATUM\state`:            `C:\STRATUM\state`,
		`C:\Program Files\STRATUM`:    `"C:\Program Files\STRATUM"`,
		`value with "quoted" section`: `"value with \"quoted\" section"`,
		``:                             `""`,
	}
	for input, expected := range cases {
		if got := quoteWindowsCommandArg(input); got != expected {
			t.Fatalf("quoteWindowsCommandArg(%q)=%q want %q", input, got, expected)
		}
	}
}

func TestRenderPeerFollowerWindowsTaskScriptsIsCandidateOnly(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = false
	install, uninstall, err := renderPeerFollowerWindowsTaskScripts(
		cfg,
		`C:\Program Files\STRATUM\stratum-validator-bootstrap.exe`,
		`C:\ProgramData\STRATUM Validator`,
		`STRATUM\validator`,
		`C:\ProgramData\STRATUM Validator\peer-registry.json`,
		12,
		strings.Repeat("a", 64),
		[]string{"https://validator-a.example", "https://validator-b.example"},
		strings.Repeat("b", 64),
		15*time.Second,
		2*time.Minute,
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"peer-sync-follow",
		"New-ScheduledTaskTrigger -AtStartup",
		"Register-ScheduledTask",
		"-RunLevel Limited",
		"Get-Credential",
		"Credential user must match configured service user",
		"Start-ScheduledTask",
		"not a Windows SCM service",
	} {
		if !strings.Contains(install, required) {
			t.Fatalf("Windows startup package missing invariant %q", required)
		}
	}
	for _, forbidden := range []string{"peer-sync-governed", "serve-readonly-peer-sync-governed", "force-active", "sc.exe create", "New-Service"} {
		if strings.Contains(install, forbidden) {
			t.Fatalf("Windows startup task must not expose consensus/activation/fake-service surface %q", forbidden)
		}
	}
	if !strings.Contains(uninstall, "Unregister-ScheduledTask") {
		t.Fatal("Windows startup task uninstall script must unregister the scheduled task")
	}
}

func TestRenderPeerFollowerWindowsTaskScriptsRejectsUnsafeValidatorState(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = "ACTIVE"
	if _, _, err := renderPeerFollowerWindowsTaskScripts(cfg, `C:\stratum\validator.exe`, `C:\stratum\state`, `STRATUM\validator`, `C:\stratum\registry.json`, 1, strings.Repeat("a", 64), []string{"https://validator-a.example"}, strings.Repeat("b", 64), 15*time.Second, 2*time.Minute); err == nil {
		t.Fatal("Windows startup package must reject non-CANDIDATE state")
	}
	cfg.State = candidateState
	cfg.VoteAuthority = true
	if _, _, err := renderPeerFollowerWindowsTaskScripts(cfg, `C:\stratum\validator.exe`, `C:\stratum\state`, `STRATUM\validator`, `C:\stratum\registry.json`, 1, strings.Repeat("a", 64), []string{"https://validator-a.example"}, strings.Repeat("b", 64), 15*time.Second, 2*time.Minute); err == nil {
		t.Fatal("Windows startup package must reject voteAuthority=true")
	}
}

func TestWritePeerFollowerWindowsTaskPackageProducesReviewableArtifacts(t *testing.T) {
	packageDir := t.TempDir()
	manifest := PeerFollowerWindowsTaskManifest{
		ProfileVersion:         peerFollowerWindowsTaskProfile,
		TaskName:               peerFollowerWindowsTaskName,
		ValidatorState:         candidateState,
		VoteAuthority:          false,
		ConsensusParticipation: false,
		BinaryPath:             `C:\stratum\validator.exe`,
		ValidatorDir:           `C:\stratum\state`,
		ServiceUser:            `STRATUM\validator`,
		PeerTargets:            []string{"https://validator-a.example"},
		GeneratedAt:            time.Unix(100, 0).UTC().Format(time.RFC3339Nano),
	}
	if err := writePeerFollowerWindowsTaskPackage(packageDir, manifest, "install", "uninstall"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"install-windows-task.ps1", "uninstall-windows-task.ps1", "manifest.json"} {
		if _, err := os.Stat(filepath.Join(packageDir, name)); err != nil {
			t.Fatalf("missing Windows startup package artifact %s: %v", name, err)
		}
	}
}

func TestPowerShellSingleQuotedEscapesApostrophesAndRejectsNewlines(t *testing.T) {
	got, err := powershellSingleQuoted(`O'Brien`)
	if err != nil {
		t.Fatal(err)
	}
	if got != `'O''Brien'` {
		t.Fatalf("unexpected PowerShell quoting: %s", got)
	}
	if _, err := powershellSingleQuoted("bad\nvalue"); err == nil {
		t.Fatal("PowerShell value containing newline must be rejected")
	}
}
