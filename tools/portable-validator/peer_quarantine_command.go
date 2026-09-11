package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

func peerQuarantineStatusCommand(args []string) error {
	fs := newFlagSet("peer-quarantine-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	quarantinePath := fs.String("quarantine-state", "", "durable local peer quarantine state path")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *quarantinePath == "" {
		*quarantinePath = filepath.Join(*dir, "state", "peer-quarantine.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	state, err := loadPeerQuarantineState(*quarantinePath, cfg)
	if err != nil {
		return err
	}
	out, _ := json.MarshalIndent(map[string]any{
		"quarantine":             state,
		"state":                  cfg.State,
		"voteAuthority":          false,
		"consensusParticipation": false,
		"governanceMutation":     false,
	}, "", "  ")
	fmt.Println(string(out))
	return nil
}

func peerQuarantineReleaseCommand(args []string) error {
	fs := newFlagSet("peer-quarantine-release")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	quarantinePath := fs.String("quarantine-state", "", "durable local peer quarantine state path")
	peerValidatorID := fs.String("peer-validator-id", "", "authenticated peer validator identity to release from local quarantine")
	reason := fs.String("reason", "", "operator review reason for releasing the peer")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*peerValidatorID) == "" || strings.TrimSpace(*reason) == "" {
		return errors.New("--peer-validator-id and --reason are required")
	}
	if *quarantinePath == "" {
		*quarantinePath = filepath.Join(*dir, "state", "peer-quarantine.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	state, err := loadPeerQuarantineState(*quarantinePath, cfg)
	if err != nil {
		return err
	}
	entry, ok := state.Entries[*peerValidatorID]
	if !ok || entry.Status != "QUARANTINED" {
		return errors.New("peer is not currently quarantined")
	}
	entry.Status = "RELEASED_BY_OPERATOR"
	entry.Reason = strings.TrimSpace(*reason)
	entry.LastSeenAt = time.Now().UTC().Format(time.RFC3339Nano)
	state.Entries[*peerValidatorID] = entry
	if err := savePeerQuarantineStateAtomic(*quarantinePath, state); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(map[string]any{
		"released":               true,
		"peerValidatorId":        *peerValidatorID,
		"reason":                 entry.Reason,
		"evidenceHashes":         entry.EvidenceHashes,
		"voteAuthority":          false,
		"consensusParticipation": false,
		"governanceMutation":     false,
	}, "", "  ")
	fmt.Println(string(out))
	return nil
}
