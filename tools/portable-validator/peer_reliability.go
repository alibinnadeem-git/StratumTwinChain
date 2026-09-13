package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// Peer reliability is operational sync-selection metadata only; it never grants consensus weight or PoVI vote authority.
const peerReliabilityProfile = "STRATUM-PEER-RELIABILITY/1"

type PeerReliabilityEntry struct {
	PeerValidatorID               string `json:"peerValidatorId"`
	AuthenticatedHeadObservations uint64 `json:"authenticatedHeadObservations"`
	ProvenAncestryCount           uint64 `json:"provenAncestryCount"`
	AncestryUnverifiedCount       uint64 `json:"ancestryUnverifiedCount"`
	ObjectiveSafetyFaultCount     uint64 `json:"objectiveSafetyFaultCount"`
	LastObservedAt                string `json:"lastObservedAt,omitempty"`
	LastOutcome                   string `json:"lastOutcome,omitempty"`
}

type PeerReliabilityState struct {
	ProfileVersion     string                          `json:"profileVersion"`
	ChainID            string                          `json:"chainId"`
	GenesisDIRHash     string                          `json:"GenesisDIRHash"`
	ProtocolVersion    string                          `json:"protocolVersion"`
	ConsensusWeighting bool                            `json:"consensusWeighting"`
	Peers              map[string]PeerReliabilityEntry `json:"peers"`
}

func defaultPeerReliabilityState(cfg BootstrapConfig) PeerReliabilityState {
	return PeerReliabilityState{
		ProfileVersion:     peerReliabilityProfile,
		ChainID:            cfg.ChainID,
		GenesisDIRHash:     strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:    cfg.ProtocolVersion,
		ConsensusWeighting: false,
		Peers:              map[string]PeerReliabilityEntry{},
	}
}

func loadPeerReliabilityState(path string, cfg BootstrapConfig) (PeerReliabilityState, error) {
	state := defaultPeerReliabilityState(cfg)
	if path == "" {
		return state, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return state, nil
	} else if err != nil {
		return PeerReliabilityState{}, err
	}
	if err := readJSON(path, &state); err != nil {
		return PeerReliabilityState{}, err
	}
	if state.ProfileVersion != peerReliabilityProfile || state.ChainID != cfg.ChainID || !strings.EqualFold(state.GenesisDIRHash, cfg.GenesisDIRHash) || state.ProtocolVersion != cfg.ProtocolVersion {
		return PeerReliabilityState{}, errors.New("peer reliability state trust context mismatch")
	}
	if state.ConsensusWeighting {
		return PeerReliabilityState{}, errors.New("peer reliability state must never enable consensus weighting")
	}
	if state.Peers == nil {
		state.Peers = map[string]PeerReliabilityEntry{}
	}
	return state, nil
}

func savePeerReliabilityStateAtomic(path string, state PeerReliabilityState) error {
	if path == "" {
		return nil
	}
	if state.ConsensusWeighting {
		return errors.New("refusing to persist peer reliability state with consensus weighting enabled")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(state, "", "  ")
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
	if err := syncParentDirectoryAfterRename(path); err != nil {
		return err
	}
	return nil
}

func reliabilityEntry(state *PeerReliabilityState, peerValidatorID string) PeerReliabilityEntry {
	entry := state.Peers[peerValidatorID]
	entry.PeerValidatorID = peerValidatorID
	return entry
}

func recordPeerHeadReliability(state *PeerReliabilityState, observation PeerHeadObservation) {
	if observation.PeerValidatorID == "" {
		return
	}
	entry := reliabilityEntry(state, observation.PeerValidatorID)
	entry.AuthenticatedHeadObservations++
	entry.LastObservedAt = observation.ObservedAt
	entry.LastOutcome = "AUTHENTICATED_HEAD"
	state.Peers[observation.PeerValidatorID] = entry
}

func recordPeerAncestryReliability(state *PeerReliabilityState, result PeerAncestryPeerResult, observedAt time.Time) {
	if result.PeerValidatorID == "" {
		return
	}
	entry := reliabilityEntry(state, result.PeerValidatorID)
	switch result.Classification {
	case "PROVEN_LAG":
		entry.ProvenAncestryCount++
	case "ANCESTRY_UNVERIFIED":
		entry.AncestryUnverifiedCount++
	}
	entry.LastObservedAt = observedAt.UTC().Format(time.RFC3339Nano)
	entry.LastOutcome = result.Classification
	state.Peers[result.PeerValidatorID] = entry
}

func recordPeerSafetyFaultReliability(state *PeerReliabilityState, evidence PeerEvidence) {
	if evidence.PeerValidatorID == "" {
		return
	}
	if evidence.EvidenceType != "HEAD_EQUIVOCATION" && evidence.EvidenceType != "PROOF_HEAD_MISMATCH" {
		return
	}
	entry := reliabilityEntry(state, evidence.PeerValidatorID)
	entry.ObjectiveSafetyFaultCount++
	entry.LastObservedAt = evidence.ObservedAt
	entry.LastOutcome = evidence.EvidenceType
	state.Peers[evidence.PeerValidatorID] = entry
}

func peerReliabilityOrdered(state PeerReliabilityState) []PeerReliabilityEntry {
	entries := make([]PeerReliabilityEntry, 0, len(state.Peers))
	for _, entry := range state.Peers {
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(i, j int) bool {
		leftFaults := entries[i].ObjectiveSafetyFaultCount
		rightFaults := entries[j].ObjectiveSafetyFaultCount
		if leftFaults != rightFaults {
			return leftFaults < rightFaults
		}
		if entries[i].ProvenAncestryCount != entries[j].ProvenAncestryCount {
			return entries[i].ProvenAncestryCount > entries[j].ProvenAncestryCount
		}
		return entries[i].PeerValidatorID < entries[j].PeerValidatorID
	})
	return entries
}
