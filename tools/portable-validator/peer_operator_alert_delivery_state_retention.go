package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

func pruneAcknowledgedPeerOperatorAlertDeliveryState(deliveries PeerOperatorAlertDeliveryJournal, alerts PeerOperatorAlertJournal) (PeerOperatorAlertDeliveryJournal, int, error) {
	if deliveries.ConsensusAuthority || alerts.ConsensusAuthority {
		return PeerOperatorAlertDeliveryJournal{}, 0, errors.New("refusing alert delivery state cleanup with consensus authority enabled")
	}
	acknowledged := map[string]bool{}
	for _, acknowledgement := range alerts.Acknowledgements {
		id := strings.ToLower(strings.TrimSpace(acknowledgement.AlertID))
		if !isSHA256(id) {
			return PeerOperatorAlertDeliveryJournal{}, 0, errors.New("alert delivery state cleanup encountered invalid acknowledged alert ID")
		}
		acknowledged[id] = true
	}
	if len(acknowledged) == 0 || len(deliveries.State) == 0 {
		return deliveries, 0, nil
	}
	removed := 0
	for key, state := range deliveries.State {
		if state.ConsensusAuthority || state.SafetyStateMutation {
			return PeerOperatorAlertDeliveryJournal{}, 0, errors.New("alert delivery state cleanup encountered authority-bearing or safety-mutating state")
		}
		if acknowledged[strings.ToLower(state.AlertID)] {
			delete(deliveries.State, key)
			removed++
		}
	}
	return deliveries, removed, nil
}

func peerOperatorAlertDeliveryStatePruneCommand(args []string) error {
	fs := newFlagSet("peer-alert-delivery-state-prune")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	deliveryPath := fs.String("delivery-state", "", "local alert delivery receipt/state journal path")
	alertPath := fs.String("alert-state", "", "local operator alert journal path")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *deliveryPath == "" {
		*deliveryPath = filepath.Join(*dir, "state", "peer-operator-alert-deliveries.json")
	}
	if *alertPath == "" {
		*alertPath = filepath.Join(*dir, "state", "peer-operator-alerts.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing operator alert delivery state cleanup outside CANDIDATE/voteAuthority=false state")
	}
	deliveries, err := loadPeerOperatorAlertDeliveryJournal(*deliveryPath, cfg)
	if err != nil {
		return err
	}
	alerts, err := loadPeerOperatorAlertJournal(*alertPath, cfg)
	if err != nil {
		return err
	}
	pruned, removed, err := pruneAcknowledgedPeerOperatorAlertDeliveryState(deliveries, alerts)
	if err != nil {
		return err
	}
	if err := savePeerOperatorAlertDeliveryJournalAtomic(*deliveryPath, pruned, cfg); err != nil {
		return err
	}
	out, err := json.MarshalIndent(map[string]any{
		"profileVersion":       pruned.ProfileVersion,
		"removedStateEntries":  removed,
		"retainedStateEntries": len(pruned.State),
		"retainedReceipts":     len(pruned.Receipts),
		"consensusAuthority":   false,
		"safetyStateMutation":  false,
	}, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
