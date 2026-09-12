package main

import (
	"errors"
	"fmt"
	"sort"
	"time"
)

const defaultMaxUnpinnedPeerEvidence = 4096

type PeerEvidenceRetentionResult struct {
	Before         int `json:"before"`
	After          int `json:"after"`
	Pinned         int `json:"pinned"`
	UnpinnedKept   int `json:"unpinnedKept"`
	UnpinnedPruned int `json:"unpinnedPruned"`
}

type timedPeerEvidence struct {
	Evidence PeerEvidence
	Observed time.Time
}

func quarantinePinnedEvidenceHashes(state PeerQuarantineState) map[string]struct{} {
	pinned := map[string]struct{}{}
	for _, entry := range state.Entries {
		for _, hash := range entry.EvidenceHashes {
			if isSHA256(hash) {
				pinned[hash] = struct{}{}
			}
		}
	}
	return pinned
}

func applyPeerEvidenceRetention(journal PeerEvidenceJournal, quarantine PeerQuarantineState, maxUnpinned int) (PeerEvidenceJournal, PeerEvidenceRetentionResult, error) {
	if maxUnpinned < 0 {
		return PeerEvidenceJournal{}, PeerEvidenceRetentionResult{}, errors.New("peer evidence retention limit must be non-negative")
	}
	if journal.ProfileVersion != peerEvidenceJournalProfile || quarantine.ProfileVersion != peerQuarantineProfile || journal.ChainID != quarantine.ChainID || journal.GenesisDIRHash != quarantine.GenesisDIRHash || journal.ProtocolVersion != quarantine.ProtocolVersion {
		return PeerEvidenceJournal{}, PeerEvidenceRetentionResult{}, errors.New("peer evidence retention trust context mismatch")
	}

	pinnedHashes := quarantinePinnedEvidenceHashes(quarantine)
	pinned := make([]PeerEvidence, 0, len(journal.Entries))
	unpinned := make([]timedPeerEvidence, 0, len(journal.Entries))
	seen := map[string]struct{}{}

	for _, evidence := range journal.Entries {
		if !isSHA256(evidence.EvidenceHash) {
			return PeerEvidenceJournal{}, PeerEvidenceRetentionResult{}, fmt.Errorf("peer evidence retention refused invalid evidence hash %q", evidence.EvidenceHash)
		}
		if _, duplicate := seen[evidence.EvidenceHash]; duplicate {
			return PeerEvidenceJournal{}, PeerEvidenceRetentionResult{}, fmt.Errorf("peer evidence retention refused duplicate evidence hash %s", evidence.EvidenceHash)
		}
		seen[evidence.EvidenceHash] = struct{}{}
		if _, keep := pinnedHashes[evidence.EvidenceHash]; keep {
			pinned = append(pinned, evidence)
			continue
		}
		observed, err := time.Parse(time.RFC3339Nano, evidence.ObservedAt)
		if err != nil {
			return PeerEvidenceJournal{}, PeerEvidenceRetentionResult{}, fmt.Errorf("peer evidence retention refused malformed observedAt for %s: %w", evidence.EvidenceHash, err)
		}
		unpinned = append(unpinned, timedPeerEvidence{Evidence: evidence, Observed: observed})
	}

	for hash := range pinnedHashes {
		if _, ok := seen[hash]; !ok {
			return PeerEvidenceJournal{}, PeerEvidenceRetentionResult{}, fmt.Errorf("peer evidence retention refused missing quarantine-linked evidence hash %s", hash)
		}
	}

	sort.SliceStable(unpinned, func(i, j int) bool {
		if !unpinned[i].Observed.Equal(unpinned[j].Observed) {
			return unpinned[i].Observed.After(unpinned[j].Observed)
		}
		return unpinned[i].Evidence.EvidenceHash < unpinned[j].Evidence.EvidenceHash
	})
	keepUnpinned := len(unpinned)
	if keepUnpinned > maxUnpinned {
		keepUnpinned = maxUnpinned
	}
	keptUnpinned := unpinned[:keepUnpinned]

	keptHashes := map[string]struct{}{}
	for _, evidence := range pinned {
		keptHashes[evidence.EvidenceHash] = struct{}{}
	}
	for _, item := range keptUnpinned {
		keptHashes[item.Evidence.EvidenceHash] = struct{}{}
	}

	retained := make([]PeerEvidence, 0, len(keptHashes))
	for _, evidence := range journal.Entries {
		if _, keep := keptHashes[evidence.EvidenceHash]; keep {
			retained = append(retained, evidence)
		}
	}
	journal.Entries = retained
	return journal, PeerEvidenceRetentionResult{
		Before:         len(seen),
		After:          len(retained),
		Pinned:         len(pinned),
		UnpinnedKept:   keepUnpinned,
		UnpinnedPruned: len(unpinned) - keepUnpinned,
	}, nil
}

func enforcePeerEvidenceRetention(evidencePath, quarantinePath string, cfg BootstrapConfig, maxUnpinned int) (PeerEvidenceRetentionResult, error) {
	journal, err := loadPeerEvidenceJournal(evidencePath, cfg)
	if err != nil {
		return PeerEvidenceRetentionResult{}, err
	}
	quarantine, err := loadPeerQuarantineState(quarantinePath, cfg)
	if err != nil {
		return PeerEvidenceRetentionResult{}, err
	}
	retained, result, err := applyPeerEvidenceRetention(journal, quarantine, maxUnpinned)
	if err != nil {
		return PeerEvidenceRetentionResult{}, err
	}
	if result.UnpinnedPruned == 0 {
		return result, nil
	}
	if err := savePeerEvidenceJournalAtomic(evidencePath, retained); err != nil {
		return PeerEvidenceRetentionResult{}, err
	}
	return result, nil
}
