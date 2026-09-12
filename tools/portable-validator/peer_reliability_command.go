package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
)

func peerReliabilityStatusCommand(args []string) error {
	fs := newFlagSet("peer-reliability-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	reliabilityPath := fs.String("reliability-state", "", "durable operational peer reliability state path")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *reliabilityPath == "" {
		*reliabilityPath = filepath.Join(*dir, "state", "peer-reliability.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	state, err := loadPeerReliabilityState(*reliabilityPath, cfg)
	if err != nil {
		return err
	}
	out, _ := json.MarshalIndent(map[string]any{
		"profileVersion":         state.ProfileVersion,
		"peers":                  peerReliabilityOrdered(state),
		"consensusWeighting":     false,
		"state":                  cfg.State,
		"voteAuthority":          false,
		"consensusParticipation": false,
		"governanceMutation":     false,
	}, "", "  ")
	fmt.Println(string(out))
	return nil
}
