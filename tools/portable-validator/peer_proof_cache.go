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

const peerProofCacheProfile = "STRATUM-PEER-PROOF-CACHE/1"
const peerProofCacheMaxEntries = 64
const peerProofCacheMaxBytes int64 = 64 * 1024 * 1024

const peerProofCacheManifestName = "manifest.json"
const peerProofCacheFilePrefix = "verified-bundle-"

type PeerProofCacheEntry struct {
	CacheKey              string `json:"cacheKey"`
	FileName              string `json:"fileName"`
	FromHeight            int64  `json:"fromHeight"`
	ToHeight              int64  `json:"toHeight"`
	VerifiedDIRHash       string `json:"verifiedDIRHash"`
	SourcePeerValidatorID string `json:"sourcePeerValidatorId"`
	GovernancePolicyHash  string `json:"governancePolicyHash"`
	CachedAt              string `json:"cachedAt"`
	SizeBytes             int64  `json:"sizeBytes"`
}

type PeerProofCacheManifest struct {
	ProfileVersion            string                `json:"profileVersion"`
	ChainID                   string                `json:"chainId"`
	GenesisDIRHash            string                `json:"GenesisDIRHash"`
	ProtocolVersion           string                `json:"protocolVersion"`
	ConsensusAuthority        bool                  `json:"consensusAuthority"`
	CanonicalHistorySelection bool                  `json:"canonicalHistorySelection"`
	MaxEntries                int                   `json:"maxEntries"`
	MaxBytes                  int64                 `json:"maxBytes"`
	Entries                   []PeerProofCacheEntry `json:"entries"`
}

func defaultPeerProofCacheManifest(cfg BootstrapConfig) PeerProofCacheManifest {
	return PeerProofCacheManifest{
		ProfileVersion:            peerProofCacheProfile,
		ChainID:                   cfg.ChainID,
		GenesisDIRHash:            strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:           cfg.ProtocolVersion,
		ConsensusAuthority:        false,
		CanonicalHistorySelection: false,
		MaxEntries:                peerProofCacheMaxEntries,
		MaxBytes:                  peerProofCacheMaxBytes,
		Entries:                   []PeerProofCacheEntry{},
	}
}

func peerProofCacheDirFromSyncHeadPath(syncHeadPath string) string {
	if strings.TrimSpace(syncHeadPath) == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(syncHeadPath), "peer-proof-cache")
}

func validatePeerProofCacheManifest(manifest PeerProofCacheManifest, cfg BootstrapConfig) error {
	if manifest.ProfileVersion != peerProofCacheProfile || manifest.ChainID != cfg.ChainID || !strings.EqualFold(manifest.GenesisDIRHash, cfg.GenesisDIRHash) || manifest.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("peer proof cache trust context mismatch")
	}
	if manifest.ConsensusAuthority {
		return errors.New("peer proof cache must never carry consensus authority")
	}
	if manifest.CanonicalHistorySelection {
		return errors.New("peer proof cache must never select canonical history")
	}
	if manifest.MaxEntries != peerProofCacheMaxEntries || manifest.MaxBytes != peerProofCacheMaxBytes {
		return errors.New("peer proof cache retention limits do not match implementation profile")
	}
	for _, entry := range manifest.Entries {
		if !isSHA256(strings.ToLower(entry.CacheKey)) || !isSHA256(strings.ToLower(entry.VerifiedDIRHash)) || !isSHA256(strings.ToLower(entry.GovernancePolicyHash)) {
			return errors.New("peer proof cache entry contains invalid SHA-256 metadata")
		}
		if entry.FromHeight < 0 || entry.ToHeight <= entry.FromHeight || entry.SizeBytes <= 0 || !safePeerProofCacheFileName(entry.FileName) {
			return errors.New("peer proof cache entry contains invalid range, size, or file name")
		}
	}
	return nil
}

func loadPeerProofCacheManifest(cacheDir string, cfg BootstrapConfig) (PeerProofCacheManifest, error) {
	manifest := defaultPeerProofCacheManifest(cfg)
	if strings.TrimSpace(cacheDir) == "" {
		return manifest, nil
	}
	path := filepath.Join(cacheDir, peerProofCacheManifestName)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return manifest, nil
	} else if err != nil {
		return PeerProofCacheManifest{}, err
	}
	if err := readJSON(path, &manifest); err != nil {
		return PeerProofCacheManifest{}, err
	}
	if manifest.Entries == nil {
		manifest.Entries = []PeerProofCacheEntry{}
	}
	if err := validatePeerProofCacheManifest(manifest, cfg); err != nil {
		return PeerProofCacheManifest{}, err
	}
	return manifest, nil
}

func savePeerProofCacheManifestAtomic(cacheDir string, manifest PeerProofCacheManifest, cfg BootstrapConfig) error {
	if strings.TrimSpace(cacheDir) == "" {
		return nil
	}
	if err := validatePeerProofCacheManifest(manifest, cfg); err != nil {
		return err
	}
	if err := os.MkdirAll(cacheDir, 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(cacheDir, peerProofCacheManifestName)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(b, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func safePeerProofCacheFileName(name string) bool {
	return filepath.Base(name) == name && strings.HasPrefix(name, peerProofCacheFilePrefix) && strings.HasSuffix(strings.ToLower(name), ".json")
}

func writePeerProofCacheBundleAtomic(cacheDir, fileName string, data []byte) error {
	if !safePeerProofCacheFileName(fileName) {
		return errors.New("refusing unsafe peer proof cache file name")
	}
	if err := os.MkdirAll(cacheDir, 0o700); err != nil {
		return err
	}
	path := filepath.Join(cacheDir, fileName)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func peerProofCachePrunePlan(manifest PeerProofCacheManifest) (PeerProofCacheManifest, []string) {
	entries := append([]PeerProofCacheEntry{}, manifest.Entries...)
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].CachedAt != entries[j].CachedAt {
			return entries[i].CachedAt < entries[j].CachedAt
		}
		if entries[i].ToHeight != entries[j].ToHeight {
			return entries[i].ToHeight < entries[j].ToHeight
		}
		return entries[i].CacheKey < entries[j].CacheKey
	})
	var total int64
	for _, entry := range entries {
		total += entry.SizeBytes
	}
	removed := []string{}
	for len(entries) > peerProofCacheMaxEntries || total > peerProofCacheMaxBytes {
		entry := entries[0]
		entries = entries[1:]
		total -= entry.SizeBytes
		if safePeerProofCacheFileName(entry.FileName) {
			removed = append(removed, entry.FileName)
		}
	}
	manifest.Entries = entries
	return manifest, removed
}

func deletePeerProofCacheFiles(cacheDir string, fileNames []string) {
	for _, name := range fileNames {
		if !safePeerProofCacheFileName(name) {
			continue
		}
		_ = os.Remove(filepath.Join(cacheDir, name))
	}
}

func cacheVerifiedGovernedProofBundle(cacheDir string, cfg BootstrapConfig, bundle PeerSyncGovernedProofBundle, verifiedHead PeerSyncTrustedHead, sourcePeerValidatorID, trustedPolicyHash string, now time.Time) error {
	if strings.TrimSpace(cacheDir) == "" {
		return nil
	}
	if bundle.ProfileVersion != peerSyncProfile || bundle.ResponseType != "SYNC_PROOF" || bundle.ChainID != cfg.ChainID || !strings.EqualFold(bundle.GenesisDIRHash, cfg.GenesisDIRHash) || bundle.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("refusing peer proof cache write for foreign or invalid proof bundle context")
	}
	if len(bundle.FinalityProofs) == 0 {
		return errors.New("refusing peer proof cache write for empty proof bundle")
	}
	trustedPolicyHash = strings.ToLower(strings.TrimSpace(trustedPolicyHash))
	if !isSHA256(trustedPolicyHash) {
		return errors.New("peer proof cache requires independently trusted governance policy hash")
	}
	sourcePeerValidatorID = strings.TrimSpace(sourcePeerValidatorID)
	if sourcePeerValidatorID == "" {
		return errors.New("peer proof cache requires authenticated source peer identity")
	}
	fromHeight := bundle.FinalityProofs[0].Header.Height - 1
	toHeight := bundle.FinalityProofs[len(bundle.FinalityProofs)-1].Header.Height
	if fromHeight < 0 || toHeight <= fromHeight || verifiedHead.Height != toHeight || !isSHA256(strings.ToLower(verifiedHead.DIRHash)) {
		return errors.New("peer proof cache bundle range does not match verified terminal head")
	}
	data, err := json.Marshal(bundle)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(data)
	cacheKey := hex.EncodeToString(digest[:])
	manifest, err := loadPeerProofCacheManifest(cacheDir, cfg)
	if err != nil {
		return err
	}
	for _, entry := range manifest.Entries {
		if entry.CacheKey == cacheKey {
			return nil
		}
	}
	fileName := fmt.Sprintf("%s%020d-%020d-%s.json", peerProofCacheFilePrefix, fromHeight, toHeight, cacheKey)
	if err := writePeerProofCacheBundleAtomic(cacheDir, fileName, data); err != nil {
		return err
	}
	manifest.Entries = append(manifest.Entries, PeerProofCacheEntry{
		CacheKey:              cacheKey,
		FileName:              fileName,
		FromHeight:            fromHeight,
		ToHeight:              toHeight,
		VerifiedDIRHash:       strings.ToLower(verifiedHead.DIRHash),
		SourcePeerValidatorID: sourcePeerValidatorID,
		GovernancePolicyHash:  trustedPolicyHash,
		CachedAt:              now.UTC().Format(time.RFC3339Nano),
		SizeBytes:             int64(len(data)),
	})
	pruned, removed := peerProofCachePrunePlan(manifest)
	if err := savePeerProofCacheManifestAtomic(cacheDir, pruned, cfg); err != nil {
		return err
	}
	deletePeerProofCacheFiles(cacheDir, removed)
	return nil
}

func prunePeerProofCache(cacheDir string, cfg BootstrapConfig) (PeerProofCacheManifest, error) {
	manifest, err := loadPeerProofCacheManifest(cacheDir, cfg)
	if err != nil {
		return PeerProofCacheManifest{}, err
	}
	pruned, removed := peerProofCachePrunePlan(manifest)
	if err := savePeerProofCacheManifestAtomic(cacheDir, pruned, cfg); err != nil {
		return PeerProofCacheManifest{}, err
	}
	deletePeerProofCacheFiles(cacheDir, removed)
	return pruned, nil
}
