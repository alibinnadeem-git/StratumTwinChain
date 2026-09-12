package main

import (
	"encoding/xml"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRenderPeerFollowerLaunchdPlistIsCandidateOnlyAndValidXML(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = candidateState
	cfg.VoteAuthority = false
	plist, err := renderPeerFollowerLaunchdPlist(
		cfg,
		"/opt/stratum/bin/stratum-validator-bootstrap",
		"/Users/validator/Library/Application Support/STRATUM",
		"validator",
		"/Users/validator/stratum/peer-registry.json",
		12,
		strings.Repeat("a", 64),
		[]string{"https://validator-a.example/path?a=1&b=2"},
		strings.Repeat("b", 64),
		15*time.Second,
		2*time.Minute,
	)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(plist, `\"`) {
		t.Fatal("launchd plist must not contain backslash-escaped XML attribute quotes")
	}
	if err := xml.Unmarshal([]byte(plist), new(any)); err != nil {
		t.Fatalf("launchd plist must be well-formed XML: %v", err)
	}
	for _, required := range []string{"com.stratum.validator-follower", "peer-sync-follow", "RunAtLoad", "KeepAlive", "UserName", "validator-a.example/path?a=1&amp;b=2"} {
		if !strings.Contains(plist, required) {
			t.Fatalf("launchd plist missing invariant %q", required)
		}
	}
	for _, forbidden := range []string{"peer-sync-governed", "force-active", ">activate<", ">PROPOSE<", ">COMMIT<"} {
		if strings.Contains(plist, forbidden) {
			t.Fatalf("launchd plist must not expose consensus/activation surface %q", forbidden)
		}
	}
}

func TestRenderPeerFollowerLaunchdPlistRejectsUnsafeValidatorState(t *testing.T) {
	cfg := testPeerSyncConfig()
	cfg.State = "ACTIVE"
	if _, err := renderPeerFollowerLaunchdPlist(cfg, "/opt/stratum/bin/stratum-validator-bootstrap", "/var/lib/stratum", "validator", "/etc/stratum/peer-registry.json", 1, strings.Repeat("a", 64), []string{"https://validator-a.example"}, strings.Repeat("b", 64), 15*time.Second, 2*time.Minute); err == nil {
		t.Fatal("launchd package must reject non-CANDIDATE state")
	}
	cfg.State = candidateState
	cfg.VoteAuthority = true
	if _, err := renderPeerFollowerLaunchdPlist(cfg, "/opt/stratum/bin/stratum-validator-bootstrap", "/var/lib/stratum", "validator", "/etc/stratum/peer-registry.json", 1, strings.Repeat("a", 64), []string{"https://validator-a.example"}, strings.Repeat("b", 64), 15*time.Second, 2*time.Minute); err == nil {
		t.Fatal("launchd package must reject voteAuthority=true")
	}
}

func TestWritePeerFollowerLaunchdPackageProducesReviewableDaemonArtifacts(t *testing.T) {
	packageDir := t.TempDir()
	manifest := PeerFollowerLaunchdManifest{
		ProfileVersion:         peerFollowerLaunchdProfile,
		ValidatorState:         candidateState,
		VoteAuthority:          false,
		ConsensusParticipation: false,
		BinaryPath:             "/opt/stratum/bin/stratum-validator-bootstrap",
		ValidatorDir:           "/var/lib/stratum-validator",
		ServiceUser:            "validator",
		PeerTargets:            []string{"https://validator-a.example"},
		GeneratedAt:            time.Unix(100, 0).UTC().Format(time.RFC3339Nano),
	}
	plist := `<?xml version="1.0"?><plist version="1.0"><dict/></plist>`
	if err := writePeerFollowerLaunchdPackage(packageDir, manifest, plist); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{peerFollowerLaunchdPlistName, "install-launchd.sh", "uninstall-launchd.sh", "manifest.json"} {
		if _, err := os.Stat(filepath.Join(packageDir, name)); err != nil {
			t.Fatalf("missing launchd package artifact %s: %v", name, err)
		}
	}
	install, err := os.ReadFile(filepath.Join(packageDir, "install-launchd.sh"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{"/Library/LaunchDaemons/com.stratum.validator-follower.plist", "launchctl bootstrap system", "launchctl enable system/com.stratum.validator-follower", "launchctl kickstart -k system/com.stratum.validator-follower"} {
		if !strings.Contains(string(install), required) {
			t.Fatalf("reviewable launchd installer missing %q", required)
		}
	}
}

func TestLaunchdXMLStringEscapesSpecialCharacters(t *testing.T) {
	got, err := launchdXMLString(`a&b<c>d"e`)
	if err != nil {
		t.Fatal(err)
	}
	if got != `a&amp;b&lt;c&gt;d&#34;e` && got != `a&amp;b&lt;c&gt;d&#34;e` {
		t.Fatalf("unexpected launchd XML escaping: %s", got)
	}
}
