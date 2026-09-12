package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

type PeerOperatorAlertDeliveryStatus struct {
	ProfileVersion     string                             `json:"profileVersion"`
	ChainID            string                             `json:"chainId"`
	GenesisDIRHash     string                             `json:"GenesisDIRHash"`
	ProtocolVersion    string                             `json:"protocolVersion"`
	ConsensusAuthority bool                               `json:"consensusAuthority"`
	TotalAttempts      int                                `json:"totalAttempts"`
	Successful         int                                `json:"successful"`
	Failed             int                                `json:"failed"`
	Receipts           []PeerOperatorAlertDeliveryReceipt `json:"receipts"`
}

func peerOperatorAlertDeliveryStatusCommand(args []string) error {
	fs := newFlagSet("peer-alert-delivery-status")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	deliveryPath := fs.String("delivery-state", "", "local alert delivery receipt journal path")
	alertID := fs.String("alert-id", "", "optional alert SHA-256 ID filter")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *deliveryPath == "" {
		*deliveryPath = filepath.Join(*dir, "state", "peer-operator-alert-deliveries.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing operator alert delivery status outside CANDIDATE/voteAuthority=false state")
	}
	journal, err := loadPeerOperatorAlertDeliveryJournal(*deliveryPath, cfg)
	if err != nil {
		return err
	}
	filter := strings.ToLower(strings.TrimSpace(*alertID))
	if filter != "" && !isSHA256(filter) {
		return errors.New("--alert-id must be a valid SHA-256 ID")
	}
	status := PeerOperatorAlertDeliveryStatus{
		ProfileVersion:     journal.ProfileVersion,
		ChainID:            journal.ChainID,
		GenesisDIRHash:     journal.GenesisDIRHash,
		ProtocolVersion:    journal.ProtocolVersion,
		ConsensusAuthority: false,
		Receipts:           []PeerOperatorAlertDeliveryReceipt{},
	}
	for _, receipt := range journal.Receipts {
		if filter != "" && !strings.EqualFold(receipt.AlertID, filter) {
			continue
		}
		status.TotalAttempts++
		if receipt.Succeeded {
			status.Successful++
		} else {
			status.Failed++
		}
		status.Receipts = append(status.Receipts, receipt)
	}
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
