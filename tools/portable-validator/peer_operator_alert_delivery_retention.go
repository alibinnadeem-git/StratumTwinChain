package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"time"
)

const peerOperatorAlertDeliveryMaxReceipts = 4096

func prunePeerOperatorAlertDeliveryReceipts(journal PeerOperatorAlertDeliveryJournal, maxReceipts int) (PeerOperatorAlertDeliveryJournal, int, error) {
	if maxReceipts < 1 {
		return PeerOperatorAlertDeliveryJournal{}, 0, errors.New("alert delivery retention must keep at least one receipt")
	}
	if journal.ConsensusAuthority {
		return PeerOperatorAlertDeliveryJournal{}, 0, errors.New("cannot prune alert delivery journal carrying consensus authority")
	}
	for _, receipt := range journal.Receipts {
		if receipt.ConsensusAuthority || receipt.SafetyStateMutation {
			return PeerOperatorAlertDeliveryJournal{}, 0, errors.New("cannot prune alert delivery journal containing authority-bearing or safety-mutating receipt")
		}
	}
	if len(journal.Receipts) <= maxReceipts {
		return journal, 0, nil
	}

	type indexedReceipt struct {
		index int
		time  time.Time
	}
	ordered := make([]indexedReceipt, 0, len(journal.Receipts))
	for i, receipt := range journal.Receipts {
		parsed, err := time.Parse(time.RFC3339Nano, receipt.AttemptedAt)
		if err != nil {
			return PeerOperatorAlertDeliveryJournal{}, 0, fmt.Errorf("invalid delivery receipt timestamp at index %d: %w", i, err)
		}
		ordered = append(ordered, indexedReceipt{index: i, time: parsed})
	}
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].time.Equal(ordered[j].time) {
			return ordered[i].index < ordered[j].index
		}
		return ordered[i].time.Before(ordered[j].time)
	})

	removeCount := len(journal.Receipts) - maxReceipts
	remove := make(map[int]struct{}, removeCount)
	for _, item := range ordered[:removeCount] {
		remove[item.index] = struct{}{}
	}
	kept := make([]PeerOperatorAlertDeliveryReceipt, 0, maxReceipts)
	for i, receipt := range journal.Receipts {
		if _, drop := remove[i]; drop {
			continue
		}
		kept = append(kept, receipt)
	}
	journal.Receipts = kept
	return journal, removeCount, nil
}

func peerOperatorAlertDeliveryPruneCommand(args []string) error {
	fs := newFlagSet("peer-alert-delivery-prune")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	deliveryPath := fs.String("delivery-state", "", "local alert delivery receipt journal path")
	maxReceipts := fs.Int("max-receipts", peerOperatorAlertDeliveryMaxReceipts, "maximum non-authoritative delivery receipts to retain")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *maxReceipts < 1 || *maxReceipts > peerOperatorAlertDeliveryMaxReceipts {
		return fmt.Errorf("--max-receipts must be between 1 and %d", peerOperatorAlertDeliveryMaxReceipts)
	}
	if *deliveryPath == "" {
		*deliveryPath = filepath.Join(*dir, "state", "peer-operator-alert-deliveries.json")
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil {
		return err
	}
	if cfg.State != candidateState || cfg.VoteAuthority {
		return errors.New("refusing operator alert delivery retention outside CANDIDATE/voteAuthority=false state")
	}
	journal, err := loadPeerOperatorAlertDeliveryJournal(*deliveryPath, cfg)
	if err != nil {
		return err
	}
	pruned, removed, err := prunePeerOperatorAlertDeliveryReceipts(journal, *maxReceipts)
	if err != nil {
		return err
	}
	if err := savePeerOperatorAlertDeliveryJournalAtomic(*deliveryPath, pruned, cfg); err != nil {
		return err
	}
	out, err := json.MarshalIndent(map[string]any{
		"profileVersion":      pruned.ProfileVersion,
		"retainedReceipts":    len(pruned.Receipts),
		"removedReceipts":     removed,
		"maxReceipts":         *maxReceipts,
		"consensusAuthority":  false,
		"safetyStateMutation": false,
	}, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
