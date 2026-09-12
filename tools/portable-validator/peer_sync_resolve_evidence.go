package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

func persistResolverEvidence(evidencePath, quarantinePath string, cfg BootstrapConfig, result PeerResolveResult, now time.Time) ([]PeerEvidence, error) {
	persisted := []PeerEvidence{}
	appendEvidence := func(evidence PeerEvidence) error {
		if _, err := appendPeerEvidence(evidencePath, cfg, evidence); err != nil {
			return err
		}
		persisted = append(persisted, evidence)
		return nil
	}
	persistReliability := func() error {
		reliabilityPath := filepath.Join(filepath.Dir(evidencePath), "peer-reliability.json")
		_, err := updatePeerReliability(reliabilityPath, cfg, nil, result.AncestryResults, persisted, now)
		return err
	}
	finalizePersistence := func() error {
		if err := persistReliability(); err != nil {
			return err
		}
		_, err := enforcePeerEvidenceRetention(evidencePath, quarantinePath, cfg, defaultMaxUnpinnedPeerEvidence)
		return err
	}

	if result.Classification == "FINALIZED_HEAD_CONFLICT" {
		for _, observation := range result.Survey.Observations {
			evidence, err := newPeerEvidence(cfg, observation.PeerValidatorID, "FINALIZED_HEAD_CONFLICT", observation.Head.LatestHeight, "", observation.Head.LatestDIRHash, "authenticated peer participated in a same-height finalized-head conflict; operator review required", now)
			if err != nil {
				return persisted, err
			}
			if err := appendEvidence(evidence); err != nil {
				return persisted, err
			}
		}
		if err := finalizePersistence(); err != nil {
			return persisted, err
		}
		return persisted, nil
	}

	highest := map[string]PeerHeadObservation{}
	for _, observation := range result.HighestHeadPeers {
		highest[observation.PeerValidatorID] = observation
	}
	for _, ancestry := range result.AncestryResults {
		if ancestry.Classification != "HISTORICAL_DIVERGENCE" {
			continue
		}
		observation, ok := highest[ancestry.PeerValidatorID]
		if !ok {
			continue
		}
		evidenceType := "HISTORICAL_DIVERGENCE"
		expectedHash := ""
		observedHash := observation.Head.LatestDIRHash
		quarantine := false
		if ancestry.Reason == "proof-verified terminal head does not match the surveyed higher peer head" && isSHA256(strings.ToLower(ancestry.VerifiedDIRHash)) {
			evidenceType = "PROOF_HEAD_MISMATCH"
			expectedHash = observation.Head.LatestDIRHash
			observedHash = ancestry.VerifiedDIRHash
			quarantine = true
		}
		evidence, err := newPeerEvidence(cfg, ancestry.PeerValidatorID, evidenceType, observation.Head.LatestHeight, expectedHash, observedHash, ancestry.Reason, now)
		if err != nil {
			return persisted, err
		}
		if err := appendEvidence(evidence); err != nil {
			return persisted, err
		}
		if quarantine {
			state, err := loadPeerQuarantineState(quarantinePath, cfg)
			if err != nil {
				return persisted, err
			}
			if err := quarantinePeer(&state, evidence); err != nil {
				return persisted, err
			}
			if err := savePeerQuarantineStateAtomic(quarantinePath, state); err != nil {
				return persisted, fmt.Errorf("persist peer quarantine after proof/head mismatch: %w", err)
			}
		}
	}
	if err := finalizePersistence(); err != nil {
		return persisted, err
	}
	return persisted, nil
}
