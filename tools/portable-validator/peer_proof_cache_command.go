package main

import (
	"encoding/json"
	"path/filepath"
)

func peerProofCacheStatusCommand(args []string) error {
	fs := newFlagSet("peer-proof-cache-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	cacheDir := fs.String("cache-dir", "", "local non-authoritative verified proof cache directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *cacheDir == "" {
		*cacheDir = filepath.Join(*dir, "state", "peer-proof-cache")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	manifest, err := loadPeerProofCacheManifest(*cacheDir, cfg)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	println(string(out))
	return nil
}

func peerProofCachePruneCommand(args []string) error {
	fs := newFlagSet("peer-proof-cache-prune")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	cacheDir := fs.String("cache-dir", "", "local non-authoritative verified proof cache directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *cacheDir == "" {
		*cacheDir = filepath.Join(*dir, "state", "peer-proof-cache")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	manifest, err := prunePeerProofCache(*cacheDir, cfg)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	println(string(out))
	return nil
}
