package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

const peerOperatorAlertsProfile = "STRATUM-PEER-OPERATOR-ALERTS/1"

type PeerOperatorAlert struct {
	AlertID         string `json:"alertId"`
	AlertType       string `json:"alertType"`
	Severity        string `json:"severity"`
	Classification  string `json:"classification,omitempty"`
	PeerValidatorID string `json:"peerValidatorId,omitempty"`
	EvidenceHash    string `json:"evidenceHash,omitempty"`
	Detail          string `json:"detail"`
	CreatedAt       string `json:"createdAt"`
}

type PeerOperatorAlertAcknowledgement struct {
	AcknowledgementID string `json:"acknowledgementId"`
	AlertID           string `json:"alertId"`
	Operator          string `json:"operator"`
	Note              string `json:"note,omitempty"`
	AcknowledgedAt    string `json:"acknowledgedAt"`
}

type PeerOperatorAlertJournal struct {
	ProfileVersion     string                             `json:"profileVersion"`
	ChainID            string                             `json:"chainId"`
	GenesisDIRHash     string                             `json:"GenesisDIRHash"`
	ProtocolVersion    string                             `json:"protocolVersion"`
	ConsensusAuthority bool                               `json:"consensusAuthority"`
	Entries            []PeerOperatorAlert                `json:"entries"`
	Acknowledgements   []PeerOperatorAlertAcknowledgement `json:"acknowledgements,omitempty"`
}

type peerOperatorAlertIDPayload struct {
	ProfileVersion  string `json:"profileVersion"`
	ChainID         string `json:"chainId"`
	GenesisDIRHash  string `json:"GenesisDIRHash"`
	ProtocolVersion string `json:"protocolVersion"`
	AlertType       string `json:"alertType"`
	Classification  string `json:"classification,omitempty"`
	PeerValidatorID string `json:"peerValidatorId,omitempty"`
	EvidenceHash    string `json:"evidenceHash,omitempty"`
	SourceKey       string `json:"sourceKey"`
}

type peerOperatorAcknowledgementIDPayload struct {
	ProfileVersion  string `json:"profileVersion"`
	ChainID         string `json:"chainId"`
	GenesisDIRHash  string `json:"GenesisDIRHash"`
	ProtocolVersion string `json:"protocolVersion"`
	AlertID         string `json:"alertId"`
	Operator        string `json:"operator"`
}

func defaultPeerOperatorAlertJournal(cfg BootstrapConfig) PeerOperatorAlertJournal {
	return PeerOperatorAlertJournal{
		ProfileVersion:     peerOperatorAlertsProfile,
		ChainID:            cfg.ChainID,
		GenesisDIRHash:     strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion:    cfg.ProtocolVersion,
		ConsensusAuthority: false,
		Entries:            []PeerOperatorAlert{},
		Acknowledgements:   []PeerOperatorAlertAcknowledgement{},
	}
}

func loadPeerOperatorAlertJournal(path string, cfg BootstrapConfig) (PeerOperatorAlertJournal, error) {
	journal := defaultPeerOperatorAlertJournal(cfg)
	if path == "" {
		return journal, nil
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return journal, nil
	} else if err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	if err := readJSON(path, &journal); err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	if journal.ProfileVersion != peerOperatorAlertsProfile || journal.ChainID != cfg.ChainID || !strings.EqualFold(journal.GenesisDIRHash, cfg.GenesisDIRHash) || journal.ProtocolVersion != cfg.ProtocolVersion {
		return PeerOperatorAlertJournal{}, errors.New("peer operator alert journal trust context mismatch")
	}
	if journal.ConsensusAuthority {
		return PeerOperatorAlertJournal{}, errors.New("peer operator alerts must never carry consensus authority")
	}
	if journal.Entries == nil {
		journal.Entries = []PeerOperatorAlert{}
	}
	if journal.Acknowledgements == nil {
		journal.Acknowledgements = []PeerOperatorAlertAcknowledgement{}
	}
	return journal, nil
}

func savePeerOperatorAlertJournalAtomic(path string, journal PeerOperatorAlertJournal, cfg BootstrapConfig) error {
	if path == "" {
		return nil
	}
	if journal.ProfileVersion != peerOperatorAlertsProfile || journal.ChainID != cfg.ChainID || !strings.EqualFold(journal.GenesisDIRHash, cfg.GenesisDIRHash) || journal.ProtocolVersion != cfg.ProtocolVersion {
		return errors.New("peer operator alert journal trust context mismatch")
	}
	if journal.ConsensusAuthority {
		return errors.New("refusing peer operator alert journal with consensus authority enabled")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(journal, "", "  ")
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
	return nil
}

func newPeerOperatorAlert(cfg BootstrapConfig, alertType, severity, classification, peerValidatorID, evidenceHash, detail, sourceKey string, now time.Time) (PeerOperatorAlert, error) {
	alertType = strings.TrimSpace(alertType)
	severity = strings.TrimSpace(severity)
	classification = strings.TrimSpace(classification)
	peerValidatorID = strings.TrimSpace(peerValidatorID)
	evidenceHash = strings.ToLower(strings.TrimSpace(evidenceHash))
	detail = strings.TrimSpace(detail)
	sourceKey = strings.TrimSpace(sourceKey)
	if alertType == "" || severity == "" || sourceKey == "" {
		return PeerOperatorAlert{}, errors.New("operator alert requires type, severity and source key")
	}
	if evidenceHash != "" && !isSHA256(evidenceHash) {
		return PeerOperatorAlert{}, errors.New("operator alert evidence hash must be SHA-256 when supplied")
	}
	payload := peerOperatorAlertIDPayload{
		ProfileVersion:  peerOperatorAlertsProfile,
		ChainID:         cfg.ChainID,
		GenesisDIRHash:  strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		AlertType:       alertType,
		Classification:  classification,
		PeerValidatorID: peerValidatorID,
		EvidenceHash:    evidenceHash,
		SourceKey:       sourceKey,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return PeerOperatorAlert{}, err
	}
	digest := sha256.Sum256(b)
	return PeerOperatorAlert{
		AlertID:         hex.EncodeToString(digest[:]),
		AlertType:       alertType,
		Severity:        severity,
		Classification:  classification,
		PeerValidatorID: peerValidatorID,
		EvidenceHash:    evidenceHash,
		Detail:          detail,
		CreatedAt:       now.UTC().Format(time.RFC3339Nano),
	}, nil
}

func appendPeerOperatorAlert(path string, cfg BootstrapConfig, alert PeerOperatorAlert) (PeerOperatorAlertJournal, error) {
	if !isSHA256(alert.AlertID) {
		return PeerOperatorAlertJournal{}, errors.New("operator alert ID must be SHA-256")
	}
	journal, err := loadPeerOperatorAlertJournal(path, cfg)
	if err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	for _, existing := range journal.Entries {
		if existing.AlertID == alert.AlertID {
			return journal, nil
		}
	}
	journal.Entries = append(journal.Entries, alert)
	if err := savePeerOperatorAlertJournalAtomic(path, journal, cfg); err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	return journal, nil
}

func acknowledgePeerOperatorAlert(path string, cfg BootstrapConfig, alertID, operator, note string, now time.Time) (PeerOperatorAlertJournal, error) {
	alertID = strings.ToLower(strings.TrimSpace(alertID))
	operator = strings.TrimSpace(operator)
	note = strings.TrimSpace(note)
	if !isSHA256(alertID) {
		return PeerOperatorAlertJournal{}, errors.New("operator alert acknowledgement requires a valid alert SHA-256 ID")
	}
	if operator == "" {
		return PeerOperatorAlertJournal{}, errors.New("operator alert acknowledgement requires operator identity")
	}
	journal, err := loadPeerOperatorAlertJournal(path, cfg)
	if err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	found := false
	for _, alert := range journal.Entries {
		if strings.EqualFold(alert.AlertID, alertID) {
			found = true
			break
		}
	}
	if !found {
		return PeerOperatorAlertJournal{}, errors.New("operator alert acknowledgement references unknown alert")
	}
	for _, acknowledgement := range journal.Acknowledgements {
		if strings.EqualFold(acknowledgement.AlertID, alertID) {
			return journal, nil
		}
	}
	payload := peerOperatorAcknowledgementIDPayload{
		ProfileVersion:  peerOperatorAlertsProfile,
		ChainID:         cfg.ChainID,
		GenesisDIRHash:  strings.ToLower(cfg.GenesisDIRHash),
		ProtocolVersion: cfg.ProtocolVersion,
		AlertID:         alertID,
		Operator:        operator,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	digest := sha256.Sum256(b)
	journal.Acknowledgements = append(journal.Acknowledgements, PeerOperatorAlertAcknowledgement{
		AcknowledgementID: hex.EncodeToString(digest[:]),
		AlertID:           alertID,
		Operator:          operator,
		Note:              note,
		AcknowledgedAt:    now.UTC().Format(time.RFC3339Nano),
	})
	if err := savePeerOperatorAlertJournalAtomic(path, journal, cfg); err != nil {
		return PeerOperatorAlertJournal{}, err
	}
	return journal, nil
}

func followerSafetyAlertSourceKey(result PeerFollowerCycleResult) string {
	keys := []string{result.Resolution.Classification}
	for _, evidence := range append(append([]PeerEvidence{}, result.CrossRunSafetyEvidence...), result.SafetyEvidence...) {
		if isSHA256(evidence.EvidenceHash) {
			keys = append(keys, evidence.EvidenceHash)
		}
	}
	sort.Strings(keys)
	return strings.Join(keys, ":")
}

func persistFollowerOperatorAlerts(path string, cfg BootstrapConfig, result PeerFollowerCycleResult, now time.Time) error {
	for _, evidence := range append(append([]PeerEvidence{}, result.CrossRunSafetyEvidence...), result.SafetyEvidence...) {
		if evidence.EvidenceType != "HEAD_EQUIVOCATION" && evidence.EvidenceType != "PROOF_HEAD_MISMATCH" {
			continue
		}
		alert, err := newPeerOperatorAlert(cfg, "PEER_QUARANTINED", "HIGH", evidence.EvidenceType, evidence.PeerValidatorID, evidence.EvidenceHash, evidence.Detail, evidence.EvidenceHash, now)
		if err != nil {
			return err
		}
		if _, err := appendPeerOperatorAlert(path, cfg, alert); err != nil {
			return err
		}
	}
	if followerSafetyHalt(result.Resolution.Classification) {
		sourceKey := followerSafetyAlertSourceKey(result)
		alert, err := newPeerOperatorAlert(cfg, "FOLLOWER_SAFETY_HALT", "CRITICAL", result.Resolution.Classification, "", "", "automatic follower advancement halted for operator review", sourceKey, now)
		if err != nil {
			return err
		}
		if _, err := appendPeerOperatorAlert(path, cfg, alert); err != nil {
			return err
		}
	}
	return nil
}
