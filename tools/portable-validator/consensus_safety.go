package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	consensusSafetyVersion = "STRATUM-CONSENSUS-SAFETY/1"
	consensusSafetyDomain  = "STRATUM/CONSENSUS/SAFETY/1"
)

type ConsensusSafetyDecision struct {
	Height           uint64  `json:"height"`
	Round            uint64  `json:"round"`
	Step             string  `json:"step"`
	ProposalHash     string  `json:"proposalHash,omitempty"`
	StateRoot        string  `json:"stateRoot,omitempty"`
	MessageHash      string  `json:"messageHash,omitempty"`
	UnlockProofHash  string  `json:"unlockProofHash,omitempty"`
	UnlockProofRound *uint64 `json:"unlockProofRound,omitempty"`
	FinalizedDIRHash string  `json:"finalizedDIRHash,omitempty"`
}

type ConsensusSafetyRecord struct {
	Version             string  `json:"version"`
	Domain              string  `json:"domain"`
	ChainID             string  `json:"chainId"`
	ValidatorID         string  `json:"validatorId"`
	Sequence            uint64  `json:"sequence"`
	Height              uint64  `json:"height"`
	Round               uint64  `json:"round"`
	Step                string  `json:"step"`
	ProposalHash        string  `json:"proposalHash,omitempty"`
	StateRoot           string  `json:"stateRoot,omitempty"`
	MessageHash         string  `json:"messageHash,omitempty"`
	UnlockProofHash     string  `json:"unlockProofHash,omitempty"`
	UnlockProofRound    *uint64 `json:"unlockProofRound,omitempty"`
	LockedDIR           string  `json:"lockedDIR,omitempty"`
	LockedRound         *uint64 `json:"lockedRound,omitempty"`
	ValidDIR            string  `json:"validDIR,omitempty"`
	ValidRound          *uint64 `json:"validRound,omitempty"`
	FinalizedDIRHash    string  `json:"finalizedDIRHash,omitempty"`
	VoteAuthority       bool    `json:"voteAuthority"`
	ConsensusKeyHash    string  `json:"consensusKeyHash"`
	PreviousRecordHash  string  `json:"previousRecordHash"`
	RecordedAt          string  `json:"recordedAt"`
	RecordHash          string  `json:"recordHash"`
	Signature           string  `json:"signature"`
}

type consensusSafetyPayload struct {
	Version             string  `json:"version"`
	Domain              string  `json:"domain"`
	ChainID             string  `json:"chainId"`
	ValidatorID         string  `json:"validatorId"`
	Sequence            uint64  `json:"sequence"`
	Height              uint64  `json:"height"`
	Round               uint64  `json:"round"`
	Step                string  `json:"step"`
	ProposalHash        string  `json:"proposalHash,omitempty"`
	StateRoot           string  `json:"stateRoot,omitempty"`
	MessageHash         string  `json:"messageHash,omitempty"`
	UnlockProofHash     string  `json:"unlockProofHash,omitempty"`
	UnlockProofRound    *uint64 `json:"unlockProofRound,omitempty"`
	LockedDIR           string  `json:"lockedDIR,omitempty"`
	LockedRound         *uint64 `json:"lockedRound,omitempty"`
	ValidDIR            string  `json:"validDIR,omitempty"`
	ValidRound          *uint64 `json:"validRound,omitempty"`
	FinalizedDIRHash    string  `json:"finalizedDIRHash,omitempty"`
	VoteAuthority       bool    `json:"voteAuthority"`
	ConsensusKeyHash    string  `json:"consensusKeyHash"`
	PreviousRecordHash  string  `json:"previousRecordHash"`
	RecordedAt          string  `json:"recordedAt"`
}

func safetyPayload(record ConsensusSafetyRecord) consensusSafetyPayload {
	return consensusSafetyPayload{
		Version: record.Version, Domain: record.Domain, ChainID: record.ChainID, ValidatorID: record.ValidatorID,
		Sequence: record.Sequence, Height: record.Height, Round: record.Round, Step: record.Step,
		ProposalHash: record.ProposalHash, StateRoot: record.StateRoot, MessageHash: record.MessageHash,
		UnlockProofHash: record.UnlockProofHash, UnlockProofRound: record.UnlockProofRound,
		LockedDIR: record.LockedDIR, LockedRound: record.LockedRound, ValidDIR: record.ValidDIR, ValidRound: record.ValidRound,
		FinalizedDIRHash: record.FinalizedDIRHash, VoteAuthority: record.VoteAuthority,
		ConsensusKeyHash: record.ConsensusKeyHash, PreviousRecordHash: record.PreviousRecordHash, RecordedAt: record.RecordedAt,
	}
}

func consensusSafetyHash(record ConsensusSafetyRecord) (string, error) {
	b, err := json.Marshal(safetyPayload(record))
	if err != nil { return "", err }
	digest := sha256.Sum256(b)
	return hex.EncodeToString(digest[:]), nil
}

func consensusSafetyDir(dir string) string { return filepath.Join(dir, "state", "consensus-safety") }
func consensusSafetyCachePath(dir string) string { return filepath.Join(dir, "state", "consensus-safety.json") }
func consensusSafetyRecordPath(dir string, sequence uint64) string {
	return filepath.Join(consensusSafetyDir(dir), fmt.Sprintf("%020d.json", sequence))
}

func loadConsensusPrivateKey(dir string) (ed25519.PrivateKey, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "keys", "private", "consensus.pk8"))
	if err != nil { return nil, err }
	parsed, err := x509.ParsePKCS8PrivateKey(raw)
	if err != nil { return nil, fmt.Errorf("parse CONSENSUS private key: %w", err) }
	key, ok := parsed.(ed25519.PrivateKey)
	if !ok { return nil, errors.New("CONSENSUS private key is not Ed25519") }
	return key, nil
}

func consensusPublicKey(cfg BootstrapConfig) (ed25519.PublicKey, error) {
	ref, ok := cfg.Keys["CONSENSUS"]
	if !ok || ref.PublicKeyB64 == "" { return nil, errors.New("CONSENSUS public key is missing from validator config") }
	raw, err := base64.StdEncoding.DecodeString(ref.PublicKeyB64)
	if err != nil { return nil, fmt.Errorf("decode CONSENSUS public key: %w", err) }
	parsed, err := x509.ParsePKIXPublicKey(raw)
	if err != nil { return nil, fmt.Errorf("parse CONSENSUS public key: %w", err) }
	key, ok := parsed.(ed25519.PublicKey)
	if !ok { return nil, errors.New("CONSENSUS public key is not Ed25519") }
	return key, nil
}

func signConsensusSafetyRecord(dir string, record ConsensusSafetyRecord) (ConsensusSafetyRecord, error) {
	priv, err := loadConsensusPrivateKey(dir)
	if err != nil { return ConsensusSafetyRecord{}, err }
	hash, err := consensusSafetyHash(record)
	if err != nil { return ConsensusSafetyRecord{}, err }
	digest, _ := hex.DecodeString(hash)
	record.RecordHash = hash
	record.Signature = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, digest))
	return record, nil
}

func verifyConsensusSafetyRecord(cfg BootstrapConfig, previous *ConsensusSafetyRecord, record ConsensusSafetyRecord) error {
	if record.Version != consensusSafetyVersion || record.Domain != consensusSafetyDomain { return errors.New("unsupported consensus safety record version/domain") }
	if record.ChainID != cfg.ChainID || record.ValidatorID != cfg.ValidatorID { return errors.New("consensus safety record identity does not match validator config") }
	ref, ok := cfg.Keys["CONSENSUS"]
	if !ok || !strings.EqualFold(record.ConsensusKeyHash, ref.PublicKeyHash) { return errors.New("consensus safety record key hash does not match configured CONSENSUS key") }
	if previous == nil {
		if record.Sequence != 0 || record.Step != "BOOTSTRAP" || record.Height != 0 || record.Round != 0 { return errors.New("consensus safety journal must begin with BOOTSTRAP sequence 0") }
		if !strings.EqualFold(record.PreviousRecordHash, cfg.GenesisDIRHash) { return errors.New("BOOTSTRAP safety record must bind the pinned Genesis DIR hash") }
		if record.LockedDIR != "" || record.LockedRound != nil || record.ValidDIR != "" || record.ValidRound != nil || record.FinalizedDIRHash != "" { return errors.New("BOOTSTRAP safety record must not contain consensus decisions") }
	} else {
		if record.Sequence != previous.Sequence+1 { return errors.New("consensus safety journal sequence is not contiguous") }
		if record.PreviousRecordHash != previous.RecordHash { return errors.New("consensus safety journal hash chain is broken") }
		if err := validateSafetyTransition(*previous, record); err != nil { return err }
	}
	expectedHash, err := consensusSafetyHash(record)
	if err != nil { return err }
	if record.RecordHash != expectedHash { return errors.New("consensus safety record hash mismatch") }
	sig, err := base64.StdEncoding.DecodeString(record.Signature)
	if err != nil { return fmt.Errorf("decode consensus safety signature: %w", err) }
	pub, err := consensusPublicKey(cfg)
	if err != nil { return err }
	digest, _ := hex.DecodeString(expectedHash)
	if !ed25519.Verify(pub, digest, sig) { return errors.New("consensus safety record signature verification failed") }
	return nil
}

func safetyStepRank(step string) int {
	switch step {
	case "BOOTSTRAP": return 0
	case "VERIFY": return 10
	case "LOCK": return 20
	case "COMMIT": return 30
	case "ROUND_CHANGE": return 40
	case "FINALIZE": return 50
	default: return -1
	}
}

func validateDecisionShape(decision ConsensusSafetyDecision) error {
	decision.Step = strings.ToUpper(strings.TrimSpace(decision.Step))
	if safetyStepRank(decision.Step) < 0 || decision.Step == "BOOTSTRAP" { return fmt.Errorf("unsupported consensus safety step %q", decision.Step) }
	if decision.Height == 0 { return errors.New("consensus safety decision height must be positive") }
	if decision.ProposalHash != "" && decision.ProposalHash != "NIL" && !isSHA256(decision.ProposalHash) { return errors.New("proposalHash must be NIL or a SHA-256 digest") }
	if decision.StateRoot != "" && !isSHA256(decision.StateRoot) { return errors.New("stateRoot must be a SHA-256 digest") }
	if decision.MessageHash != "" && !isSHA256(decision.MessageHash) { return errors.New("messageHash must be a SHA-256 digest") }
	if decision.UnlockProofHash != "" && !isSHA256(decision.UnlockProofHash) { return errors.New("unlockProofHash must be a SHA-256 digest") }
	if decision.FinalizedDIRHash != "" && !isSHA256(decision.FinalizedDIRHash) { return errors.New("finalizedDIRHash must be a SHA-256 digest") }
	switch decision.Step {
	case "VERIFY":
		if decision.ProposalHash == "" { return errors.New("VERIFY requires proposalHash or NIL") }
		if decision.MessageHash == "" { return errors.New("VERIFY requires canonical messageHash") }
	case "LOCK":
		if !isSHA256(decision.ProposalHash) { return errors.New("LOCK requires a non-NIL proposalHash") }
	case "COMMIT":
		if !isSHA256(decision.ProposalHash) || decision.MessageHash == "" { return errors.New("COMMIT requires proposalHash and canonical messageHash") }
	case "ROUND_CHANGE":
		if decision.MessageHash == "" { return errors.New("ROUND_CHANGE requires canonical messageHash") }
	case "FINALIZE":
		if !isSHA256(decision.ProposalHash) || !isSHA256(decision.FinalizedDIRHash) { return errors.New("FINALIZE requires proposalHash and finalizedDIRHash") }
	}
	if (decision.UnlockProofHash == "") != (decision.UnlockProofRound == nil) { return errors.New("unlock proof hash and round must be supplied together") }
	return nil
}

func validateSafetyTransition(previous, record ConsensusSafetyRecord) error {
	if record.Height < previous.Height { return errors.New("consensus safety height rollback is forbidden") }
	if record.Height == previous.Height && record.Round < previous.Round { return errors.New("consensus safety round rollback is forbidden") }
	if record.Height == previous.Height && record.Round == previous.Round && safetyStepRank(record.Step) <= safetyStepRank(previous.Step) { return errors.New("consensus safety step rollback or duplicate journal entry is forbidden") }
	if record.Height > previous.Height && previous.FinalizedDIRHash == "" && previous.Height != 0 { return errors.New("cannot advance consensus safety height before prior height FINALIZE is durably recorded") }
	if record.Step == "VERIFY" && record.ProposalHash != "NIL" && previous.LockedDIR != "" && record.ProposalHash != previous.LockedDIR {
		if record.UnlockProofRound == nil || record.UnlockProofHash == "" || *record.UnlockProofRound <= valueOrZero(previous.LockedRound) || *record.UnlockProofRound >= record.Round { return errors.New("conflicting VERIFY requires higher-round PLC proof between lockedRound and current round") }
	}
	if record.Step == "LOCK" {
		if record.LockedDIR != record.ProposalHash || record.LockedRound == nil || *record.LockedRound != record.Round { return errors.New("LOCK safety record must persist the current proposal and round") }
	} else if record.LockedDIR != previous.LockedDIR || !sameOptionalUint64(record.LockedRound, previous.LockedRound) {
		return errors.New("existing PoVI lock changed without a durable LOCK transition")
	}
	if record.Step == "COMMIT" && (previous.LockedDIR == "" || record.ProposalHash != previous.LockedDIR || previous.LockedRound == nil || *previous.LockedRound != record.Round) { return errors.New("COMMIT safety record must match the current-round durable lock") }
	if record.Step == "FINALIZE" {
		if previous.LockedDIR == "" || record.ProposalHash != previous.LockedDIR { return errors.New("FINALIZE safety record must match the durable lock") }
		if safetyStepRank(previous.Step) < safetyStepRank("COMMIT") { return errors.New("FINALIZE cannot be recorded before COMMIT") }
	}
	return nil
}

func sameOptionalUint64(a, b *uint64) bool {
	if a == nil || b == nil { return a == nil && b == nil }
	return *a == *b
}
func valueOrZero(v *uint64) uint64 { if v == nil { return 0 }; return *v }
func cloneUint64(v *uint64) *uint64 { if v == nil { return nil }; n := *v; return &n }

func readConsensusSafetyHistory(dir string, cfg BootstrapConfig) ([]ConsensusSafetyRecord, error) {
	entries, err := os.ReadDir(consensusSafetyDir(dir))
	if err != nil { return nil, err }
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") { names = append(names, entry.Name()) }
	}
	sort.Strings(names)
	if len(names) == 0 { return nil, errors.New("consensus safety journal is empty; run init-consensus-safety") }
	records := make([]ConsensusSafetyRecord, 0, len(names))
	var previous *ConsensusSafetyRecord
	for index, name := range names {
		want := fmt.Sprintf("%020d.json", index)
		if name != want { return nil, fmt.Errorf("consensus safety journal sequence file mismatch: expected %s got %s", want, name) }
		var record ConsensusSafetyRecord
		if err := readJSON(filepath.Join(consensusSafetyDir(dir), name), &record); err != nil { return nil, err }
		if err := verifyConsensusSafetyRecord(cfg, previous, record); err != nil { return nil, fmt.Errorf("verify consensus safety sequence %d: %w", index, err) }
		records = append(records, record)
		previous = &records[len(records)-1]
	}
	return records, nil
}

func latestConsensusSafetyRecord(dir string) (BootstrapConfig, ConsensusSafetyRecord, []ConsensusSafetyRecord, error) {
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil { return cfg, ConsensusSafetyRecord{}, nil, err }
	records, err := readConsensusSafetyHistory(dir, cfg)
	if err != nil { return cfg, ConsensusSafetyRecord{}, nil, err }
	return cfg, records[len(records)-1], records, nil
}

func initializeConsensusSafety(dir string) error {
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil { return err }
	if err := os.MkdirAll(consensusSafetyDir(dir), 0o700); err != nil { return err }
	entries, err := os.ReadDir(consensusSafetyDir(dir))
	if err != nil { return err }
	for _, entry := range entries { if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") { _, _, _, err := latestConsensusSafetyRecord(dir); return err } }
	ref, ok := cfg.Keys["CONSENSUS"]
	if !ok || ref.PublicKeyHash == "" { return errors.New("CONSENSUS key reference missing from validator config") }
	record := ConsensusSafetyRecord{
		Version: consensusSafetyVersion, Domain: consensusSafetyDomain, ChainID: cfg.ChainID, ValidatorID: cfg.ValidatorID,
		Sequence: 0, Height: 0, Round: 0, Step: "BOOTSTRAP", VoteAuthority: cfg.VoteAuthority,
		ConsensusKeyHash: strings.ToLower(ref.PublicKeyHash), PreviousRecordHash: strings.ToLower(cfg.GenesisDIRHash),
		RecordedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	record, err = signConsensusSafetyRecord(dir, record)
	if err != nil { return err }
	if err := writeImmutableSafetyRecord(consensusSafetyRecordPath(dir, 0), record); err != nil { return err }
	return writeSafetyCache(dir, record)
}

func findSafetyDecision(records []ConsensusSafetyRecord, decision ConsensusSafetyDecision) (*ConsensusSafetyRecord, error) {
	for i := range records {
		record := records[i]
		if record.Height == decision.Height && record.Round == decision.Round && record.Step == decision.Step {
			if record.ProposalHash == decision.ProposalHash && record.StateRoot == decision.StateRoot && record.MessageHash == decision.MessageHash && record.UnlockProofHash == decision.UnlockProofHash && sameOptionalUint64(record.UnlockProofRound, decision.UnlockProofRound) && record.FinalizedDIRHash == decision.FinalizedDIRHash {
				return &records[i], nil
			}
			return nil, fmt.Errorf("EQUIVOCATION_BLOCKED: conflicting %s decision already durably recorded at height %d round %d", decision.Step, decision.Height, decision.Round)
		}
	}
	return nil, nil
}

func recordConsensusSafetyDecision(dir string, decision ConsensusSafetyDecision) (ConsensusSafetyRecord, error) {
	decision.Step = strings.ToUpper(strings.TrimSpace(decision.Step))
	decision.ProposalHash = strings.ToLower(strings.TrimSpace(decision.ProposalHash))
	if strings.EqualFold(decision.ProposalHash, "nil") { decision.ProposalHash = "NIL" }
	decision.StateRoot = strings.ToLower(strings.TrimSpace(decision.StateRoot))
	decision.MessageHash = strings.ToLower(strings.TrimSpace(decision.MessageHash))
	decision.UnlockProofHash = strings.ToLower(strings.TrimSpace(decision.UnlockProofHash))
	decision.FinalizedDIRHash = strings.ToLower(strings.TrimSpace(decision.FinalizedDIRHash))
	if err := validateDecisionShape(decision); err != nil { return ConsensusSafetyRecord{}, err }
	cfg, previous, records, err := latestConsensusSafetyRecord(dir)
	if err != nil { return ConsensusSafetyRecord{}, err }
	if existing, err := findSafetyDecision(records, decision); err != nil { return ConsensusSafetyRecord{}, err } else if existing != nil { return *existing, nil }
	ref := cfg.Keys["CONSENSUS"]
	record := ConsensusSafetyRecord{
		Version: consensusSafetyVersion, Domain: consensusSafetyDomain, ChainID: cfg.ChainID, ValidatorID: cfg.ValidatorID,
		Sequence: previous.Sequence+1, Height: decision.Height, Round: decision.Round, Step: decision.Step,
		ProposalHash: decision.ProposalHash, StateRoot: decision.StateRoot, MessageHash: decision.MessageHash,
		UnlockProofHash: decision.UnlockProofHash, UnlockProofRound: cloneUint64(decision.UnlockProofRound),
		LockedDIR: previous.LockedDIR, LockedRound: cloneUint64(previous.LockedRound), ValidDIR: previous.ValidDIR, ValidRound: cloneUint64(previous.ValidRound),
		FinalizedDIRHash: previous.FinalizedDIRHash, VoteAuthority: cfg.VoteAuthority,
		ConsensusKeyHash: strings.ToLower(ref.PublicKeyHash), PreviousRecordHash: previous.RecordHash, RecordedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	if record.Step == "LOCK" { r := record.Round; record.LockedDIR = record.ProposalHash; record.LockedRound = &r; record.ValidDIR = record.ProposalHash; record.ValidRound = &r }
	if record.Step == "VERIFY" && record.ProposalHash != "NIL" && previous.LockedDIR != "" && record.ProposalHash != previous.LockedDIR { record.ValidDIR = record.ProposalHash; record.ValidRound = cloneUint64(record.UnlockProofRound) }
	if record.Step == "FINALIZE" { record.FinalizedDIRHash = decision.FinalizedDIRHash }
	if err := validateSafetyTransition(previous, record); err != nil { return ConsensusSafetyRecord{}, err }
	record, err = signConsensusSafetyRecord(dir, record)
	if err != nil { return ConsensusSafetyRecord{}, err }
	if err := writeImmutableSafetyRecord(consensusSafetyRecordPath(dir, record.Sequence), record); err != nil { return ConsensusSafetyRecord{}, err }
	if err := writeSafetyCache(dir, record); err != nil { return ConsensusSafetyRecord{}, fmt.Errorf("safety journal committed but latest cache update failed: %w", err) }
	return record, nil
}

func prepareConsensusSignature(dir string, decision ConsensusSafetyDecision) (ConsensusSafetyRecord, string, error) {
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil { return ConsensusSafetyRecord{}, "", err }
	if !cfg.VoteAuthority { return ConsensusSafetyRecord{}, "", errors.New("vote authority is false; governed activation is required before consensus signing") }
	if decision.Step != "VERIFY" && decision.Step != "COMMIT" && decision.Step != "ROUND_CHANGE" { return ConsensusSafetyRecord{}, "", errors.New("outbound consensus signing is limited to VERIFY, COMMIT, and ROUND_CHANGE") }
	if !isSHA256(decision.MessageHash) { return ConsensusSafetyRecord{}, "", errors.New("canonical messageHash is required before consensus signing") }
	record, err := recordConsensusSafetyDecision(dir, decision)
	if err != nil { return ConsensusSafetyRecord{}, "", err }
	priv, err := loadConsensusPrivateKey(dir)
	if err != nil { return ConsensusSafetyRecord{}, "", err }
	digest, _ := hex.DecodeString(decision.MessageHash)
	signature := base64.StdEncoding.EncodeToString(ed25519.Sign(priv, digest))
	return record, signature, nil
}

func writeImmutableSafetyRecord(path string, record ConsensusSafetyRecord) error {
	if _, err := os.Stat(path); err == nil { return errors.New("refusing to overwrite immutable consensus safety record") } else if !os.IsNotExist(err) { return err }
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil { return err }
	b, err := json.MarshalIndent(record, "", "  ")
	if err != nil { return err }
	b = append(b, '\n')
	tmp := path + ".tmp-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	file, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil { return err }
	ok := false
	defer func(){ if !ok { _ = os.Remove(tmp) } }()
	if _, err := file.Write(b); err != nil { _ = file.Close(); return err }
	if err := file.Sync(); err != nil { _ = file.Close(); return err }
	if err := file.Close(); err != nil { return err }
	if err := os.Rename(tmp, path); err != nil { return err }
	if runtime.GOOS != "windows" {
		dir, err := os.Open(filepath.Dir(path)); if err != nil { return err }
		defer dir.Close(); if err := dir.Sync(); err != nil { return err }
	}
	ok = true
	return nil
}

func writeSafetyCache(dir string, record ConsensusSafetyRecord) error {
	return writeJSON(consensusSafetyCachePath(dir), record, 0o600)
}

func recoverConsensusSafetyCache(dir string) (ConsensusSafetyRecord, error) {
	_, latest, _, err := latestConsensusSafetyRecord(dir)
	if err != nil { return ConsensusSafetyRecord{}, err }
	if err := writeSafetyCache(dir, latest); err != nil { return ConsensusSafetyRecord{}, err }
	return latest, nil
}

func initConsensusSafetyCommand(args []string) error {
	fs := flag.NewFlagSet("init-consensus-safety", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	if err := fs.Parse(args); err != nil { return err }
	if err := initializeConsensusSafety(*dir); err != nil { return err }
	_, latest, records, err := latestConsensusSafetyRecord(*dir)
	if err != nil { return err }
	fmt.Printf("OK: initialized signed PoVI consensus safety journal at sequence %d (%s)\n", latest.Sequence, latest.RecordHash)
	fmt.Printf("OK: verified %d immutable safety record(s); candidate vote authority remains unchanged\n", len(records))
	return nil
}

func verifyConsensusSafetyCommand(args []string) error {
	fs := flag.NewFlagSet("verify-consensus-safety", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	repairCache := fs.Bool("repair-cache", false, "repair the non-authoritative latest-state cache from the signed immutable journal")
	if err := fs.Parse(args); err != nil { return err }
	_, latest, records, err := latestConsensusSafetyRecord(*dir)
	if err != nil { return err }
	if *repairCache { if _, err := recoverConsensusSafetyCache(*dir); err != nil { return err } }
	fmt.Printf("OK: verified %d signed immutable consensus safety record(s) through sequence %d\n", len(records), latest.Sequence)
	fmt.Printf("OK: recovered height=%d round=%d step=%s lockedDIR=%s\n", latest.Height, latest.Round, latest.Step, latest.LockedDIR)
	fmt.Println("NOTE: the immutable journal is authoritative; consensus-safety.json is a recoverable cache")
	return nil
}
