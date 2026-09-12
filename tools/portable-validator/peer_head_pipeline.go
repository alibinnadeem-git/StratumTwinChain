package main

import "path/filepath"

func peerReliabilityPathFromStatePath(statePath string) string {
	if statePath == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(statePath), "peer-reliability.json")
}

func persistAuthenticatedPeerHeads(headStatePath, evidencePath, quarantinePath string, cfg BootstrapConfig, observations []PeerHeadObservation) ([]PeerEvidence, error) {
	evidence := []PeerEvidence{}
	for _, observation := range observations {
		item, err := recordAuthenticatedPeerHead(headStatePath, evidencePath, quarantinePath, cfg, observation)
		if err != nil {
			return evidence, err
		}
		if item != nil {
			evidence = append(evidence, *item)
		}
	}
	if _, err := updatePeerReliability(peerReliabilityPathFromStatePath(headStatePath), cfg, observations, nil, evidence, peerObservationTime(latestPeerObservationTime(observations))); err != nil {
		return evidence, err
	}
	if _, err := enforcePeerEvidenceRetention(evidencePath, quarantinePath, cfg, defaultMaxUnpinnedPeerEvidence); err != nil {
		return evidence, err
	}
	return evidence, nil
}

func latestPeerObservationTime(observations []PeerHeadObservation) string {
	latest := ""
	for _, observation := range observations {
		if observation.ObservedAt > latest {
			latest = observation.ObservedAt
		}
	}
	return latest
}
