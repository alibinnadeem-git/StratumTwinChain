package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRenderPeerFollowerSystemdUnitIsCandidateOnly(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = false
	unit, err := renderPeerFollowerSystemdUnit(
		cfg,
		"/opt/stratum/bin/stratum-validator-bootstrap",
		"/var/lib/stratum-validator",
		"stratum-validator",
		"/etc/stratum/peer-registry.json",
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
	for _, required := range []string{"peer-sync-follow", "NoNewPrivileges=true", "ProtectSystem=strict", "vote authority"} {
		if !strings.Contains(unit, required) {
			t.Fatalf("systemd unit missing candidate-only service invariant %q", required)
		}
	}
	for _, forbidden := range []string{" peer-sync-governed ", " PROPOSE ", " COMMIT ", " activate ", " force-active "} {
		if strings.Contains(unit, forbidden) {
			t.Fatalf("systemd unit must not expose consensus/activation surface %q", forbidden)
		}
	}
}

func TestRenderPeerFollowerSystemdUnitRejectsVoteAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = true
	_, err := renderPeerFollowerSystemdUnit(cfg, "/opt/stratum/bin/stratum-validator-bootstrap", "/var/lib/stratum-validator", "stratum-validator", "/etc/stratum/peer-registry.json", 12, strings.Repeat("a", 64), []string{"https://validator-a.example"}, strings.Repeat("b", 64), 15*time.Second, 2*time.Minute)
	if err == nil {
		t.Fatal("systemd package must reject voteAuthority=true")
	}
}

func TestRenderPeerFollowerSystemdUnitRejectsActiveState(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = "ACTIVE"
	cfg.VoteAuthority = false
	_, err := renderPeerFollowerSystemdUnit(cfg, "/opt/stratum/bin/stratum-validator-bootstrap", "/var/lib/stratum-validator", "stratum-validator", "/etc/stratum/peer-registry.json", 12, strings.Repeat("a", 64), []string{"https://validator-a.example"}, strings.Repeat("b", 64), 15*time.Second, 2*time.Minute)
	if err == nil {
		t.Fatal("systemd package must reject non-CANDIDATE state")
	}
}

func TestWritePeerFollowerSystemdPackageProducesReviewableAutoStartArtifacts(t *testing.T) {
	packageDir := t.TempDir()
	manifest := PeerFollowerSystemdManifest{
		ProfileVersion:         peerFollowerSystemdProfile,
		ValidatorState:         candidateState,
		VoteAuthority:          false,
		ConsensusParticipation: false,
		BinaryPath:             "/opt/stratum/bin/stratum-validator-bootstrap",
		ValidatorDir:           "/var/lib/stratum-validator",
		ServiceUser:            "stratum-validator",
		PeerTargets:            []string{"https://validator-a.example"},
		GeneratedAt:            time.Unix(100, 0).UTC().Format(time.RFC3339Nano),
	}
	unit := "[Service]\nExecStart=\"/opt/stratum/bin/stratum-validator-bootstrap\" peer-sync-follow\n"
	if err := writePeerFollowerSystemdPackage(packageDir, manifest, unit); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{peerFollowerSystemdUnitName, "install-systemd.sh", "uninstall-systemd.sh", "manifest.json"} {
		if _, err := os.Stat(filepath.Join(packageDir, name)); err != nil {
			t.Fatalf("missing generated service package artifact %s: %v", name, err)
		}
	}
	install, err := os.ReadFile(filepath.Join(packageDir, "install-systemd.sh"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(install), "systemctl enable --now stratum-validator-follower.service") {
		t.Fatal("reviewable install script must explicitly implement systemd auto-start")
	}
}

func TestSafeSystemdValueEscapesPercentAndQuotes(t *testing.T) {
	value, err := safeSystemdValue(`/opt/STRATUM %i/validator "candidate"`)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(value, "%i") || !strings.Contains(value, "%%i") || !strings.Contains(value, `\\\"candidate\\\"`) {
		t.Fatalf("systemd value escaping is incomplete: %s", value)
	}
}
