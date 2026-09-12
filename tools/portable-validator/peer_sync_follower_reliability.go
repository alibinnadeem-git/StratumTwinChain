package main

import (
	"errors"
	"sort"
)

func followerEligiblePeers(result PeerResolveResult) ([]PeerHeadObservation, error) {
	if !result.AutoAdvanceAllowed {
		return nil, errors.New("peer resolution does not permit follower advancement")
	}
	candidates := []PeerHeadObservation{}
	switch result.Classification {
	case "EXACT_HEAD_AGREEMENT":
		candidates = append(candidates, result.Survey.Observations...)
	case "PROVEN_LAG":
		proven := map[string]bool{}
		for _, ancestry := range result.AncestryResults {
			if ancestry.Classification == "PROVEN_LAG" {
				proven[ancestry.PeerValidatorID] = true
			}
		}
		for _, observation := range result.HighestHeadPeers {
			if proven[observation.PeerValidatorID] {
				candidates = append(candidates, observation)
			}
		}
	default:
		return nil, errors.New("peer resolution classification is not follower-advance eligible")
	}
	if len(candidates) == 0 {
		return nil, errors.New("no authenticated proof-eligible follower peer available")
	}
	return candidates, nil
}

func followerReliabilityEntry(state PeerReliabilityState, peerValidatorID string) PeerReliabilityEntry {
	entry, ok := state.Peers[peerValidatorID]
	if !ok {
		return PeerReliabilityEntry{PeerValidatorID: peerValidatorID}
	}
	return entry
}

func orderFollowerPeersByReliability(candidates []PeerHeadObservation, state PeerReliabilityState) ([]PeerHeadObservation, error) {
	if state.ConsensusWeighting {
		return nil, errors.New("refusing follower reliability ordering with consensus weighting enabled")
	}
	ordered := append([]PeerHeadObservation(nil), candidates...)
	sort.SliceStable(ordered, func(i, j int) bool {
		left := followerReliabilityEntry(state, ordered[i].PeerValidatorID)
		right := followerReliabilityEntry(state, ordered[j].PeerValidatorID)
		if left.ObjectiveSafetyFaultCount != right.ObjectiveSafetyFaultCount {
			return left.ObjectiveSafetyFaultCount < right.ObjectiveSafetyFaultCount
		}
		if left.AncestryUnverifiedCount != right.AncestryUnverifiedCount {
			return left.AncestryUnverifiedCount < right.AncestryUnverifiedCount
		}
		if left.ProvenAncestryCount != right.ProvenAncestryCount {
			return left.ProvenAncestryCount > right.ProvenAncestryCount
		}
		if left.AuthenticatedHeadObservations != right.AuthenticatedHeadObservations {
			return left.AuthenticatedHeadObservations > right.AuthenticatedHeadObservations
		}
		return ordered[i].PeerValidatorID < ordered[j].PeerValidatorID
	})
	return ordered, nil
}

func selectFollowerPeerWithReliability(result PeerResolveResult, state PeerReliabilityState) (PeerHeadObservation, error) {
	candidates, err := followerEligiblePeers(result)
	if err != nil {
		return PeerHeadObservation{}, err
	}
	ordered, err := orderFollowerPeersByReliability(candidates, state)
	if err != nil {
		return PeerHeadObservation{}, err
	}
	return ordered[0], nil
}
