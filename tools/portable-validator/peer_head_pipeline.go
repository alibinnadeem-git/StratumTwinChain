package main

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
	return evidence, nil
}
