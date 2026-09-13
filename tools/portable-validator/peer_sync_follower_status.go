package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const peerFollowerStatusProfile = "STRATUM-PEER-FOLLOWER-STATUS/1"

type PeerFollowerStatus struct {
	ProfileVersion          string `json:"profileVersion"`
	ChainID                 string `json:"chainId"`
	GenesisDIRHash          string `json:"GenesisDIRHash"`
	ProtocolVersion         string `json:"protocolVersion"`
	RuntimeState            string `json:"runtimeState"`
	LastClassification      string `json:"lastClassification,omitempty"`
	TrustedHeight           int64  `json:"trustedHeight"`
	TrustedDIRHash          string `json:"trustedDIRHash"`
	SelectedPeerValidatorID string `json:"selectedPeerValidatorId,omitempty"`
	ConsecutiveFailures     int    `json:"consecutiveFailures"`
	LastError               string `json:"lastError,omitempty"`
	LastCycleAt             string `json:"lastCycleAt,omitempty"`
	NextRetryAt             string `json:"nextRetryAt,omitempty"`
	UpdatedAt               string `json:"updatedAt"`
	VoteAuthority           bool   `json:"voteAuthority"`
	ConsensusParticipation  bool   `json:"consensusParticipation"`
}

func newPeerFollowerStatus(cfg BootstrapConfig, runtimeState string, now time.Time) PeerFollowerStatus {
	return PeerFollowerStatus{
		ProfileVersion:         peerFollowerStatusProfile,
		ChainID:                cfg.ChainID,
		GenesisDIRHash:         strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:        cfg.ProtocolVersion,
		RuntimeState:           runtimeState,
		UpdatedAt:              now.UTC().Format(time.RFC3339Nano),
		VoteAuthority:          false,
		ConsensusParticipation: false,
	}
}

func validatePeerFollowerStatus(status PeerFollowerStatus, cfg BootstrapConfig) error {
	if status.ProfileVersion != peerFollowerStatusProfile {
		return errors.New("unexpected follower status profile")
	}
	if status.ChainID != cfg.ChainID || !strings.EqualFold(status.GenesisDIRHash, cfg.GenesisDIRHash) || status.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("follower status trust context mismatch")
	}
	if status.VoteAuthority || status.ConsensusParticipation {
		return errors.New("follower status must remain non-voting and non-participating")
	}
	return nil
}

func savePeerFollowerStatusAtomic(path string, status PeerFollowerStatus, cfg BootstrapConfig) error {
	if path == "" {
		return nil
	}
	if err := validatePeerFollowerStatus(status, cfg); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	cleanup := func() { _ = os.Remove(tmp) }
	if _, err := f.Write(append(payload, '\n')); err != nil {
		_ = f.Close()
		cleanup()
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		cleanup()
		return err
	}
	if err := f.Close(); err != nil {
		cleanup()
		return err
	}
	if runtime.GOOS == "windows" {
		_ = os.Remove(path)
	}
	if err := os.Rename(tmp, path); err != nil {
		cleanup()
		return err
	}
	return nil
}

func loadPeerFollowerStatus(path string, cfg BootstrapConfig) (PeerFollowerStatus, error) {
	var status PeerFollowerStatus
	if err := readJSON(path, &status); err != nil {
		return PeerFollowerStatus{}, err
	}
	if err := validatePeerFollowerStatus(status, cfg); err != nil {
		return PeerFollowerStatus{}, err
	}
	return status, nil
}

func followerStatusFromCycle(cfg BootstrapConfig, result PeerFollowerCycleResult, runtimeState string, failures int, lastErr error, nextRetry time.Time, now time.Time) PeerFollowerStatus {
	status := newPeerFollowerStatus(cfg, runtimeState, now)
	status.LastClassification = result.Resolution.Classification
	status.TrustedHeight = result.TrustedHead.Height
	status.TrustedDIRHash = strings.ToLower(result.TrustedHead.DIRHash)
	status.SelectedPeerValidatorID = result.SelectedPeerValidatorID
	status.ConsecutiveFailures = failures
	status.LastCycleAt = now.UTC().Format(time.RFC3339Nano)
	if lastErr != nil {
		status.LastError = lastErr.Error()
	}
	if !nextRetry.IsZero() {
		status.NextRetryAt = nextRetry.UTC().Format(time.RFC3339Nano)
	}
	return status
}

func peerFollowerStatusCommand(args []string) error {
	fs := newFlagSet("peer-follower-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	statusPath := fs.String("follower-status-state", "", "durable follower heartbeat/status state path")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *statusPath == "" {
		*statusPath = filepath.Join(*dir, "state", "peer-follower-status.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	status, err := loadPeerFollowerStatus(*statusPath, cfg)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal follower status: %w", err)
	}
	fmt.Println(string(out))
	return nil
}
