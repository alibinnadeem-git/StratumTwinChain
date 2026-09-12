package main

import (
	"encoding/json"
	"path/filepath"
)

func peerOperatorAlertsStatusCommand(args []string) error {
	fs := newFlagSet("peer-alert-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	alertPath := fs.String("alert-state", "", "durable local peer operator alert journal path")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *alertPath == "" {
		*alertPath = filepath.Join(*dir, "state", "peer-operator-alerts.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	journal, err := loadPeerOperatorAlertJournal(*alertPath, cfg)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	println(string(out))
	return nil
}
