package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func safetyHex(ch string) string { return strings.Repeat(ch, 64) }
func safetyRound(v uint64) *uint64 { n := v; return &n }

func initSafetyTestValidator(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("STRATUM_ENROLLMENT_CODE", "crash-safety-test-enrollment")
	if err := initCommand([]string{
		"--dir", dir,
		"--validator-id", "validator-crash-test",
		"--friendly-label", "Crash Safety Validator",
		"--chain-id", "stratum-crash-test",
		"--network-name", "STRATUM Crash Test",
		"--genesis-hash", safetyHex("a"),
	}); err != nil { t.Fatal(err) }
	if err := initializeConsensusSafety(dir); err != nil { t.Fatal(err) }
	return dir
}

func activateSafetyTestValidator(t *testing.T, dir string) {
	t.Helper()
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil { t.Fatal(err) }
	cfg.VoteAuthority = true // test-only simulation of a previously verified governed activation
	if err := writeJSON(filepath.Join(dir, "config.json"), cfg, 0o600); err != nil { t.Fatal(err) }
}

func TestConsensusSafetyJournalInitializesSignedBootstrapAndCandidateCannotSign(t *testing.T) {
	dir := initSafetyTestValidator(t)
	cfg, latest, records, err := latestConsensusSafetyRecord(dir)
	if err != nil { t.Fatal(err) }
	if len(records) != 1 || latest.Sequence != 0 || latest.Step != "BOOTSTRAP" { t.Fatalf("unexpected bootstrap journal: %+v", records) }
	if latest.PreviousRecordHash != cfg.GenesisDIRHash { t.Fatal("bootstrap record does not bind pinned Genesis DIR hash") }
	if latest.RecordHash == "" || latest.Signature == "" { t.Fatal("bootstrap safety record is not signed") }
	if latest.VoteAuthority { t.Fatal("candidate bootstrap must not gain vote authority") }
	_, _, err = prepareConsensusSignature(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"VERIFY", ProposalHash:safetyHex("b"), MessageHash:safetyHex("c")})
	if err == nil || !strings.Contains(err.Error(), "vote authority is false") { t.Fatalf("candidate consensus signing should be denied, got %v", err) }
}

func TestConsensusSafetyBlocksSameRoundEquivocationAfterRestart(t *testing.T) {
	dir := initSafetyTestValidator(t)
	activateSafetyTestValidator(t, dir)
	first := ConsensusSafetyDecision{Height:1, Round:0, Step:"VERIFY", ProposalHash:safetyHex("b"), StateRoot:safetyHex("c"), MessageHash:safetyHex("d")}
	record1, sig1, err := prepareConsensusSignature(dir, first)
	if err != nil { t.Fatal(err) }
	if record1.Sequence != 1 || sig1 == "" { t.Fatal("VERIFY was not durably persisted before signing") }
	_, recovered, records, err := latestConsensusSafetyRecord(dir) // restart/reload simulation
	if err != nil { t.Fatal(err) }
	if len(records) != 2 || recovered.RecordHash != record1.RecordHash { t.Fatal("restart did not recover durable VERIFY history") }
	record2, sig2, err := prepareConsensusSignature(dir, first)
	if err != nil { t.Fatal(err) }
	if record2.RecordHash != record1.RecordHash || sig2 != sig1 { t.Fatal("idempotent replay changed the persisted decision or Ed25519 signature") }
	conflict := first
	conflict.ProposalHash = safetyHex("e")
	conflict.MessageHash = safetyHex("f")
	if _, _, err := prepareConsensusSignature(dir, conflict); err == nil || !strings.Contains(err.Error(), "EQUIVOCATION_BLOCKED") {
		t.Fatalf("conflicting same-round VERIFY should be blocked after restart, got %v", err)
	}
}

func TestConsensusSafetyPreservesLockAcrossRestartAndRequiresHigherRoundPLC(t *testing.T) {
	dir := initSafetyTestValidator(t)
	proposalA, proposalB := safetyHex("b"), safetyHex("c")
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"VERIFY", ProposalHash:proposalA, MessageHash:safetyHex("d")}); err != nil { t.Fatal(err) }
	locked, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"LOCK", ProposalHash:proposalA})
	if err != nil { t.Fatal(err) }
	if locked.LockedDIR != proposalA || locked.LockedRound == nil || *locked.LockedRound != 0 { t.Fatal("round-0 lock was not durably recorded") }
	if _, _, _, err := latestConsensusSafetyRecord(dir); err != nil { t.Fatal(err) } // restart/reload
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, NewRound:safetyRound(1), Step:"ROUND_CHANGE", MessageHash:safetyHex("e")}); err != nil { t.Fatal(err) }
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:1, NewRound:safetyRound(2), Step:"ROUND_CHANGE", MessageHash:safetyHex("f")}); err != nil { t.Fatal(err) }
	withoutPLC := ConsensusSafetyDecision{Height:1, Round:2, Step:"VERIFY", ProposalHash:proposalB, MessageHash:safetyHex("1")}
	if _, err := recordConsensusSafetyDecision(dir, withoutPLC); err == nil || !strings.Contains(err.Error(), "higher-round PLC proof") {
		t.Fatalf("conflicting VERIFY without PLC should fail, got %v", err)
	}
	withPLC := withoutPLC
	withPLC.UnlockProofHash = safetyHex("2")
	withPLC.UnlockProofRound = safetyRound(1)
	verifiedB, err := recordConsensusSafetyDecision(dir, withPLC)
	if err != nil { t.Fatal(err) }
	if verifiedB.LockedDIR != proposalA || verifiedB.LockedRound == nil || *verifiedB.LockedRound != 0 { t.Fatal("higher-round PLC must not erase the old lock before fresh VERIFY quorum") }
	if verifiedB.ValidDIR != proposalB || verifiedB.ValidRound == nil || *verifiedB.ValidRound != 1 { t.Fatal("PLC-backed valid value was not recovered") }
	lockedB, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:2, Step:"LOCK", ProposalHash:proposalB})
	if err != nil { t.Fatal(err) }
	if lockedB.LockedDIR != proposalB || lockedB.LockedRound == nil || *lockedB.LockedRound != 2 { t.Fatal("fresh round-2 lock did not replace prior lock") }
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:2, Step:"COMMIT", ProposalHash:proposalB, MessageHash:safetyHex("3")}); err != nil { t.Fatal(err) }
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:2, Step:"COMMIT", ProposalHash:proposalA, MessageHash:safetyHex("4")}); err == nil || !strings.Contains(err.Error(), "EQUIVOCATION_BLOCKED") {
		t.Fatalf("conflicting COMMIT should be blocked, got %v", err)
	}
}

func TestConsensusSafetyRecoversFromCacheLossUsingImmutableJournal(t *testing.T) {
	dir := initSafetyTestValidator(t)
	record, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"VERIFY", ProposalHash:safetyHex("b"), MessageHash:safetyHex("c")})
	if err != nil { t.Fatal(err) }
	if err := os.Remove(consensusSafetyCachePath(dir)); err != nil { t.Fatal(err) }
	_, latest, records, err := latestConsensusSafetyRecord(dir)
	if err != nil { t.Fatal(err) }
	if latest.RecordHash != record.RecordHash || len(records) != 2 { t.Fatal("immutable journal did not recover after cache loss") }
	recovered, err := recoverConsensusSafetyCache(dir)
	if err != nil { t.Fatal(err) }
	if recovered.RecordHash != record.RecordHash { t.Fatal("cache repair recovered the wrong record") }
	var cached ConsensusSafetyRecord
	if err := readJSON(consensusSafetyCachePath(dir), &cached); err != nil { t.Fatal(err) }
	if cached.RecordHash != record.RecordHash { t.Fatal("repaired cache does not match immutable journal") }
}

func TestConsensusSafetyRejectsTamperedImmutableHistory(t *testing.T) {
	dir := initSafetyTestValidator(t)
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"VERIFY", ProposalHash:safetyHex("b"), MessageHash:safetyHex("c")}); err != nil { t.Fatal(err) }
	path := consensusSafetyRecordPath(dir, 1)
	var tampered ConsensusSafetyRecord
	if err := readJSON(path, &tampered); err != nil { t.Fatal(err) }
	tampered.ProposalHash = safetyHex("d")
	if err := writeJSON(path, tampered, 0o600); err != nil { t.Fatal(err) }
	if _, _, _, err := latestConsensusSafetyRecord(dir); err == nil || (!strings.Contains(err.Error(), "hash mismatch") && !strings.Contains(err.Error(), "signature")) {
		t.Fatalf("tampered journal should fail closed, got %v", err)
	}
}

func TestConsensusSafetyResetsLocksOnlyAfterDurablePriorHeightFinality(t *testing.T) {
	dir := initSafetyTestValidator(t)
	proposalA, proposalB := safetyHex("b"), safetyHex("c")
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"VERIFY", ProposalHash:proposalA, MessageHash:safetyHex("d")}); err != nil { t.Fatal(err) }
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"LOCK", ProposalHash:proposalA}); err != nil { t.Fatal(err) }
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"COMMIT", ProposalHash:proposalA, MessageHash:safetyHex("e")}); err != nil { t.Fatal(err) }
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:2, Round:0, Step:"VERIFY", ProposalHash:proposalB, MessageHash:safetyHex("f")}); err == nil || !strings.Contains(err.Error(), "before prior height FINALIZE") {
		t.Fatalf("height advance before durable finality should fail, got %v", err)
	}
	finalHash := safetyHex("1")
	if _, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:1, Round:0, Step:"FINALIZE", ProposalHash:proposalA, FinalizedDIRHash:finalHash}); err != nil { t.Fatal(err) }
	nextHeight, err := recordConsensusSafetyDecision(dir, ConsensusSafetyDecision{Height:2, Round:0, Step:"VERIFY", ProposalHash:proposalB, MessageHash:safetyHex("f")})
	if err != nil { t.Fatal(err) }
	if nextHeight.LockedDIR != "" || nextHeight.LockedRound != nil || nextHeight.ValidDIR != "" || nextHeight.ValidRound != nil || nextHeight.FinalizedDIRHash != "" {
		t.Fatalf("new height inherited prior consensus state: %+v", nextHeight)
	}
}
