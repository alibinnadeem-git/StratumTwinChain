package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const peerStateHealthProfile = "STRATUM-PEER-STATE-HEALTH/1"

type PeerStateHealthEntry struct {
	Name          string `json:"name"`
	Path          string `json:"path"`
	Status        string `json:"status"`
	SafeDefault   bool   `json:"safeDefault"`
	Authoritative bool   `json:"authoritative"`
	Error         string `json:"error,omitempty"`
}

type PeerStateHealthReport struct {
	ProfileVersion         string                 `json:"profileVersion"`
	ChainID                string                 `json:"chainId"`
	OverallStatus          string                 `json:"overallStatus"`
	InvalidCount           int                    `json:"invalidCount"`
	VoteAuthority          bool                   `json:"voteAuthority"`
	ConsensusParticipation bool                   `json:"consensusParticipation"`
	MutationPerformed      bool                   `json:"mutationPerformed"`
	Entries                []PeerStateHealthEntry `json:"entries"`
}

func peerStateHealthEntry(name, path string, safeDefault, authoritative bool, validate func() error) PeerStateHealthEntry {
	entry := PeerStateHealthEntry{Name: name, Path: path, SafeDefault: safeDefault, Authoritative: authoritative}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if safeDefault {
			entry.Status = "MISSING_SAFE_DEFAULT"
		} else {
			entry.Status = "MISSING_OPTIONAL"
		}
		return entry
	} else if err != nil {
		entry.Status = "INVALID"
		entry.Error = err.Error()
		return entry
	}
	if err := validate(); err != nil {
		entry.Status = "INVALID"
		entry.Error = err.Error()
		return entry
	}
	entry.Status = "VALID"
	return entry
}

func inspectPeerStateHealth(dir string, cfg BootstrapConfig) PeerStateHealthReport {
	stateDir := filepath.Join(dir, "state")
	syncHeadPath := filepath.Join(stateDir, "peer-sync-head.json")
	sessionPath := filepath.Join(stateDir, "peer-session.json")
	evidencePath := filepath.Join(stateDir, "peer-evidence.json")
	quarantinePath := filepath.Join(stateDir, "peer-quarantine.json")
	headPath := filepath.Join(stateDir, "peer-heads.json")
	followerStatusPath := filepath.Join(stateDir, "peer-follower-status.json")
	reliabilityPath := filepath.Join(stateDir, "peer-reliability.json")
	cacheDir := peerProofCacheDirFromSyncHeadPath(syncHeadPath)
	cacheManifestPath := filepath.Join(cacheDir, peerProofCacheManifestName)

	entries := []PeerStateHealthEntry{
		peerStateHealthEntry("trusted-head", syncHeadPath, true, true, func() error {
			_, err := loadPeerSyncTrustedHead(syncHeadPath, cfg)
			return err
		}),
		peerStateHealthEntry("peer-session-replay", sessionPath, true, false, func() error {
			_, err := loadPeerSessionState(sessionPath, cfg.ChainID)
			return err
		}),
		peerStateHealthEntry("peer-evidence", evidencePath, true, false, func() error {
			_, err := loadPeerEvidenceJournal(evidencePath, cfg)
			return err
		}),
		peerStateHealthEntry("peer-quarantine", quarantinePath, true, false, func() error {
			_, err := loadPeerQuarantineState(quarantinePath, cfg)
			return err
		}),
		peerStateHealthEntry("authenticated-peer-heads", headPath, true, false, func() error {
			_, err := loadPeerHeadState(headPath, cfg)
			return err
		}),
		peerStateHealthEntry("follower-status", followerStatusPath, false, false, func() error {
			_, err := loadPeerFollowerStatus(followerStatusPath, cfg)
			return err
		}),
		peerStateHealthEntry("peer-reliability", reliabilityPath, true, false, func() error {
			_, err := loadPeerReliabilityState(reliabilityPath, cfg)
			return err
		}),
		peerStateHealthEntry("proof-cache-manifest", cacheManifestPath, true, false, func() error {
			_, err := loadPeerProofCacheManifest(cacheDir, cfg)
			return err
		}),
	}

	report := PeerStateHealthReport{
		ProfileVersion:         peerStateHealthProfile,
		ChainID:                cfg.ChainID,
		OverallStatus:          "HEALTHY",
		VoteAuthority:          false,
		ConsensusParticipation: false,
		MutationPerformed:      false,
		Entries:                entries,
	}
	for _, entry := range entries {
		if entry.Status == "INVALID" {
			report.InvalidCount++
		}
	}
	if report.InvalidCount > 0 {
		report.OverallStatus = "INVALID_PERSISTED_STATE"
	}
	return report
}

func peerStateHealthCommand(args []string) error {
	fs := newFlagSet("peer-state-health")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*dir) == "" {
		return errors.New("--dir must not be empty")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return fmt.Errorf("read validator config: %w", err)
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("peer-state-health requires CANDIDATE state with voteAuthority=false")
	}
	report := inspectPeerStateHealth(*dir, cfg)
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	if report.InvalidCount > 0 {
		return errors.New("peer state health check found invalid persisted state; no mutation was performed")
	}
	return nil
}
