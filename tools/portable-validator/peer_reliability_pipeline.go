package main

import "time"

func updatePeerReliability(path string, cfg BootstrapConfig, observations []PeerHeadObservation, ancestry []PeerAncestryPeerResult, evidence []PeerEvidence, now time.Time) (PeerReliabilityState, error) {
	state, err := loadPeerReliabilityState(path, cfg)
	if err != nil {
		return PeerReliabilityState{}, err
	}
	for _, observation := range observations {
		recordPeerHeadReliability(&state, observation)
	}
	for _, result := range ancestry {
		recordPeerAncestryReliability(&state, result, now)
	}
	for _, item := range evidence {
		recordPeerSafetyFaultReliability(&state, item)
	}
	if err := savePeerReliabilityStateAtomic(path, state); err != nil {
		return PeerReliabilityState{}, err
	}
	return state, nil
}
