# STRATUM Proof-Verifying Peer Sync Implementation Profile

Status: **PARTIAL — read-only proof-verifying catch-up with governance-aware ancestry**

This profile records the current engineering implementation for read-only STRATUM Chain catch-up. The STRATUM Redbook remains the architectural authority. This profile does not grant consensus authority and does not redefine PoVI finality, validator governance, or activation rules.

## Redbook trust model preserved

The implementation keeps these trust domains separate:

1. **Transport identity** — proves which authorized peer sent a read-only message.
2. **PoVI finality** — PFC/COMMIT evidence proves that a DIR was finalized by the ACTIVE validator set at that height.
3. **Validator governance** — independently trusted governance authority proves validator membership and CONSENSUS-key transitions.
4. **Local trusted head** — advances only after independent cryptographic verification succeeds.
5. **Validator activation** — remains a separate governed process; synchronization never grants vote authority.

A downloaded peer proof may provide evidence, but it cannot nominate its own trust root.

## Read-only synchronization messages

`STRATUM-PEER-SYNC/1` defines:

- `SYNC_HEAD` — discovery of a peer's claimed latest finalized head.
- `SYNC_PROOF` — transport of snapshot, PFC/DIR finality, and validator-governance continuity evidence.

Neither message is a PoVI vote.

## Trusted-head rule

A candidate starts from independently pinned Genesis trust or another locally verified checkpoint.

`SYNC_HEAD` alone never advances trust.

A durable trusted head advances only after all applicable checks succeed:

1. chain ID / Genesis DIR / protocol trust-context binding;
2. snapshot certificate verification when a snapshot is used;
3. validator-set root verification;
4. exact DIR height continuity;
5. exact `previousDIRHash` continuity;
6. proposal and COMMIT message reconstruction;
7. ACTIVE-validator signature verification;
8. PoVI finality quorum verification;
9. DIR hash reconstruction;
10. validator-governance transition verification where the validator-set root changes.

Advancement is transactional: a failed bundle leaves the prior durable trusted head unchanged.

## Validator-set transitions

A new validator-set root cannot be accepted because a peer supplied it.

When a DIR changes validator-set root A to B, the verifier requires a valid `STRATUM-VALIDATOR-GOVERNANCE/1` transition at the exact effective height, chained from the locally trusted prior root and verified against an independently pinned governance-policy hash.

Only after that proof succeeds may B become the validator set used to verify subsequent PFC/DIR proofs.

## Multi-peer disagreement handling

`STRATUM-PEER-MULTI-SYNC/1` compares authenticated peer head claims.

- same height + same DIR hash => `EXACT_HEAD_AGREEMENT`;
- same height + different DIR hash => `FINALIZED_HEAD_CONFLICT` and automatic advancement is blocked;
- different heights => `UNRESOLVED_HEIGHT_SKEW` until proof ancestry is established.

Different heights are not automatically treated as harmless lag because a head claim alone does not prove ancestry.

## Proof-backed ancestry

`STRATUM-PEER-ANCESTRY/1` resolves height skew.

A higher peer must provide a governance-aware PFC/DIR proof chain that:

- begins exactly at `lowerHeight + 1`;
- continues the lower peer's claimed finalized `DIRHash`;
- verifies every intermediate validator set and PFC/DIR;
- ends exactly at the higher peer's claimed finalized height;
- reconstructs the same terminal DIR hash, state root, and validator-set root advertised by the higher peer.

A snapshot checkpoint above the lower peer's head may not be used to skip over the lower checkpoint when proving ancestry.

Successful verification yields `PROVEN_LAG`. A broken chain, invalid finality proof, wrong governance transition, or terminal-head mismatch yields `HISTORICAL_DIVERGENCE` or another fail-closed rejection.

## Candidate-only boundary

The proof-sync runtime requires:

- state = `CANDIDATE`;
- `voteAuthority = false`;
- no PROPOSE;
- no VERIFY vote;
- no COMMIT vote;
- no ROUND_CHANGE vote;
- no PLC vote/creation;
- no PFC vote/creation;
- no automatic ACTIVE transition.

Synchronization can make a candidate cryptographically informed about finalized STRATUM Chain history. It cannot make that candidate a consensus participant.

## Status

### Implemented on feature branch

- authenticated read-only peer transport;
- `SYNC_HEAD` and `SYNC_PROOF` recognition;
- durable proof-verified trusted head;
- snapshot-assisted catch-up;
- PFC/DIR continuity verification;
- transactional trusted-head advancement;
- governance-authenticated validator-set transitions;
- multi-peer finalized-head survey;
- same-height conflict detection;
- proof-backed ancestry verification command;
- `PROVEN_LAG` / `HISTORICAL_DIVERGENCE` classification;
- candidate-only/non-voting safety tests.

### Partial

- live multi-peer survey is implemented, while automatic network retrieval of ancestry proofs after a skewed survey is not yet fully wired into one command;
- peer disagreement handling blocks unsafe advancement but persistent peer reputation/quarantine policy is not yet implemented.

### Planned

- automatic ancestry-proof retrieval across surveyed peers;
- multi-source proof comparison;
- malicious/equivocating peer quarantine evidence;
- durable peer reputation and operator alerts;
- bounded proof-cache retention/pruning;
- continuous follower mode;
- separately governed validator activation and live PoVI participation.
