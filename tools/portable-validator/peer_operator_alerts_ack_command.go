package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

func peerOperatorAlertAckCommand(args []string) error {
	fs := newFlagSet("peer-alert-ack")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	alertPath := fs.String("alert-state", "", "durable local peer operator alert journal path")
	alertID := fs.String("alert-id", "", "SHA-256 operator alert ID")
	operator := fs.String("operator", "", "operator identity recording the acknowledgement")
	note := fs.String("note", "", "optional operator review note")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*alertID) == "" || strings.TrimSpace(*operator) == "" {
		return errors.New("peer-alert-ack requires --alert-id and --operator")
	}
	if *alertPath == "" {
		*alertPath = filepath.Join(*dir, "state", "peer-operator-alerts.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	journal, err := acknowledgePeerOperatorAlert(*alertPath, cfg, *alertID, *operator, *note, time.Now().UTC())
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
