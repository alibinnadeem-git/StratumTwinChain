package main

import (
	"os"
	"strings"
	"testing"
)

// The peer-state diagnostic bundle is operational evidence for sync/recovery.
// It must remain provenance-rich and non-authoritative: diagnostics may help an
// operator compare peers, but they must never grant vote or consensus authority.
func TestPeerSyncDiagnosticVerifierRetainsTrustBoundary(t *testing.T) {
	source, err := os.ReadFile("peer_state_diagnostic_verify.go")
	if err != nil {
		t.Fatalf("read diagnostic verifier source: %v", err)
	}
	text := string(source)

	for _, required := range []string{
		"PeerStateDiagnosticVerification",
		"ConfigFingerprintSHA256",
		"TransportPublicKeyHash",
		"verifyPeerStateDiagnosticBundle",
	} {
		if !strings.Contains(text, required) {
			t.Fatalf("diagnostic verifier lost required provenance field or verifier surface %q", required)
		}
	}

	for _, forbidden := range []string{
		"ConsensusAuthority: true",
		"VoteAuthority: true",
		"ConsensusParticipation: true",
	} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("diagnostic verifier must remain non-authoritative; found %q", forbidden)
		}
	}
}
