package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

const peerStateDiagnosticCompareProfile = "STRATUM-PEER-STATE-DIAGNOSTIC-COMPARE/1"

type PeerStateDiagnosticHealthChange struct {
	Name               string `json:"name"`
	LeftStatus         string `json:"leftStatus"`
	RightStatus        string `json:"rightStatus"`
	LeftAuthoritative  bool   `json:"leftAuthoritative"`
	RightAuthoritative bool   `json:"rightAuthoritative"`
	LeftSafeDefault    bool   `json:"leftSafeDefault"`
	RightSafeDefault   bool   `json:"rightSafeDefault"`
}

type PeerStateDiagnosticFileChange struct {
	Name         string `json:"name"`
	ChangeType   string `json:"changeType"`
	LeftPresent  bool   `json:"leftPresent"`
	RightPresent bool   `json:"rightPresent"`
	LeftSize     int64  `json:"leftSizeBytes,omitempty"`
	RightSize    int64  `json:"rightSizeBytes,omitempty"`
	LeftSHA256   string `json:"leftSha256,omitempty"`
	RightSHA256  string `json:"rightSha256,omitempty"`
}

type PeerStateDiagnosticComparison struct {
	ProfileVersion            string                            `json:"profileVersion"`
	LeftBundleProfileVersion  string                            `json:"leftBundleProfileVersion"`
	RightBundleProfileVersion string                            `json:"rightBundleProfileVersion"`
	LeftIntegrityVerified     bool                              `json:"leftIntegrityVerified"`
	RightIntegrityVerified    bool                              `json:"rightIntegrityVerified"`
	AuthenticityEstablished   bool                              `json:"authenticityEstablished"`
	ConsensusAuthority        bool                              `json:"consensusAuthority"`
	CanonicalHistorySelection bool                              `json:"canonicalHistorySelection"`
	RecoveryAuthority         bool                              `json:"recoveryAuthority"`
	MutationPerformed         bool                              `json:"mutationPerformed"`
	ChainIDMatch              bool                              `json:"chainIdMatch"`
	ValidatorIDMatch          bool                              `json:"validatorIdMatch"`
	LeftChainID               string                            `json:"leftChainId"`
	RightChainID              string                            `json:"rightChainId"`
	LeftValidatorID           string                            `json:"leftValidatorId"`
	RightValidatorID          string                            `json:"rightValidatorId"`
	LeftCreatedAt             string                            `json:"leftCreatedAt"`
	RightCreatedAt            string                            `json:"rightCreatedAt"`
	CreatedAtChanged          bool                              `json:"createdAtChanged"`
	LeftOverallHealth         string                            `json:"leftOverallHealth"`
	RightOverallHealth        string                            `json:"rightOverallHealth"`
	HealthChanged             bool                              `json:"healthChanged"`
	HealthChanges             []PeerStateDiagnosticHealthChange `json:"healthChanges"`
	FileChanges               []PeerStateDiagnosticFileChange   `json:"fileChanges"`
}

func readVerifiedPeerStateDiagnosticManifest(bundleDir string) (PeerStateDiagnosticManifest, PeerStateDiagnosticVerification, error) {
	verification, err := verifyPeerStateDiagnosticBundle(bundleDir)
	if err != nil {
		return PeerStateDiagnosticManifest{}, PeerStateDiagnosticVerification{}, err
	}
	var manifest PeerStateDiagnosticManifest
	if err := readJSON(filepath.Join(bundleDir, "manifest.json"), &manifest); err != nil {
		return PeerStateDiagnosticManifest{}, PeerStateDiagnosticVerification{}, err
	}
	return manifest, verification, nil
}

func diagnosticHealthMap(entries []PeerStateHealthEntry) map[string]PeerStateHealthEntry {
	out := make(map[string]PeerStateHealthEntry, len(entries))
	for _, entry := range entries {
		out[entry.Name] = entry
	}
	return out
}

func diagnosticFileMap(entries []PeerStateDiagnosticFile) map[string]PeerStateDiagnosticFile {
	out := make(map[string]PeerStateDiagnosticFile, len(entries))
	for _, entry := range entries {
		out[entry.Name] = entry
	}
	return out
}

func comparePeerStateDiagnosticBundles(leftDir, rightDir string) (PeerStateDiagnosticComparison, error) {
	if strings.TrimSpace(leftDir) == "" || strings.TrimSpace(rightDir) == "" {
		return PeerStateDiagnosticComparison{}, errors.New("both diagnostic bundle directories are required")
	}
	left, leftVerification, err := readVerifiedPeerStateDiagnosticManifest(leftDir)
	if err != nil {
		return PeerStateDiagnosticComparison{}, fmt.Errorf("verify left diagnostic bundle: %w", err)
	}
	right, rightVerification, err := readVerifiedPeerStateDiagnosticManifest(rightDir)
	if err != nil {
		return PeerStateDiagnosticComparison{}, fmt.Errorf("verify right diagnostic bundle: %w", err)
	}

	comparison := PeerStateDiagnosticComparison{
		ProfileVersion:            peerStateDiagnosticCompareProfile,
		LeftBundleProfileVersion:  left.ProfileVersion,
		RightBundleProfileVersion: right.ProfileVersion,
		LeftIntegrityVerified:     leftVerification.IntegrityVerified,
		RightIntegrityVerified:    rightVerification.IntegrityVerified,
		AuthenticityEstablished:   false,
		ConsensusAuthority:        false,
		CanonicalHistorySelection: false,
		RecoveryAuthority:         false,
		MutationPerformed:         false,
		ChainIDMatch:              left.ChainID == right.ChainID,
		ValidatorIDMatch:          left.ValidatorID == right.ValidatorID,
		LeftChainID:               left.ChainID,
		RightChainID:              right.ChainID,
		LeftValidatorID:           left.ValidatorID,
		RightValidatorID:          right.ValidatorID,
		LeftCreatedAt:             left.CreatedAt,
		RightCreatedAt:            right.CreatedAt,
		CreatedAtChanged:          left.CreatedAt != right.CreatedAt,
		LeftOverallHealth:         left.Health.OverallStatus,
		RightOverallHealth:        right.Health.OverallStatus,
		HealthChanged:             left.Health.OverallStatus != right.Health.OverallStatus,
		HealthChanges:             []PeerStateDiagnosticHealthChange{},
		FileChanges:               []PeerStateDiagnosticFileChange{},
	}

	leftHealth := diagnosticHealthMap(left.Health.Entries)
	rightHealth := diagnosticHealthMap(right.Health.Entries)
	healthNames := map[string]bool{}
	for name := range leftHealth {
		healthNames[name] = true
	}
	for name := range rightHealth {
		healthNames[name] = true
	}
	orderedHealthNames := make([]string, 0, len(healthNames))
	for name := range healthNames {
		orderedHealthNames = append(orderedHealthNames, name)
	}
	sort.Strings(orderedHealthNames)
	for _, name := range orderedHealthNames {
		l, lok := leftHealth[name]
		r, rok := rightHealth[name]
		if lok == rok && l.Status == r.Status && l.Authoritative == r.Authoritative && l.SafeDefault == r.SafeDefault {
			continue
		}
		comparison.HealthChanged = true
		comparison.HealthChanges = append(comparison.HealthChanges, PeerStateDiagnosticHealthChange{
			Name:               name,
			LeftStatus:         l.Status,
			RightStatus:        r.Status,
			LeftAuthoritative:  l.Authoritative,
			RightAuthoritative: r.Authoritative,
			LeftSafeDefault:    l.SafeDefault,
			RightSafeDefault:   r.SafeDefault,
		})
	}

	leftFiles := diagnosticFileMap(left.Files)
	rightFiles := diagnosticFileMap(right.Files)
	fileNames := map[string]bool{}
	for name := range leftFiles {
		fileNames[name] = true
	}
	for name := range rightFiles {
		fileNames[name] = true
	}
	orderedFileNames := make([]string, 0, len(fileNames))
	for name := range fileNames {
		orderedFileNames = append(orderedFileNames, name)
	}
	sort.Strings(orderedFileNames)
	for _, name := range orderedFileNames {
		l, lok := leftFiles[name]
		r, rok := rightFiles[name]
		if lok && rok && l.SizeBytes == r.SizeBytes && strings.EqualFold(l.SHA256, r.SHA256) {
			continue
		}
		changeType := "CHANGED"
		if !lok && rok {
			changeType = "ADDED"
		} else if lok && !rok {
			changeType = "REMOVED"
		}
		comparison.FileChanges = append(comparison.FileChanges, PeerStateDiagnosticFileChange{
			Name:         name,
			ChangeType:   changeType,
			LeftPresent:  lok,
			RightPresent: rok,
			LeftSize:     l.SizeBytes,
			RightSize:    r.SizeBytes,
			LeftSHA256:   l.SHA256,
			RightSHA256:  r.SHA256,
		})
	}
	return comparison, nil
}

func peerStateDiagnosticCompareCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-compare")
	leftDir := fs.String("left", "", "left diagnostic bundle directory")
	rightDir := fs.String("right", "", "right diagnostic bundle directory")
	if err := fs.Parse(args); err != nil {
		return err
	}
	comparison, err := comparePeerStateDiagnosticBundles(*leftDir, *rightDir)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(comparison, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}
