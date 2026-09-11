# STRATUM PoVI Proposer Entropy Implementation Profile

Status: **PARTIAL — implementation profile under conformance testing**

This document describes the current STRATUM implementation profile for deterministic proposer selection and verifiable proposer entropy within Proof of Verified Infrastructure (PoVI). It does **not** claim that the STRATUM Redbook has normatively selected an exact VRF primitive, and it is **not RFC 9381 ECVRF**.

## Purpose

The Redbook requires proposer identity and entropy/VRF evidence to be represented in PoVI trust objects. This implementation profile supplies a deterministic, cross-language mechanism that portable validators can reproduce independently while preserving the existing Redbook validator-set and finality trust history.

The profile is identified as `STRATUM-POVI-PROPOSER/1`.

## Selection model

Proposer selection for a height and round is derived from already-finalized trust material rather than from current-round entropy. The canonical selection context contains:

- `chainId`
- `height`
- `round`
- `previousDIRHash`
- `previousEntropy`
- the height-specific `validatorSetRoot`
- the height-specific `vrfKeyRegistryRoot`
- `protocolVersion`

The domain-separated selection seed is SHA-256 over the canonical context using domain `STRATUM/POVI/PROPOSER_SELECTION/1`. ACTIVE validator IDs are sorted deterministically and the seed is reduced modulo the active validator count. Every conforming implementation must therefore select the same proposer for the same trusted context.

A round change changes the domain-separated seed because `round` is part of the context. This gives higher rounds their own deterministic proposer schedule without discarding the previous finalized entropy.

## Purpose-separated entropy keys

The existing height-specific PoVI validator-set root continues to bind consensus membership and CONSENSUS key history. This profile does not alter that root because doing so would rewrite already-promoted snapshot and finality trust semantics.

Instead, a separate `STRATUM-VRF-KEY-REGISTRY/1` registry binds one purpose-separated entropy key per ACTIVE validator at a given height. The registry root is domain separated with `STRATUM/VRF_KEY_REGISTRY/1`.

For V1, each entropy key uses the algorithm label `Ed25519-Deterministic-Entropy-v1`. A conforming registry must cover exactly the ACTIVE validator set for the height and each validator must have exactly one active VRF-profile key.

## Entropy evidence

Once the deterministic proposer has been selected, that proposer signs a canonical domain-separated message hash using its active purpose-separated entropy key. The evidence domain is `STRATUM/POVI/VRF_EVIDENCE/1`.

The evidence binds:

- the selected proposer and key ID,
- height and round,
- previous DIR hash and previous finalized entropy,
- validator-set and VRF-key-registry roots,
- protocol version,
- deterministic selection seed.

The V1 `vrfOutput` is SHA-256 over the Ed25519 proof/signature bytes. This produces deterministic, independently verifiable entropy for the next finalized context. It must not be described as RFC 9381 ECVRF output.

## Fail-closed verification

The verifier rejects evidence when any of the following are inconsistent or invalid: chain or protocol context, height-specific validator-set root, height-specific VRF-key registry root, ACTIVE validator coverage, selected proposer, active key ID, canonical message hash, Ed25519 proof, or derived output.

The TypeScript implementation and portable Go implementation consume the same fixed cross-language vector and include negative tests for wrong proposer, tampered proof, wrong registry root, incomplete key coverage, tampered prior entropy, and round-domain separation.

## Governance and activation boundary

This profile does not grant vote authority. Portable validator initialization remains `CANDIDATE` with `voteAuthority: false`; no `activate`, `vote`, or `force-active` CLI command is introduced by this work.

The bootstrap blocker `VRF_CONFORMANCE_NOT_YET_IMPLEMENTED` remains intentionally present while this profile is being promoted and integrated with distributed PoVI execution. Removing that blocker is a separate governed activation decision, not a side effect of adding a verifier.

Likewise, `LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED` remains in force until Validator A/B/C networking, Byzantine/failure liveness UAT, and distributed PoVI UAT are implemented and promoted.

## Current implementation status

- TypeScript schema and verifier: **IMPLEMENTED on feature branch**
- Portable Go verifier and CLI verification command: **IMPLEMENTED on feature branch**
- Fixed cross-language test vector: **IMPLEMENTED on feature branch**
- Spatial and portable CI gates: **IMPLEMENTED on feature branch**
- Main-branch promotion: **PENDING green exact-head CI and PR promotion**
- Live proposer networking and production vote activation: **PLANNED**
