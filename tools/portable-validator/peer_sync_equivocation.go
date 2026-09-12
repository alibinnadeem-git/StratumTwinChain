package main

import (
	"errors"
	"strings"
	"time"
)

func detectPeerHeadEquivocation(cfg BootstrapConfig, previous, current PeerHeadObservation, now time.Time) (*PeerEvidence, error) {
	if previous.PeerValidatorID == "" || current.PeerValidatorID == "" {
		return nil, errors.New("peer head observations require authenticated validator identities")
	}
	if previous.PeerValidatorID != current.PeerValidatorID {
		return nil, nil
	}
	if err := validateRemoteSyncHead(cfg, previous.Head); err != nil {
		return nil, err
	}
	if err := validateRemoteSyncHead(cfg, current.Head); err != nil {
		return nil, err
	}
	if previous.Head.LatestHeight != current.Head.LatestHeight {
		return nil, nil
	}
	if strings.EqualFold(previous.Head.LatestDIRHash, current.Head.LatestDIRHash) {
		return nil, nil
	}
	evidence, err := newPeerEvidence(
		cfg,
		current.PeerValidatorID,
		"HEAD_EQUIVOCATION",
		current.Head.LatestHeight,
		previous.Head.LatestDIRHash,
		current.Head.LatestDIRHash,
		"same authenticated peer reported incompatible finalized DIR hashes at the same height",
		now,
	)
	if err != nil {
		return nil, err
	}
	return &evidence, nil
}

func filterQuarantinedPeerHeads(state PeerQuarantineState, observations []PeerHeadObservation) ([]PeerHeadObservation, []string) {
	allowed := make([]PeerHeadObservation, 0, len(observations))
	blocked := []string{}
	for _, observation := range observations {
		if peerIsQuarantined(state, observation.PeerValidatorID) {
			blocked = append(blocked, observation.PeerValidatorID)
			continue
		}
		allowed = append(allowed, observation)
	}
	return allowed, blocked
}
