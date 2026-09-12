package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPeerProofCacheRejectsConsensusAuthority(t *testing.T) {
	cfg := testPeerSyncConfig()
	manifest := defaultPeerProofCacheManifest(cfg)
	manifest.ConsensusAuthority = true
	if err := validatePeerProofCacheManifest(manifest, cfg); err == nil {
		t.Fatal("peer proof cache must reject consensus authority")
	}
}

func TestPeerProofCacheRejectsCanonicalHistorySelection(t *testing.T) {
	cfg := testPeerSyncConfig()
	manifest := defaultPeerProofCacheManifest(cfg)
	manifest.CanonicalHistorySelection = true
	if err := validatePeerProofCacheManifest(manifest, cfg); err == nil {
		t.Fatal("peer proof cache must reject canonical history selection")
	}
}

func TestPeerProofCachePrunesOnlySafeCacheFiles(t *testing.T) {
	cfg := testPeerSyncConfig()
	cacheDir := t.TempDir()
	critical := filepath.Join(cacheDir, "peer-sync-head.json")
	if err := os.WriteFile(critical, []byte("critical"), 0o600); err != nil {
		t.Fatal(err)
	}
	manifest := defaultPeerProofCacheManifest(cfg)
	for i := 0; i < peerProofCacheMaxEntries+2; i++ {
		key := strings.Repeat(string(rune('a'+(i%6))), 64)
		if !isSHA256(key) {
			key = strings.Repeat("a", 64)
		}
		fileName := peerProofCacheFilePrefix + strings.Repeat("0", 40) + "-" + strings.Repeat("1", 40) + "-" + key + ".json"
		if err := os.WriteFile(filepath.Join(cacheDir, fileName), []byte("{}"), 0o600); err != nil {
			t.Fatal(err)
		}
		manifest.Entries = append(manifest.Entries, PeerProofCacheEntry{
			CacheKey:              key,
			FileName:              fileName,
			FromHeight:            int64(i),
			ToHeight:              int64(i + 1),
			VerifiedDIRHash:       strings.Repeat("b", 64),
			SourcePeerValidatorID: "validator-d",
			GovernancePolicyHash:  strings.Repeat("c", 64),
			CachedAt:              time.Unix(int64(i+1), 0).UTC().Format(time.RFC3339Nano),
			SizeBytes:             2,
		})
	}
	pruned, removed := peerProofCachePrunePlan(manifest)
	if len(pruned.Entries) != peerProofCacheMaxEntries {
		t.Fatalf("expected %d retained entries, got %d", peerProofCacheMaxEntries, len(pruned.Entries))
	}
	deletePeerProofCacheFiles(cacheDir, removed)
	if _, err := os.Stat(critical); err != nil {
		t.Fatalf("cache pruning must never delete unrelated/trust-critical files: %v", err)
	}
}

func TestPeerProofCachePrunesByByteCap(t *testing.T) {
	cfg := testPeerSyncConfig()
	manifest := defaultPeerProofCacheManifest(cfg)
	manifest.Entries = []PeerProofCacheEntry{
		{
			CacheKey:              strings.Repeat("a", 64),
			FileName:              peerProofCacheFilePrefix + "00000000000000000000-00000000000000000001-" + strings.Repeat("a", 64) + ".json",
			FromHeight:            0,
			ToHeight:              1,
			VerifiedDIRHash:       strings.Repeat("b", 64),
			SourcePeerValidatorID: "validator-a",
			GovernancePolicyHash:  strings.Repeat("c", 64),
			CachedAt:              time.Unix(1, 0).UTC().Format(time.RFC3339Nano),
			SizeBytes:             peerProofCacheMaxBytes,
		},
		{
			CacheKey:              strings.Repeat("d", 64),
			FileName:              peerProofCacheFilePrefix + "00000000000000000001-00000000000000000002-" + strings.Repeat("d", 64) + ".json",
			FromHeight:            1,
			ToHeight:              2,
			VerifiedDIRHash:       strings.Repeat("e", 64),
			SourcePeerValidatorID: "validator-b",
			GovernancePolicyHash:  strings.Repeat("f", 64),
			CachedAt:              time.Unix(2, 0).UTC().Format(time.RFC3339Nano),
			SizeBytes:             1,
		},
	}
	pruned, removed := peerProofCachePrunePlan(manifest)
	if len(pruned.Entries) != 1 || len(removed) != 1 || pruned.Entries[0].FromHeight != 1 {
		t.Fatalf("byte-cap pruning must remove oldest redundant bundle first: pruned=%+v removed=%+v", pruned.Entries, removed)
	}
}

func TestPeerProofCacheRejectsForeignTrustContext(t *testing.T) {
	cfg := testPeerSyncConfig()
	foreign := cfg
	foreign.ChainID = cfg.ChainID + "-foreign"
	manifest := defaultPeerProofCacheManifest(foreign)
	if err := validatePeerProofCacheManifest(manifest, cfg); err == nil {
		t.Fatal("foreign proof cache trust context must be rejected")
	}
}

func TestPeerProofCacheDeduplicatesVerifiedBundle(t *testing.T) {
	cfg := testPeerSyncConfig()
	cacheDir := t.TempDir()
	bundle := PeerSyncGovernedProofBundle{
		ProfileVersion:      peerSyncProfile,
		ResponseType:        "SYNC_PROOF",
		ChainID:             cfg.ChainID,
		GenesisDIRHash:      cfg.GenesisDIRHash,
		ProtocolVersion:     cfg.ProtocolVersion,
		ValidatorSet:        SnapshotValidatorSet{ChainID: cfg.ChainID},
		FinalityProofs:      []DIRFinalityProof{{Header: DIRHeader{Height: 1}}},
		GeneratedAt:         time.Unix(10, 0).UTC().Format(time.RFC3339Nano),
	}
	verified := PeerSyncTrustedHead{Height: 1, DIRHash: strings.Repeat("a", 64)}
	policy := strings.Repeat("b", 64)
	if err := cacheVerifiedGovernedProofBundle(cacheDir, cfg, bundle, verified, "validator-d", policy, time.Unix(11, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	if err := cacheVerifiedGovernedProofBundle(cacheDir, cfg, bundle, verified, "validator-d", policy, time.Unix(12, 0).UTC()); err != nil {
		t.Fatal(err)
	}
	manifest, err := loadPeerProofCacheManifest(cacheDir, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Entries) != 1 {
		t.Fatalf("identical verified bundle must be deduplicated, got %d entries", len(manifest.Entries))
	}
}
