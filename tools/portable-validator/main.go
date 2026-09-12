package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "init":
		err = initCommand(os.Args[2:])
	case "doctor":
		err = doctorCommand(os.Args[2:])
	case "init-consensus-safety":
		err = initConsensusSafetyCommand(os.Args[2:])
	case "verify-consensus-safety":
		err = verifyConsensusSafetyCommand(os.Args[2:])
	case "verify-genesis":
		err = verifyCanonicalGenesisCommand(os.Args[2:])
	case "verify-genesis-trust":
		err = verifyGenesisTrustCommand(os.Args[2:])
	case "verify-snapshot":
		err = verifySnapshotCommand(os.Args[2:])
	case "verify-finality":
		err = verifyFinalityCommand(os.Args[2:])
	case "verify-validator-governance":
		err = verifyValidatorGovernanceCommand(os.Args[2:])
	case "verify-round-change":
		err = verifyRoundChangeCommand(os.Args[2:])
	case "verify-plc":
		err = verifyPLCCommand(os.Args[2:])
	case "verify-proposer":
		err = verifyProposerCommand(os.Args[2:])
	case "verify-peer-envelope":
		err = verifyPeerEnvelopeCommand(os.Args[2:])
	case "serve-readonly-peer":
		err = peerSessionServerCommand(os.Args[2:])
	case "serve-readonly-peer-sync":
		err = peerSyncServerCommand(os.Args[2:])
	case "serve-readonly-peer-sync-governed":
		err = peerSyncGovernedServerCommand(os.Args[2:])
	case "peer-probe":
		err = peerProbeCommand(os.Args[2:])
	case "peer-sync":
		err = peerSyncCommand(os.Args[2:])
	case "peer-sync-governed":
		err = peerSyncGovernedCommand(os.Args[2:])
	case "peer-sync-survey":
		err = peerMultiSurveyCommand(os.Args[2:])
	case "peer-sync-resolve":
		err = peerSyncResolveCommand(os.Args[2:])
	case "peer-sync-follow":
		err = peerSyncFollowerManagedCommand(os.Args[2:])
	case "peer-follower-status":
		err = peerFollowerStatusCommand(os.Args[2:])
	case "peer-quarantine-status":
		err = peerQuarantineStatusCommand(os.Args[2:])
	case "peer-quarantine-release":
		err = peerQuarantineReleaseCommand(os.Args[2:])
	case "peer-reliability-status":
		err = peerReliabilityStatusCommand(os.Args[2:])
	case "verify-peer-ancestry":
		err = verifyPeerAncestryCommand(os.Args[2:])
	case "verify-package":
		err = verifyPackageCommand(os.Args[2:])
	case "version":
		fmt.Println(bootstrapVersion)
		return
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "STRATUM portable validator bootstrap")
	fmt.Fprintln(os.Stderr, "commands: init, doctor, init-consensus-safety, verify-consensus-safety, verify-genesis, verify-genesis-trust, verify-snapshot, verify-finality, verify-validator-governance, verify-round-change, verify-plc, verify-proposer, verify-peer-envelope, serve-readonly-peer, serve-readonly-peer-sync, serve-readonly-peer-sync-governed, peer-probe, peer-sync, peer-sync-governed, peer-sync-survey, peer-sync-resolve, peer-sync-follow, peer-follower-status, peer-quarantine-status, peer-quarantine-release, peer-reliability-status, verify-peer-ancestry, verify-package, version")
	fmt.Fprintln(os.Stderr, "This bootstrap creates CANDIDATE nodes only. It never grants vote authority.")
	fmt.Fprintln(os.Stderr, "Peer sync is read-only. Height skew becomes PROVEN_LAG only after governance-aware PFC/DIR ancestry verification; otherwise advancement remains blocked.")
	fmt.Fprintln(os.Stderr, "peer-sync-follow is a signal-aware read-only CANDIDATE proof follower. It never proposes, votes, commits, round-changes, creates PLC/PFC votes, or activates a validator.")
	fmt.Fprintln(os.Stderr, "Peer follower status, quarantine, and reliability are local operational metadata only; they do not alter PoVI membership, governance, consensus weighting, or vote authority.")
}
