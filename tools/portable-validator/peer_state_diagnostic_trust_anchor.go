package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

const (
	peerStateDiagnosticTrustAnchorProfile = "STRATUM-PEER-STATE-DIAGNOSTIC-TRUST-ANCHOR/1"
	peerStateDiagnosticTrustAnchorDomain  = "STRATUM/PEER-STATE/DIAGNOSTIC-TRUST-ANCHOR/1"

	diagnosticTrustAnchorActionTrust  = "TRUST"
	diagnosticTrustAnchorActionRotate = "ROTATE"
	diagnosticTrustAnchorActionRevoke = "REVOKE"
)

type PeerStateDiagnosticTrustAnchorRecord struct {
	ProfileVersion               string `json:"profileVersion"`
	Domain                       string `json:"domain"`
	Sequence                     uint64 `json:"sequence"`
	Action                       string `json:"action"`
	ChainID                      string `json:"chainId"`
	ValidatorID                  string `json:"validatorId"`
	Purpose                      string `json:"purpose"`
	Algorithm                    string `json:"algorithm"`
	KeyVersion                   int    `json:"keyVersion"`
	PublicKeyHash                string `json:"publicKeyHash"`
	PublicKeyB64                 string `json:"publicKeyB64"`
	ConfigFingerprintSHA256      string `json:"configFingerprintSha256"`
	EffectiveFrom                string `json:"effectiveFrom"`
	RecordedAt                   string `json:"recordedAt"`
	RecordedBy                   string `json:"recordedBy"`
	ProvenanceKind               string `json:"provenanceKind"`
	ProvenanceRef                string `json:"provenanceRef"`
	Reason                       string `json:"reason"`
	SupersedesKeyVersion         int    `json:"supersedesKeyVersion,omitempty"`
	SupersedesPublicKeyHash      string `json:"supersedesPublicKeyHash,omitempty"`
	PreviousRecordDigestSHA256   string `json:"previousRecordDigestSha256,omitempty"`
	RecordDigestSHA256           string `json:"recordDigestSha256,omitempty"`
	ConsensusAuthority           bool   `json:"consensusAuthority"`
	CanonicalHistorySelection    bool   `json:"canonicalHistorySelection"`
	RecoveryAuthority            bool   `json:"recoveryAuthority"`
	VoteAuthority                bool   `json:"voteAuthority"`
	ActivationAuthority          bool   `json:"activationAuthority"`
	PhysicalTruthEstablished     bool   `json:"physicalTruthEstablished"`
}

type PeerStateDiagnosticTrustAnchorEffectiveState struct {
	ChainID                   string `json:"chainId"`
	ValidatorID               string `json:"validatorId"`
	Status                    string `json:"status"`
	KeyVersion                int    `json:"keyVersion"`
	PublicKeyHash             string `json:"publicKeyHash"`
	ConfigFingerprintSHA256   string `json:"configFingerprintSha256"`
	EffectiveFrom             string `json:"effectiveFrom"`
	RecordSequence            uint64 `json:"recordSequence"`
	RecordedBy                string `json:"recordedBy"`
	ProvenanceKind            string `json:"provenanceKind"`
	ProvenanceRef             string `json:"provenanceRef"`
	Reason                    string `json:"reason"`
}

type PeerStateDiagnosticTrustAnchorInspection struct {
	ProfileVersion             string                                          `json:"profileVersion"`
	JournalVerified            bool                                            `json:"journalVerified"`
	RecordCount                int                                             `json:"recordCount"`
	LastSequence               uint64                                          `json:"lastSequence"`
	LastRecordDigestSHA256     string                                          `json:"lastRecordDigestSha256"`
	EffectiveAt               string                                          `json:"effectiveAt"`
	Records                    []PeerStateDiagnosticTrustAnchorRecord           `json:"records"`
	EffectiveAnchors           []PeerStateDiagnosticTrustAnchorEffectiveState   `json:"effectiveAnchors"`
	MutationPerformed          bool                                            `json:"mutationPerformed"`
	PoVIFinalityEstablished    bool                                            `json:"poviFinalityEstablished"`
	CanonicalHistorySelection  bool                                            `json:"canonicalHistorySelection"`
	RecoveryAuthority          bool                                            `json:"recoveryAuthority"`
	ValidatorGovernanceAuthority bool                                          `json:"validatorGovernanceAuthority"`
	VoteAuthority              bool                                            `json:"voteAuthority"`
	ActivationAuthority        bool                                            `json:"activationAuthority"`
	PhysicalTruthEstablished   bool                                            `json:"physicalTruthEstablished"`
}

type PeerStateDiagnosticAnchoredAttestationVerification struct {
	PeerStateDiagnosticAttestationVerification
	TrustAnchorJournalUsed      bool   `json:"trustAnchorJournalUsed"`
	TrustAnchorJournalProfile   string `json:"trustAnchorJournalProfile"`
	TrustAnchorRecordSequence   uint64 `json:"trustAnchorRecordSequence"`
	TrustAnchorKeyVersion       int    `json:"trustAnchorKeyVersion"`
	TrustAnchorEffectiveFrom    string `json:"trustAnchorEffectiveFrom"`
	TrustAnchorEvaluationTime   string `json:"trustAnchorEvaluationTime"`
	TrustAnchorProvenanceKind   string `json:"trustAnchorProvenanceKind"`
	TrustAnchorProvenanceRef    string `json:"trustAnchorProvenanceRef"`
	TrustAnchorRecordedBy       string `json:"trustAnchorRecordedBy"`
	MutationPerformed           bool   `json:"mutationPerformed"`
	PoVIFinalityEstablished     bool   `json:"poviFinalityEstablished"`
	ValidatorGovernanceAuthority bool  `json:"validatorGovernanceAuthority"`
	ActivationAuthority         bool   `json:"activationAuthority"`
	PhysicalTruthEstablished    bool   `json:"physicalTruthEstablished"`
}

type diagnosticTrustAnchorJournalState struct {
	Current       PeerStateDiagnosticTrustAnchorRecord
	HasCurrent    bool
	Revoked       bool
	LastEffective time.Time
	SeenKeyHashes map[string]bool
}

func diagnosticTrustAnchorIdentityKey(chainID, validatorID string) string {
	return chainID + "\x00" + validatorID
}

func diagnosticTrustAnchorRecordDigest(record PeerStateDiagnosticTrustAnchorRecord) (string, error) {
	payload := record
	payload.RecordDigestSHA256 = ""
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	message := append([]byte(peerStateDiagnosticTrustAnchorDomain+"\n"), encoded...)
	digest := sha256.Sum256(message)
	return hex.EncodeToString(digest[:]), nil
}

func parseDiagnosticTrustAnchorTime(label, raw string) (time.Time, error) {
	value, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid %s: %w", label, err)
	}
	return value.UTC(), nil
}

func validateDiagnosticTrustAnchorRecordShape(record PeerStateDiagnosticTrustAnchorRecord) error {
	if record.ProfileVersion != peerStateDiagnosticTrustAnchorProfile || record.Domain != peerStateDiagnosticTrustAnchorDomain {
		return errors.New("unsupported diagnostic trust-anchor profile/domain")
	}
	if record.Sequence == 0 {
		return errors.New("diagnostic trust-anchor sequence must be positive")
	}
	if strings.TrimSpace(record.ChainID) == "" || strings.TrimSpace(record.ValidatorID) == "" {
		return errors.New("diagnostic trust anchor requires chainId and validatorId")
	}
	if record.ConsensusAuthority || record.CanonicalHistorySelection || record.RecoveryAuthority || record.VoteAuthority || record.ActivationAuthority || record.PhysicalTruthEstablished {
		return errors.New("diagnostic trust anchor violates non-authority boundary")
	}
	if strings.TrimSpace(record.RecordedBy) == "" || strings.TrimSpace(record.ProvenanceKind) == "" || strings.TrimSpace(record.ProvenanceRef) == "" || strings.TrimSpace(record.Reason) == "" {
		return errors.New("diagnostic trust anchor requires explicit operator provenance and reason")
	}
	if !isSHA256(record.ConfigFingerprintSHA256) {
		return errors.New("diagnostic trust anchor config fingerprint must be SHA-256")
	}
	if _, err := parseDiagnosticTrustAnchorTime("effectiveFrom", record.EffectiveFrom); err != nil {
		return err
	}
	if _, err := parseDiagnosticTrustAnchorTime("recordedAt", record.RecordedAt); err != nil {
		return err
	}
	ref := KeyRef{
		Purpose:       record.Purpose,
		Algorithm:     record.Algorithm,
		PublicKeyB64:  record.PublicKeyB64,
		PublicKeyHash: record.PublicKeyHash,
		KeyVersion:    record.KeyVersion,
	}
	if _, err := transportPublicKeyFromRef(ref); err != nil {
		return fmt.Errorf("diagnostic trust-anchor TRANSPORT key: %w", err)
	}
	switch record.Action {
	case diagnosticTrustAnchorActionTrust, diagnosticTrustAnchorActionRotate, diagnosticTrustAnchorActionRevoke:
	default:
		return fmt.Errorf("unsupported diagnostic trust-anchor action %q", record.Action)
	}
	return nil
}

func validateDiagnosticTrustAnchorRecords(records []PeerStateDiagnosticTrustAnchorRecord) error {
	if len(records) == 0 {
		return errors.New("diagnostic trust-anchor journal is empty")
	}
	states := map[string]*diagnosticTrustAnchorJournalState{}
	previousDigest := ""
	var previousRecordedAt time.Time
	for index, record := range records {
		if err := validateDiagnosticTrustAnchorRecordShape(record); err != nil {
			return fmt.Errorf("diagnostic trust-anchor record %d: %w", index+1, err)
		}
		expectedSequence := uint64(index + 1)
		if record.Sequence != expectedSequence {
			return fmt.Errorf("diagnostic trust-anchor journal sequence mismatch: expected %d got %d", expectedSequence, record.Sequence)
		}
		if index == 0 {
			if record.PreviousRecordDigestSHA256 != "" {
				return errors.New("first diagnostic trust-anchor record must not claim a previous digest")
			}
		} else if !strings.EqualFold(record.PreviousRecordDigestSHA256, previousDigest) {
			return errors.New("diagnostic trust-anchor previous-record digest chain mismatch")
		}
		expectedDigest, err := diagnosticTrustAnchorRecordDigest(record)
		if err != nil {
			return err
		}
		if !strings.EqualFold(record.RecordDigestSHA256, expectedDigest) {
			return errors.New("diagnostic trust-anchor record digest mismatch")
		}
		recordedAt, _ := parseDiagnosticTrustAnchorTime("recordedAt", record.RecordedAt)
		if index > 0 && recordedAt.Before(previousRecordedAt) {
			return errors.New("diagnostic trust-anchor recordedAt timestamps must be monotonic")
		}
		previousRecordedAt = recordedAt
		previousDigest = strings.ToLower(record.RecordDigestSHA256)

		identity := diagnosticTrustAnchorIdentityKey(record.ChainID, record.ValidatorID)
		state := states[identity]
		if state == nil {
			state = &diagnosticTrustAnchorJournalState{SeenKeyHashes: map[string]bool{}}
			states[identity] = state
		}
		effectiveFrom, _ := parseDiagnosticTrustAnchorTime("effectiveFrom", record.EffectiveFrom)
		if state.HasCurrent && !effectiveFrom.After(state.LastEffective) {
			return errors.New("diagnostic trust-anchor effectiveFrom must strictly advance for one validator identity")
		}
		normalizedHash := strings.ToLower(record.PublicKeyHash)
		switch record.Action {
		case diagnosticTrustAnchorActionTrust:
			if state.HasCurrent {
				return errors.New("TRUST is allowed only as the first trust-anchor event for a validator identity")
			}
			if record.SupersedesKeyVersion != 0 || record.SupersedesPublicKeyHash != "" {
				return errors.New("initial TRUST record must not supersede another key")
			}
			state.Current = record
			state.HasCurrent = true
			state.Revoked = false
			state.LastEffective = effectiveFrom
			state.SeenKeyHashes[normalizedHash] = true
		case diagnosticTrustAnchorActionRotate:
			if !state.HasCurrent {
				return errors.New("ROTATE requires an existing independently trusted anchor")
			}
			if record.SupersedesKeyVersion != state.Current.KeyVersion || !strings.EqualFold(record.SupersedesPublicKeyHash, state.Current.PublicKeyHash) {
				return errors.New("ROTATE must explicitly supersede the exact prior trust anchor")
			}
			if record.KeyVersion != state.Current.KeyVersion+1 {
				return errors.New("ROTATE must increment TRANSPORT keyVersion by exactly one")
			}
			if strings.EqualFold(record.PublicKeyHash, state.Current.PublicKeyHash) || state.SeenKeyHashes[normalizedHash] {
				return errors.New("ROTATE requires new, previously unseen TRANSPORT key material")
			}
			state.Current = record
			state.Revoked = false
			state.LastEffective = effectiveFrom
			state.SeenKeyHashes[normalizedHash] = true
		case diagnosticTrustAnchorActionRevoke:
			if !state.HasCurrent || state.Revoked {
				return errors.New("REVOKE requires one currently tracked non-revoked trust anchor")
			}
			if record.KeyVersion != state.Current.KeyVersion || !strings.EqualFold(record.PublicKeyHash, state.Current.PublicKeyHash) || record.PublicKeyB64 != state.Current.PublicKeyB64 || !strings.EqualFold(record.ConfigFingerprintSHA256, state.Current.ConfigFingerprintSHA256) {
				return errors.New("REVOKE must identify the exact currently tracked trust anchor")
			}
			if record.SupersedesKeyVersion != 0 || record.SupersedesPublicKeyHash != "" {
				return errors.New("REVOKE must not silently nominate a replacement key")
			}
			state.Current = record
			state.Revoked = true
			state.LastEffective = effectiveFrom
		}
	}
	return nil
}

func loadDiagnosticTrustAnchorJournal(path string) ([]PeerStateDiagnosticTrustAnchorRecord, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, errors.New("diagnostic trust-anchor journal path is a directory")
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		return nil, errors.New("diagnostic trust-anchor journal permissions must not grant group/other access")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	records := []PeerStateDiagnosticTrustAnchorRecord{}
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	line := 0
	for scanner.Scan() {
		line++
		raw := bytes.TrimSpace(scanner.Bytes())
		if len(raw) == 0 {
			return nil, fmt.Errorf("diagnostic trust-anchor journal contains empty line %d", line)
		}
		var record PeerStateDiagnosticTrustAnchorRecord
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&record); err != nil {
			return nil, fmt.Errorf("decode diagnostic trust-anchor record %d: %w", line, err)
		}
		var extra any
		if err := decoder.Decode(&extra); err != io.EOF {
			return nil, fmt.Errorf("diagnostic trust-anchor record %d has trailing JSON content", line)
		}
		records = append(records, record)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if err := validateDiagnosticTrustAnchorRecords(records); err != nil {
		return nil, err
	}
	return records, nil
}

func diagnosticTrustAnchorStateAt(records []PeerStateDiagnosticTrustAnchorRecord, chainID, validatorID string, effectiveAt time.Time) (PeerStateDiagnosticTrustAnchorEffectiveState, bool) {
	var state PeerStateDiagnosticTrustAnchorEffectiveState
	found := false
	for _, record := range records {
		if record.ChainID != chainID || record.ValidatorID != validatorID {
			continue
		}
		effectiveFrom, err := parseDiagnosticTrustAnchorTime("effectiveFrom", record.EffectiveFrom)
		if err != nil || effectiveFrom.After(effectiveAt) {
			continue
		}
		found = true
		status := "ACTIVE"
		if record.Action == diagnosticTrustAnchorActionRevoke {
			status = "REVOKED"
		}
		state = PeerStateDiagnosticTrustAnchorEffectiveState{
			ChainID:                 record.ChainID,
			ValidatorID:             record.ValidatorID,
			Status:                  status,
			KeyVersion:              record.KeyVersion,
			PublicKeyHash:           strings.ToLower(record.PublicKeyHash),
			ConfigFingerprintSHA256: strings.ToLower(record.ConfigFingerprintSHA256),
			EffectiveFrom:           record.EffectiveFrom,
			RecordSequence:          record.Sequence,
			RecordedBy:              record.RecordedBy,
			ProvenanceKind:          record.ProvenanceKind,
			ProvenanceRef:           record.ProvenanceRef,
			Reason:                  record.Reason,
		}
	}
	return state, found
}

func diagnosticTrustAnchorRecordForState(records []PeerStateDiagnosticTrustAnchorRecord, state PeerStateDiagnosticTrustAnchorEffectiveState) (PeerStateDiagnosticTrustAnchorRecord, error) {
	for _, record := range records {
		if record.Sequence == state.RecordSequence {
			return record, nil
		}
	}
	return PeerStateDiagnosticTrustAnchorRecord{}, errors.New("effective diagnostic trust-anchor record not found")
}

func inspectDiagnosticTrustAnchorJournal(path string, effectiveAt time.Time) (PeerStateDiagnosticTrustAnchorInspection, error) {
	records, err := loadDiagnosticTrustAnchorJournal(path)
	if err != nil {
		return PeerStateDiagnosticTrustAnchorInspection{}, err
	}
	identities := map[string][2]string{}
	for _, record := range records {
		identities[diagnosticTrustAnchorIdentityKey(record.ChainID, record.ValidatorID)] = [2]string{record.ChainID, record.ValidatorID}
	}
	keys := make([]string, 0, len(identities))
	for key := range identities {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	states := make([]PeerStateDiagnosticTrustAnchorEffectiveState, 0, len(keys))
	for _, key := range keys {
		identity := identities[key]
		if state, ok := diagnosticTrustAnchorStateAt(records, identity[0], identity[1], effectiveAt.UTC()); ok {
			states = append(states, state)
		} else {
			states = append(states, PeerStateDiagnosticTrustAnchorEffectiveState{ChainID: identity[0], ValidatorID: identity[1], Status: "NOT_YET_EFFECTIVE"})
		}
	}
	last := records[len(records)-1]
	return PeerStateDiagnosticTrustAnchorInspection{
		ProfileVersion:               peerStateDiagnosticTrustAnchorProfile,
		JournalVerified:              true,
		RecordCount:                  len(records),
		LastSequence:                 last.Sequence,
		LastRecordDigestSHA256:       strings.ToLower(last.RecordDigestSHA256),
		EffectiveAt:                  effectiveAt.UTC().Format(time.RFC3339Nano),
		Records:                      records,
		EffectiveAnchors:             states,
		MutationPerformed:            false,
		PoVIFinalityEstablished:      false,
		CanonicalHistorySelection:    false,
		RecoveryAuthority:            false,
		ValidatorGovernanceAuthority: false,
		VoteAuthority:                false,
		ActivationAuthority:          false,
		PhysicalTruthEstablished:     false,
	}, nil
}

func diagnosticTrustAnchorFromConfig(action string, cfg BootstrapConfig, effectiveAt, recordedAt time.Time, recordedBy, provenanceKind, provenanceRef, reason string) (PeerStateDiagnosticTrustAnchorRecord, error) {
	ref, ok := cfg.Keys["TRANSPORT"]
	if !ok {
		return PeerStateDiagnosticTrustAnchorRecord{}, errors.New("trusted config is missing TRANSPORT key")
	}
	if _, err := transportPublicKeyFromRef(ref); err != nil {
		return PeerStateDiagnosticTrustAnchorRecord{}, err
	}
	fingerprint, err := diagnosticConfigFingerprint(cfg)
	if err != nil {
		return PeerStateDiagnosticTrustAnchorRecord{}, err
	}
	return PeerStateDiagnosticTrustAnchorRecord{
		ProfileVersion:          peerStateDiagnosticTrustAnchorProfile,
		Domain:                  peerStateDiagnosticTrustAnchorDomain,
		Action:                  action,
		ChainID:                 cfg.ChainID,
		ValidatorID:             cfg.ValidatorID,
		Purpose:                 ref.Purpose,
		Algorithm:               ref.Algorithm,
		KeyVersion:              ref.KeyVersion,
		PublicKeyHash:           strings.ToLower(ref.PublicKeyHash),
		PublicKeyB64:            ref.PublicKeyB64,
		ConfigFingerprintSHA256: strings.ToLower(fingerprint),
		EffectiveFrom:           effectiveAt.UTC().Format(time.RFC3339Nano),
		RecordedAt:              recordedAt.UTC().Format(time.RFC3339Nano),
		RecordedBy:              strings.TrimSpace(recordedBy),
		ProvenanceKind:          strings.TrimSpace(provenanceKind),
		ProvenanceRef:           strings.TrimSpace(provenanceRef),
		Reason:                  strings.TrimSpace(reason),
		ConsensusAuthority:      false,
		CanonicalHistorySelection: false,
		RecoveryAuthority:       false,
		VoteAuthority:           false,
		ActivationAuthority:     false,
		PhysicalTruthEstablished: false,
	}, nil
}

func diagnosticTrustAnchorRevokeRecord(current PeerStateDiagnosticTrustAnchorRecord, effectiveAt, recordedAt time.Time, recordedBy, provenanceKind, provenanceRef, reason string) PeerStateDiagnosticTrustAnchorRecord {
	return PeerStateDiagnosticTrustAnchorRecord{
		ProfileVersion:           peerStateDiagnosticTrustAnchorProfile,
		Domain:                   peerStateDiagnosticTrustAnchorDomain,
		Action:                   diagnosticTrustAnchorActionRevoke,
		ChainID:                  current.ChainID,
		ValidatorID:              current.ValidatorID,
		Purpose:                  current.Purpose,
		Algorithm:                current.Algorithm,
		KeyVersion:               current.KeyVersion,
		PublicKeyHash:            strings.ToLower(current.PublicKeyHash),
		PublicKeyB64:             current.PublicKeyB64,
		ConfigFingerprintSHA256:  strings.ToLower(current.ConfigFingerprintSHA256),
		EffectiveFrom:            effectiveAt.UTC().Format(time.RFC3339Nano),
		RecordedAt:               recordedAt.UTC().Format(time.RFC3339Nano),
		RecordedBy:               strings.TrimSpace(recordedBy),
		ProvenanceKind:           strings.TrimSpace(provenanceKind),
		ProvenanceRef:            strings.TrimSpace(provenanceRef),
		Reason:                   strings.TrimSpace(reason),
		ConsensusAuthority:       false,
		CanonicalHistorySelection: false,
		RecoveryAuthority:        false,
		VoteAuthority:            false,
		ActivationAuthority:      false,
		PhysicalTruthEstablished: false,
	}
}

func appendDiagnosticTrustAnchorRecord(path string, record PeerStateDiagnosticTrustAnchorRecord) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("diagnostic trust-anchor journal path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	lockPath := path + ".lock"
	lock, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("acquire diagnostic trust-anchor journal lock: %w", err)
	}
	if err := lock.Close(); err != nil {
		_ = os.Remove(lockPath)
		return err
	}
	defer os.Remove(lockPath)

	records := []PeerStateDiagnosticTrustAnchorRecord{}
	if info, statErr := os.Stat(path); statErr == nil {
		if info.Size() == 0 {
			return errors.New("existing diagnostic trust-anchor journal is empty; refusing ambiguous initialization")
		}
		records, err = loadDiagnosticTrustAnchorJournal(path)
		if err != nil {
			return err
		}
	} else if !os.IsNotExist(statErr) {
		return statErr
	}
	record.Sequence = uint64(len(records) + 1)
	if len(records) > 0 {
		record.PreviousRecordDigestSHA256 = strings.ToLower(records[len(records)-1].RecordDigestSHA256)
	}
	record.RecordDigestSHA256 = ""
	digest, err := diagnosticTrustAnchorRecordDigest(record)
	if err != nil {
		return err
	}
	record.RecordDigestSHA256 = digest
	candidate := append(append([]PeerStateDiagnosticTrustAnchorRecord{}, records...), record)
	if err := validateDiagnosticTrustAnchorRecords(candidate); err != nil {
		return err
	}
	encoded, err := json.Marshal(record)
	if err != nil {
		return err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()
	if runtime.GOOS != "windows" {
		if err := file.Chmod(0o600); err != nil {
			return err
		}
	}
	if _, err := file.Write(append(encoded, '\n')); err != nil {
		return err
	}
	return file.Sync()
}

func verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(bundleDir, attestationPath, journalPath string, effectiveAt time.Time) (PeerStateDiagnosticAnchoredAttestationVerification, error) {
	if inside, err := pathWithin(bundleDir, journalPath); err != nil {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, err
	} else if inside {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, errors.New("diagnostic bundle must never supply or contain its own trust-anchor journal")
	}
	base, err := verifyPeerStateDiagnosticAttestation(bundleDir, attestationPath, nil)
	if err != nil {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, err
	}
	var att PeerStateDiagnosticAttestation
	if err := readJSON(attestationPath, &att); err != nil {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, err
	}
	attestedAt, err := parseDiagnosticTrustAnchorTime("attestedAt", att.AttestedAt)
	if err != nil {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, err
	}
	if attestedAt.After(effectiveAt.UTC()) {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, errors.New("diagnostic attestation time is later than trust-anchor evaluation time")
	}
	records, err := loadDiagnosticTrustAnchorJournal(journalPath)
	if err != nil {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, err
	}
	state, ok := diagnosticTrustAnchorStateAt(records, att.ChainID, att.ValidatorID, effectiveAt.UTC())
	if !ok {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, errors.New("no independently trusted diagnostic anchor is effective for attestation identity")
	}
	if state.Status != "ACTIVE" {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, errors.New("diagnostic trust anchor is revoked at evaluation time")
	}
	anchor, err := diagnosticTrustAnchorRecordForState(records, state)
	if err != nil {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, err
	}
	anchorEffective, _ := parseDiagnosticTrustAnchorTime("effectiveFrom", anchor.EffectiveFrom)
	if attestedAt.Before(anchorEffective) {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, errors.New("diagnostic attestation predates the independently trusted anchor effective time")
	}
	if att.SignerPurpose != anchor.Purpose || att.SignerAlgorithm != anchor.Algorithm || att.SignerKeyVersion != anchor.KeyVersion || !strings.EqualFold(att.SignerPublicKeyHash, anchor.PublicKeyHash) || att.SignerPublicKeyB64 != anchor.PublicKeyB64 || !strings.EqualFold(att.ConfigFingerprintSHA256, anchor.ConfigFingerprintSHA256) {
		return PeerStateDiagnosticAnchoredAttestationVerification{}, errors.New("diagnostic attestation does not match the independently effective trust anchor")
	}
	return PeerStateDiagnosticAnchoredAttestationVerification{
		PeerStateDiagnosticAttestationVerification: PeerStateDiagnosticAttestationVerification{
			ProfileVersion:              base.ProfileVersion,
			BundleIntegrityVerified:     base.BundleIntegrityVerified,
			BundleDigestVerified:        base.BundleDigestVerified,
			CryptographicSignatureValid: base.CryptographicSignatureValid,
			TrustedConfigUsed:           false,
			AuthenticityEstablished:     true,
			ChainID:                     base.ChainID,
			ValidatorID:                 base.ValidatorID,
			BundleDigestSHA256:          base.BundleDigestSHA256,
			SignerPublicKeyHash:         base.SignerPublicKeyHash,
			ConsensusAuthority:          false,
			CanonicalHistorySelection:   false,
			RecoveryAuthority:           false,
			VoteAuthority:               false,
		},
		TrustAnchorJournalUsed:       true,
		TrustAnchorJournalProfile:    peerStateDiagnosticTrustAnchorProfile,
		TrustAnchorRecordSequence:    anchor.Sequence,
		TrustAnchorKeyVersion:        anchor.KeyVersion,
		TrustAnchorEffectiveFrom:     anchor.EffectiveFrom,
		TrustAnchorEvaluationTime:    effectiveAt.UTC().Format(time.RFC3339Nano),
		TrustAnchorProvenanceKind:    anchor.ProvenanceKind,
		TrustAnchorProvenanceRef:     anchor.ProvenanceRef,
		TrustAnchorRecordedBy:        anchor.RecordedBy,
		MutationPerformed:            false,
		PoVIFinalityEstablished:      false,
		ValidatorGovernanceAuthority: false,
		ActivationAuthority:          false,
		PhysicalTruthEstablished:     false,
	}, nil
}

func readDiagnosticTrustAnchorConfig(path string) (BootstrapConfig, error) {
	var cfg BootstrapConfig
	if err := readJSON(path, &cfg); err != nil {
		return BootstrapConfig{}, fmt.Errorf("read independently trusted validator config: %w", err)
	}
	if strings.TrimSpace(cfg.ChainID) == "" || strings.TrimSpace(cfg.ValidatorID) == "" {
		return BootstrapConfig{}, errors.New("independently trusted validator config is missing chainId or validatorId")
	}
	return cfg, nil
}

func requireDiagnosticTrustAnchorOperatorFields(recordedBy, provenanceRef, reason string) error {
	if strings.TrimSpace(recordedBy) == "" || strings.TrimSpace(provenanceRef) == "" || strings.TrimSpace(reason) == "" {
		return errors.New("--recorded-by, --provenance-ref and --reason are required")
	}
	return nil
}

func parseRequiredDiagnosticTrustAnchorEffective(raw string) (time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return time.Time{}, errors.New("--effective-from is required and must be explicit")
	}
	return parseDiagnosticTrustAnchorTime("effective-from", raw)
}

func peerStateDiagnosticTrustAnchorAddCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-trust-anchor-add")
	journal := fs.String("journal", "", "independent append-only diagnostic trust-anchor journal path")
	trustedConfig := fs.String("trusted-config", "", "independently obtained validator config to pin")
	effectiveFrom := fs.String("effective-from", "", "explicit RFC3339/RFC3339Nano trust effective time")
	recordedBy := fs.String("recorded-by", "", "operator or change-control identity recording the anchor")
	provenanceKind := fs.String("provenance-kind", "TRUSTED_CONFIG", "independent provenance class")
	provenanceRef := fs.String("provenance-ref", "", "independent ticket/document/reference for this trust decision")
	reason := fs.String("reason", "", "operator reason for this trust decision")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*journal) == "" || strings.TrimSpace(*trustedConfig) == "" {
		return errors.New("--journal and --trusted-config are required")
	}
	if err := requireDiagnosticTrustAnchorOperatorFields(*recordedBy, *provenanceRef, *reason); err != nil {
		return err
	}
	effective, err := parseRequiredDiagnosticTrustAnchorEffective(*effectiveFrom)
	if err != nil {
		return err
	}
	cfg, err := readDiagnosticTrustAnchorConfig(*trustedConfig)
	if err != nil {
		return err
	}
	record, err := diagnosticTrustAnchorFromConfig(diagnosticTrustAnchorActionTrust, cfg, effective, time.Now().UTC(), *recordedBy, *provenanceKind, *provenanceRef, *reason)
	if err != nil {
		return err
	}
	if err := appendDiagnosticTrustAnchorRecord(*journal, record); err != nil {
		return err
	}
	fmt.Printf("Recorded independent diagnostic TRUST anchor for %s/%s TRANSPORT keyVersion %d; no PoVI authority changed.\n", cfg.ChainID, cfg.ValidatorID, record.KeyVersion)
	return nil
}

func peerStateDiagnosticTrustAnchorRotateCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-trust-anchor-rotate")
	journal := fs.String("journal", "", "independent append-only diagnostic trust-anchor journal path")
	trustedConfig := fs.String("trusted-config", "", "independently obtained validator config containing the explicitly rotated TRANSPORT key")
	effectiveFrom := fs.String("effective-from", "", "explicit RFC3339/RFC3339Nano rotation effective time")
	recordedBy := fs.String("recorded-by", "", "operator or change-control identity recording the rotation")
	provenanceKind := fs.String("provenance-kind", "TRUSTED_CONFIG", "independent provenance class")
	provenanceRef := fs.String("provenance-ref", "", "independent ticket/document/reference for this rotation")
	reason := fs.String("reason", "", "operator reason for this rotation")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*journal) == "" || strings.TrimSpace(*trustedConfig) == "" {
		return errors.New("--journal and --trusted-config are required")
	}
	if err := requireDiagnosticTrustAnchorOperatorFields(*recordedBy, *provenanceRef, *reason); err != nil {
		return err
	}
	effective, err := parseRequiredDiagnosticTrustAnchorEffective(*effectiveFrom)
	if err != nil {
		return err
	}
	cfg, err := readDiagnosticTrustAnchorConfig(*trustedConfig)
	if err != nil {
		return err
	}
	records, err := loadDiagnosticTrustAnchorJournal(*journal)
	if err != nil {
		return err
	}
	var current *PeerStateDiagnosticTrustAnchorRecord
	for i := range records {
		if records[i].ChainID == cfg.ChainID && records[i].ValidatorID == cfg.ValidatorID {
			current = &records[i]
		}
	}
	if current == nil {
		return errors.New("ROTATE requires an existing independently trusted anchor for the same chain/validator identity")
	}
	record, err := diagnosticTrustAnchorFromConfig(diagnosticTrustAnchorActionRotate, cfg, effective, time.Now().UTC(), *recordedBy, *provenanceKind, *provenanceRef, *reason)
	if err != nil {
		return err
	}
	record.SupersedesKeyVersion = current.KeyVersion
	record.SupersedesPublicKeyHash = strings.ToLower(current.PublicKeyHash)
	if err := appendDiagnosticTrustAnchorRecord(*journal, record); err != nil {
		return err
	}
	fmt.Printf("Recorded explicit diagnostic ROTATE anchor for %s/%s TRANSPORT keyVersion %d; supersession is diagnostic trust only.\n", cfg.ChainID, cfg.ValidatorID, record.KeyVersion)
	return nil
}

func peerStateDiagnosticTrustAnchorRevokeCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-trust-anchor-revoke")
	journal := fs.String("journal", "", "independent append-only diagnostic trust-anchor journal path")
	chainID := fs.String("chain-id", "", "STRATUM chain identity for the diagnostic trust anchor")
	validatorID := fs.String("validator-id", "", "validator identity for the diagnostic trust anchor")
	expectedKeyVersion := fs.Int("expected-key-version", 0, "exact currently trusted TRANSPORT keyVersion expected by the operator")
	expectedKeyHash := fs.String("expected-public-key-hash", "", "exact currently trusted TRANSPORT public-key SHA-256 expected by the operator")
	effectiveFrom := fs.String("effective-from", "", "explicit RFC3339/RFC3339Nano revocation effective time")
	recordedBy := fs.String("recorded-by", "", "operator or change-control identity recording the revocation")
	provenanceKind := fs.String("provenance-kind", "SECURITY_CHANGE_CONTROL", "independent provenance class")
	provenanceRef := fs.String("provenance-ref", "", "independent ticket/document/reference for this revocation")
	reason := fs.String("reason", "", "operator reason for this revocation")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*journal) == "" || strings.TrimSpace(*chainID) == "" || strings.TrimSpace(*validatorID) == "" || *expectedKeyVersion < 1 || !isSHA256(*expectedKeyHash) {
		return errors.New("--journal, --chain-id, --validator-id, --expected-key-version and --expected-public-key-hash are required")
	}
	if err := requireDiagnosticTrustAnchorOperatorFields(*recordedBy, *provenanceRef, *reason); err != nil {
		return err
	}
	effective, err := parseRequiredDiagnosticTrustAnchorEffective(*effectiveFrom)
	if err != nil {
		return err
	}
	records, err := loadDiagnosticTrustAnchorJournal(*journal)
	if err != nil {
		return err
	}
	var current *PeerStateDiagnosticTrustAnchorRecord
	for i := range records {
		if records[i].ChainID == *chainID && records[i].ValidatorID == *validatorID {
			current = &records[i]
		}
	}
	if current == nil || current.Action == diagnosticTrustAnchorActionRevoke {
		return errors.New("no non-revoked diagnostic trust anchor is available for explicit revocation")
	}
	if current.KeyVersion != *expectedKeyVersion || !strings.EqualFold(current.PublicKeyHash, *expectedKeyHash) {
		return errors.New("operator expected key does not match the currently tracked diagnostic trust anchor")
	}
	record := diagnosticTrustAnchorRevokeRecord(*current, effective, time.Now().UTC(), *recordedBy, *provenanceKind, *provenanceRef, *reason)
	if err := appendDiagnosticTrustAnchorRecord(*journal, record); err != nil {
		return err
	}
	fmt.Printf("Recorded diagnostic REVOKE for %s/%s TRANSPORT keyVersion %d; no validator governance or PoVI state changed.\n", *chainID, *validatorID, current.KeyVersion)
	return nil
}

func peerStateDiagnosticTrustAnchorInspectCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-trust-anchor-inspect")
	journal := fs.String("journal", "", "independent append-only diagnostic trust-anchor journal path")
	effectiveAtRaw := fs.String("effective-at", "", "optional RFC3339/RFC3339Nano historical audit time; defaults to current time")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*journal) == "" {
		return errors.New("--journal is required")
	}
	effectiveAt := time.Now().UTC()
	if strings.TrimSpace(*effectiveAtRaw) != "" {
		parsed, err := parseDiagnosticTrustAnchorTime("effective-at", *effectiveAtRaw)
		if err != nil {
			return err
		}
		effectiveAt = parsed
	}
	inspection, err := inspectDiagnosticTrustAnchorJournal(*journal, effectiveAt)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(inspection, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(encoded))
	return nil
}

func peerStateDiagnosticAttestationVerifyAnchorCommand(args []string) error {
	fs := newFlagSet("peer-state-diagnostic-attestation-verify-anchor")
	bundleDir := fs.String("bundle", "", "version-2 diagnostic bundle directory")
	attestationPath := fs.String("attestation", "", "detached diagnostic attestation JSON path")
	journal := fs.String("trust-anchor-journal", "", "independently supplied diagnostic trust-anchor journal; must be outside the bundle")
	effectiveAtRaw := fs.String("effective-at", "", "optional explicit historical trust evaluation time; defaults to current time")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*bundleDir) == "" || strings.TrimSpace(*attestationPath) == "" || strings.TrimSpace(*journal) == "" {
		return errors.New("--bundle, --attestation and --trust-anchor-journal are required")
	}
	effectiveAt := time.Now().UTC()
	if strings.TrimSpace(*effectiveAtRaw) != "" {
		parsed, err := parseDiagnosticTrustAnchorTime("effective-at", *effectiveAtRaw)
		if err != nil {
			return err
		}
		effectiveAt = parsed
	}
	verification, err := verifyPeerStateDiagnosticAttestationWithTrustAnchorJournal(*bundleDir, *attestationPath, *journal, effectiveAt)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(verification, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(encoded))
	return nil
}
