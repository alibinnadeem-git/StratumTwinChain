package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const peerEvidenceJournalProfile = "STRATUM-PEER-EVIDENCE-JOURNAL/1"

type PeerEvidenceJournal struct {
	ProfileVersion  string         `json:"profileVersion"`
	ChainID         string         `json:"chainId"`
	GenesisDIRHash  string         `json:"GenesisDIRHash"`
	ProtocolVersion string         `json:"protocolVersion"`
	Entries         []PeerEvidence `json:"entries"`
}

func defaultPeerEvidenceJournal(cfg BootstrapConfig) PeerEvidenceJournal {
	return PeerEvidenceJournal{
		ProfileVersion:  peerEvidenceJournalProfile,
		ChainID:         cfg.ChainID,
		GenesisDIRHash:  strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		Entries:         []PeerEvidence{},
	}
}

func loadPeerEvidenceJournal(path string, cfg BootstrapConfig) (PeerEvidenceJournal, error) {
	journal := defaultPeerEvidenceJournal(cfg)
	if path == "" {
		return journal, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return journal, nil
	} else if err != nil {
		return PeerEvidenceJournal{}, err
	}
	if err := readJSON(path, &journal); err != nil {
		return PeerEvidenceJournal{}, err
	}
	if journal.ProfileVersion != peerEvidenceJournalProfile || journal.ChainID != cfg.ChainID || !strings.EqualFold(journal.GenesisDIRHash, cfg.GenesisDIRHash) || journal.ProtocolVersion != cfg.ProtocolVersion {
		return PeerEvidenceJournal{}, errors.New("peer evidence journal trust context mismatch")
	}
	if journal.Entries == nil {
		journal.Entries = []PeerEvidence{}
	}
	return journal, nil
}

func savePeerEvidenceJournalAtomic(path string, journal PeerEvidenceJournal) error {
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	cleanup := func() { _ = os.Remove(tmp) }
	if _, err := f.Write(append(b, '\n')); err != nil {
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

func appendPeerEvidence(path string, cfg BootstrapConfig, evidence PeerEvidence) (PeerEvidenceJournal, error) {
	if evidence.ProfileVersion != peerEvidenceProfile || evidence.ChainID != cfg.ChainID || !strings.EqualFold(evidence.GenesisDIRHash, cfg.GenesisDIRHash) || evidence.ProtocolVersion != cfg.ProtocolVersion || !isSHA256(evidence.EvidenceHash) {
		return PeerEvidenceJournal{}, errors.New("peer evidence does not match local trust context")
	}
	journal, err := loadPeerEvidenceJournal(path, cfg)
	if err != nil {
		return PeerEvidenceJournal{}, err
	}
	for _, existing := range journal.Entries {
		if existing.EvidenceHash == evidence.EvidenceHash {
			return journal, nil
		}
	}
	journal.Entries = append(journal.Entries, evidence)
	if err := savePeerEvidenceJournalAtomic(path, journal); err != nil {
		return PeerEvidenceJournal{}, err
	}
	return journal, nil
}
