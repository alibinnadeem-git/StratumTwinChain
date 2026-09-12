package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const peerHeadStateProfile = "STRATUM-PEER-HEAD-STATE/1"

type PeerHeadState struct {
	ProfileVersion  string                         `json:"profileVersion"`
	ChainID         string                         `json:"chainId"`
	GenesisDIRHash  string                         `json:"GenesisDIRHash"`
	ProtocolVersion string                         `json:"protocolVersion"`
	Peers           map[string]PeerHeadObservation `json:"peers"`
}

func defaultPeerHeadState(cfg BootstrapConfig) PeerHeadState {
	return PeerHeadState{
		ProfileVersion:  peerHeadStateProfile,
		ChainID:         cfg.ChainID,
		GenesisDIRHash:  strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		Peers:           map[string]PeerHeadObservation{},
	}
}

func loadPeerHeadState(path string, cfg BootstrapConfig) (PeerHeadState, error) {
	state := defaultPeerHeadState(cfg)
	if path == "" {
		return state, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return state, nil
	} else if err != nil {
		return PeerHeadState{}, err
	}
	if err := readJSON(path, &state); err != nil {
		return PeerHeadState{}, err
	}
	if state.ProfileVersion != peerHeadStateProfile || state.ChainID != cfg.ChainID || !strings.EqualFold(state.GenesisDIRHash, cfg.GenesisDIRHash) || state.ProtocolVersion != cfg.ProtocolVersion {
		return PeerHeadState{}, errors.New("peer head state trust context mismatch")
	}
	if state.Peers == nil {
		state.Peers = map[string]PeerHeadObservation{}
	}
	return state, nil
}

func savePeerHeadStateAtomic(path string, state PeerHeadState) error {
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

func peerObservationTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err == nil {
		return parsed.UTC()
	}
	return time.Now().UTC()
}

func recordAuthenticatedPeerHead(path, evidencePath, quarantinePath string, cfg BootstrapConfig, observation PeerHeadObservation) (*PeerEvidence, error) {
	if observation.PeerValidatorID == "" {
		return nil, errors.New("authenticated peer head requires validator identity")
	}
	if err := validateRemoteSyncHead(cfg, observation.Head); err != nil {
		return nil, err
	}
	state, err := loadPeerHeadState(path, cfg)
	if err != nil {
		return nil, err
	}
	previous, exists := state.Peers[observation.PeerValidatorID]
	var evidence *PeerEvidence
	if exists {
		evidence, err = detectPeerHeadEquivocation(cfg, previous, observation, peerObservationTime(observation.ObservedAt))
		if err != nil {
			return nil, err
		}
		if evidence != nil {
			if _, err := appendPeerEvidence(evidencePath, cfg, *evidence); err != nil {
				return nil, err
			}
			quarantineState, err := loadPeerQuarantineState(quarantinePath, cfg)
			if err != nil {
				return nil, err
			}
			if err := quarantinePeer(&quarantineState, *evidence); err != nil {
				return nil, err
			}
			if err := savePeerQuarantineStateAtomic(quarantinePath, quarantineState); err != nil {
				return nil, err
			}
		}
	}
	state.Peers[observation.PeerValidatorID] = observation
	if err := savePeerHeadStateAtomic(path, state); err != nil {
		return nil, err
	}
	return evidence, nil
}
