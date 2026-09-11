package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const peerQuarantineProfile = "STRATUM-PEER-QUARANTINE/1"
const peerEvidenceProfile = "STRATUM-PEER-EVIDENCE/1"

type PeerEvidence struct {
	ProfileVersion   string `json:"profileVersion"`
	ChainID          string `json:"chainId"`
	GenesisDIRHash   string `json:"GenesisDIRHash"`
	ProtocolVersion  string `json:"protocolVersion"`
	PeerValidatorID  string `json:"peerValidatorId"`
	EvidenceType     string `json:"evidenceType"`
	Height           int64  `json:"height,omitempty"`
	ExpectedDIRHash  string `json:"expectedDIRHash,omitempty"`
	ObservedDIRHash  string `json:"observedDIRHash,omitempty"`
	Detail           string `json:"detail"`
	ObservedAt       string `json:"observedAt"`
	EvidenceHash     string `json:"evidenceHash"`
}

type PeerQuarantineEntry struct {
	PeerValidatorID string   `json:"peerValidatorId"`
	Status          string   `json:"status"`
	Reason          string   `json:"reason"`
	EvidenceHashes  []string `json:"evidenceHashes"`
	FirstSeenAt     string   `json:"firstSeenAt"`
	LastSeenAt      string   `json:"lastSeenAt"`
}

type PeerQuarantineState struct {
	ProfileVersion string                         `json:"profileVersion"`
	ChainID        string                         `json:"chainId"`
	GenesisDIRHash string                         `json:"GenesisDIRHash"`
	ProtocolVersion string                        `json:"protocolVersion"`
	Entries        map[string]PeerQuarantineEntry `json:"entries"`
}

type peerEvidenceHashPayload struct {
	ProfileVersion  string `json:"profileVersion"`
	ChainID         string `json:"chainId"`
	GenesisDIRHash  string `json:"GenesisDIRHash"`
	ProtocolVersion string `json:"protocolVersion"`
	PeerValidatorID string `json:"peerValidatorId"`
	EvidenceType    string `json:"evidenceType"`
	Height          int64  `json:"height,omitempty"`
	ExpectedDIRHash string `json:"expectedDIRHash,omitempty"`
	ObservedDIRHash string `json:"observedDIRHash,omitempty"`
	Detail          string `json:"detail"`
	ObservedAt      string `json:"observedAt"`
}

func newPeerEvidence(cfg BootstrapConfig, peerValidatorID, evidenceType string, height int64, expectedDIRHash, observedDIRHash, detail string, now time.Time) (PeerEvidence, error) {
	peerValidatorID = strings.TrimSpace(peerValidatorID)
	evidenceType = strings.TrimSpace(evidenceType)
	if peerValidatorID == "" || evidenceType == "" {
		return PeerEvidence{}, errors.New("peer evidence requires validator identity and evidence type")
	}
	if height < 0 {
		return PeerEvidence{}, errors.New("peer evidence height must be non-negative")
	}
	if expectedDIRHash != "" && !isSHA256(strings.ToLower(expectedDIRHash)) {
		return PeerEvidence{}, errors.New("expected DIR hash must be SHA-256 when supplied")
	}
	if observedDIRHash != "" && !isSHA256(strings.ToLower(observedDIRHash)) {
		return PeerEvidence{}, errors.New("observed DIR hash must be SHA-256 when supplied")
	}
	observedAt := now.UTC().Format(time.RFC3339Nano)
	payload := peerEvidenceHashPayload{
		ProfileVersion: peerEvidenceProfile,
		ChainID: cfg.ChainID,
		GenesisDIRHash: strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		PeerValidatorID: peerValidatorID,
		EvidenceType: evidenceType,
		Height: height,
		ExpectedDIRHash: strings.ToLower(expectedDIRHash),
		ObservedDIRHash: strings.ToLower(observedDIRHash),
		Detail: strings.TrimSpace(detail),
		ObservedAt: observedAt,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return PeerEvidence{}, err
	}
	digest := sha256.Sum256(b)
	return PeerEvidence{
		ProfileVersion: payload.ProfileVersion,
		ChainID: payload.ChainID,
		GenesisDIRHash: payload.GenesisDIRHash,
		ProtocolVersion: payload.ProtocolVersion,
		PeerValidatorID: payload.PeerValidatorID,
		EvidenceType: payload.EvidenceType,
		Height: payload.Height,
		ExpectedDIRHash: payload.ExpectedDIRHash,
		ObservedDIRHash: payload.ObservedDIRHash,
		Detail: payload.Detail,
		ObservedAt: payload.ObservedAt,
		EvidenceHash: hex.EncodeToString(digest[:]),
	}, nil
}

func defaultPeerQuarantineState(cfg BootstrapConfig) PeerQuarantineState {
	return PeerQuarantineState{
		ProfileVersion: peerQuarantineProfile,
		ChainID: cfg.ChainID,
		GenesisDIRHash: strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		Entries: map[string]PeerQuarantineEntry{},
	}
}

func loadPeerQuarantineState(path string, cfg BootstrapConfig) (PeerQuarantineState, error) {
	state := defaultPeerQuarantineState(cfg)
	if path == "" {
		return state, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return state, nil
	} else if err != nil {
		return PeerQuarantineState{}, err
	}
	if err := readJSON(path, &state); err != nil {
		return PeerQuarantineState{}, err
	}
	if state.ProfileVersion != peerQuarantineProfile || state.ChainID != cfg.ChainID || !strings.EqualFold(state.GenesisDIRHash, cfg.GenesisDIRHash) || state.ProtocolVersion != cfg.ProtocolVersion {
		return PeerQuarantineState{}, errors.New("peer quarantine state trust context mismatch")
	}
	if state.Entries == nil {
		state.Entries = map[string]PeerQuarantineEntry{}
	}
	return state, nil
}

func savePeerQuarantineStateAtomic(path string, state PeerQuarantineState) error {
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(b, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func quarantinePeer(state *PeerQuarantineState, evidence PeerEvidence) error {
	if state == nil {
		return errors.New("peer quarantine state is required")
	}
	if evidence.ProfileVersion != peerEvidenceProfile || evidence.ChainID != state.ChainID || !strings.EqualFold(evidence.GenesisDIRHash, state.GenesisDIRHash) || evidence.ProtocolVersion != state.ProtocolVersion {
		return errors.New("peer evidence trust context mismatch")
	}
	if !isSHA256(evidence.EvidenceHash) {
		return errors.New("peer evidence hash is invalid")
	}
	entry, exists := state.Entries[evidence.PeerValidatorID]
	if !exists {
		entry = PeerQuarantineEntry{
			PeerValidatorID: evidence.PeerValidatorID,
			Status: "QUARANTINED",
			Reason: evidence.EvidenceType,
			FirstSeenAt: evidence.ObservedAt,
		}
	}
	entry.Status = "QUARANTINED"
	entry.Reason = evidence.EvidenceType
	entry.LastSeenAt = evidence.ObservedAt
	seen := false
	for _, hash := range entry.EvidenceHashes {
		if hash == evidence.EvidenceHash {
			seen = true
			break
		}
	}
	if !seen {
		entry.EvidenceHashes = append(entry.EvidenceHashes, evidence.EvidenceHash)
		sort.Strings(entry.EvidenceHashes)
	}
	state.Entries[evidence.PeerValidatorID] = entry
	return nil
}

func peerIsQuarantined(state PeerQuarantineState, peerValidatorID string) bool {
	entry, ok := state.Entries[peerValidatorID]
	return ok && entry.Status == "QUARANTINED"
}

func recordPeerSafetyFailure(path string, cfg BootstrapConfig, peerValidatorID, evidenceType string, height int64, expectedDIRHash, observedDIRHash, detail string, now time.Time) (PeerEvidence, PeerQuarantineState, error) {
	evidence, err := newPeerEvidence(cfg, peerValidatorID, evidenceType, height, expectedDIRHash, observedDIRHash, detail, now)
	if err != nil {
		return PeerEvidence{}, PeerQuarantineState{}, err
	}
	state, err := loadPeerQuarantineState(path, cfg)
	if err != nil {
		return PeerEvidence{}, PeerQuarantineState{}, err
	}
	if err := quarantinePeer(&state, evidence); err != nil {
		return PeerEvidence{}, PeerQuarantineState{}, err
	}
	if err := savePeerQuarantineStateAtomic(path, state); err != nil {
		return PeerEvidence{}, PeerQuarantineState{}, fmt.Errorf("persist peer quarantine state: %w", err)
	}
	return evidence, state, nil
}
