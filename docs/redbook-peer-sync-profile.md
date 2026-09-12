# STRATUM Proof-Verifying Peer Sync Implementation Profile

Status: **PARTIAL overall — read-only proof-verifying catch-up, governance-aware ancestry, peer safety controls, bounded evidence retention, operational reliability metadata, advisory peer ordering, continuous candidate follower, request-level cancellation, and durable follower status are implemented; live PoVI participation remains intentionally unimplemented**

This profile records the current engineering implementation for read-only STRATUM Chain catch-up. The STRATUM Redbook remains the architectural authority. This profile does not grant consensus authority and does not redefine PoVI finality, validator governance, or activation rules.

## Redbook trust model preserved

The implementation keeps these trust domains separate:

1. **Transport identity** — proves which authorized peer sent a read-only message.
2. **PoVI finality** — PFC/COMMIT evidence proves that a DIR was finalized by the ACTIVE validator set at that height.
3. **Validator governance** — independently trusted governance authority proves validator membership and CONSENSUS-key transitions.
4. **Local trusted head** — advances only after independent cryptographic verification succeeds.
5. **Local peer-safety state** — records authenticated head observations, evidence, and local read-only quarantine without changing PoVI membership.
6. **Operational peer reliability** — records sync-service observations only; it is never consensus weighting.
7. **Follower runtime status** — records local operational lifecycle/heartbeat state only; it has no consensus authority.
8. **Validator activation** — remains a separate governed process; synchronization never grants vote authority.

A downloaded peer proof may provide evidence, but it cannot nominate its own trust root.

## Read-only synchronization messages

`STRATUM-PEER-SYNC/1` defines:

- `SYNC_HEAD` — discovery of a peer's claimed latest finalized head.
- `SYNC_PROOF` — transport of snapshot, PFC/DIR finality, and validator-governance continuity evidence.

Both are explicitly permitted by the read-only peer transport profile. Neither message is a PoVI vote.

## Trusted-head rule

A candidate starts from independently pinned Genesis trust or another locally verified checkpoint.

`SYNC_HEAD` alone never advances trust.

A durable trusted head advances only after all applicable checks succeed:

1. chain ID / Genesis DIR / protocol trust-context binding;
2. snapshot certificate verification when a snapshot is used;
3. validator-set root verification at the applicable height;
4. exact DIR height continuity;
5. exact `previousDIRHash` continuity;
6. proposal and COMMIT message reconstruction;
7. ACTIVE-validator signature verification;
8. PoVI finality quorum verification;
9. DIR hash reconstruction;
10. validator-governance transition verification when the next DIR root cannot be derived from the already trusted validator set at that next height.

Advancement is transactional: a failed bundle leaves the prior durable trusted head unchanged.

## Height-bound validator-set roots and governance transitions

The validator-set root is height-bound. Therefore, a root value changing from height H to H+1 does **not** by itself prove that validator membership changed.

For each next DIR, the verifier first derives the expected validator-set root from the currently trusted validator set at that exact height.

- If the DIR binds that derived root, no governance transition is required.
- If the DIR binds a different root, the verifier requires a valid `STRATUM-VALIDATOR-GOVERNANCE/1` transition at the exact effective height, chained from independently trusted prior governance state and verified against an independently pinned governance-policy hash.

A downloaded proof cannot self-authorize a validator-set mutation.

## Multi-peer disagreement handling

`STRATUM-PEER-MULTI-SYNC/1` compares authenticated peer head claims.

- same height + same DIR hash => `EXACT_HEAD_AGREEMENT`;
- same height + different DIR hash from different authenticated validators => `FINALIZED_HEAD_CONFLICT` and automatic advancement is blocked;
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

Successful verification yields `PROVEN_LAG`. A broken chain, invalid finality proof, wrong governance transition, or terminal-head mismatch yields a fail-closed result and blocks automatic advancement.

## Cross-run authenticated-head evidence

`STRATUM-PEER-HEAD-STATE/1` durably records the latest authenticated `SYNC_HEAD` observation for each peer identity, bound to chain ID, Genesis DIR hash, and protocol version.

A later observation from the same authenticated validator is compared with the previous observation across process restarts:

- same peer + same finalized height + same DIR hash => consistent repeat observation;
- same peer + higher finalized height => ordinary advancement, not equivocation;
- same peer + same finalized height + different DIR hash => `HEAD_EQUIVOCATION` evidence.

`HEAD_EQUIVOCATION` is persisted in the peer evidence journal and the peer becomes locally quarantined from read-only synchronization selection.

## Evidence, retention, and local quarantine

Peer safety evidence is persisted under `STRATUM-PEER-EVIDENCE-JOURNAL/1`. Local quarantine is persisted under `STRATUM-PEER-QUARANTINE/1`.

The implementation distinguishes network disagreement from peer self-inconsistency:

- `FINALIZED_HEAD_CONFLICT` between different authenticated validators => evidence + safety halt; no automatic punishment of either validator;
- separately verified divergent history => evidence + safety halt/operator review;
- a peer's proof-verified terminal DIR contradicting that same peer's authenticated `SYNC_HEAD` => `PROOF_HEAD_MISMATCH` and local quarantine;
- the same authenticated peer issuing contradictory finalized heads at the same height => `HEAD_EQUIVOCATION` and local quarantine.

Local quarantine affects only read-only sync peer selection. It does **not** remove a validator from the PoVI validator set, change consensus weight, revoke vote authority, alter validator governance, or activate/deactivate a validator.

Operators may inspect quarantine state and explicitly release a peer after review. Release preserves historical evidence hashes.

Local peer-operational evidence retention is bounded. The implementation retains up to 4,096 unpinned evidence entries while preserving every evidence hash referenced by quarantine state, including historical `RELEASED_BY_OPERATOR` records. Pinned safety evidence may therefore exceed the unpinned cap rather than being deleted. This retention mechanism applies only to local peer-operational evidence; trust-critical DIR/PFC history is outside this pruning path.

## Operational peer reliability and advisory ordering

`STRATUM-PEER-RELIABILITY/1` persists operational sync metadata such as authenticated-head observations, successful proof ancestry, unresolved ancestry, and objective peer-safety faults.

The profile carries an explicit `consensusWeighting=false` invariant. Loading or saving reliability state with consensus weighting enabled is rejected.

Reliability is now used only for advisory query ordering among peers that are already authenticated and cryptographically eligible for follower advancement. `EXACT_HEAD_AGREEMENT` peers may be ordered operationally after agreement is established. For `PROVEN_LAG`, a peer may enter the candidate set only when its ancestry classification is itself `PROVEN_LAG`. Reliability cannot make an unproven peer eligible, cannot turn `AutoAdvanceAllowed=false` into true, and cannot resolve a finalized-history conflict.

Reliability may not select canonical history, change PoVI quorum weight, change validator membership, alter PFC/DIR verification, or grant vote authority. Ordinary disagreement between different authenticated validators is not counted as a peer fault.

## Continuous read-only follower

`STRATUM-PEER-FOLLOWER/1` is implemented as the `peer-sync-follow` command for candidate nodes.

Each cycle:

1. loads independently trusted peer-registry state;
2. requires local state = `CANDIDATE` and `voteAuthority=false`;
3. surveys authenticated `SYNC_HEAD` responses;
4. persists cross-run authenticated head observations and objective evidence;
5. excludes locally quarantined peer identities from sync selection;
6. resolves exact agreement or proof-backed height skew;
7. requires `AutoAdvanceAllowed=true` before any reliability ordering is considered;
8. selects only an authenticated proof-eligible peer, with reliability used only as an advisory ordering signal among that eligible set;
9. re-authenticates that peer and requires its finalized head to remain unchanged since the survey;
10. downloads bounded governed `SYNC_PROOF` batches;
11. advances only through the existing governance-aware proof verifier and durable trusted-head transaction boundary.

`FINALIZED_HEAD_CONFLICT` and `HISTORICAL_DIVERGENCE` cause a safety halt. Transient/unresolved conditions use bounded retry/backoff. A follower cycle never converts a candidate into an ACTIVE validator.

The follower has no path to PROPOSE, VERIFY, COMMIT, ROUND_CHANGE, create PLC/PFC votes, or alter validator governance.

## Managed follower lifecycle, cancellation, and status

`STRATUM-PEER-FOLLOWER-STATUS/1` persists trust-context-bound local follower lifecycle state in `peer-follower-status.json`.

The public `peer-sync-follow` command is signal-aware for `SIGINT` and `SIGTERM`. Cancellation propagates through polling/backoff waits and through the managed follower's peer HTTP requests using request contexts. Survey requests, ancestry-proof retrieval, selected-head refresh, and governed proof downloads can therefore be canceled while in flight rather than waiting for the ordinary request lifecycle to finish.

The managed wrapper records operational states such as `RUNNING`, `IDLE`, `BACKOFF`, `SAFETY_HALT`, and `STOPPED`, plus the last resolution classification, locally proof-verified trusted height/hash, selected peer identity, failure count, last error, and next retry time where applicable.

Follower status is bound to chain ID, Genesis DIR hash, and protocol version. A foreign trust context is rejected. The persisted status profile hard-codes `voteAuthority=false` and `consensusParticipation=false`; loading or saving a status that claims consensus participation is rejected.

Operators may inspect the current local follower state with `peer-follower-status`. This command is read-only and cannot alter PoVI membership, governance, finality, validator activation, or consensus weight.

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
- explicit `SYNC_HEAD` and `SYNC_PROOF` transport recognition;
- durable proof-verified trusted head;
- snapshot-assisted catch-up;
- PFC/DIR continuity verification;
- transactional trusted-head advancement;
- height-bound validator-set root handling;
- governance-authenticated validator-set transitions;
- multi-peer finalized-head survey;
- same-height network conflict detection;
- proof-backed ancestry verification;
- live survey-to-ancestry resolver;
- `PROVEN_LAG`, `HISTORICAL_DIVERGENCE`, and fail-closed unresolved classifications;
- trust-context-bound peer evidence journal;
- bounded retention of unpinned local peer-operational evidence with quarantine/release-linked evidence pinned;
- local peer quarantine state;
- operator quarantine status/release commands;
- proof/head self-inconsistency quarantine policy;
- durable cross-run authenticated peer-head state;
- cross-run `HEAD_EQUIVOCATION` detection;
- operational peer reliability state with explicit `consensusWeighting=false`;
- reliability status command and objective-fault accounting;
- advisory reliability-based query ordering only among already proof-eligible peers;
- continuous `peer-sync-follow` candidate follower with bounded polling/backoff;
- follower re-authentication/head-stability check before proof download;
- governed proof-only durable advancement;
- signal-aware follower shutdown during polling/backoff waits;
- request-level cancellation propagated through managed follower peer HTTP calls;
- durable `STRATUM-PEER-FOLLOWER-STATUS/1` heartbeat/status state;
- read-only `peer-follower-status` command;
- candidate-only/non-voting safety tests;
- dedicated peer-sync CI covering formatting, vet, race tests, host build, Raspberry Pi ARM64 build, and trust-boundary invariants;
- full portable-validator CI covering trust vectors, host build, Linux ARM64/AMD64, macOS ARM64, Windows AMD64, and safety invariants.

### Partial

- operator alert delivery for safety halts and quarantines is not yet implemented;
- proof-cache retention/pruning remains incomplete; the implemented evidence-retention mechanism covers local peer-operational evidence, not trust-critical chain history;
- service lifecycle packaging/auto-start for supported operating systems is not yet implemented;
- wider Byzantine/network/storage/power-loss qualification remains incomplete.

### Planned

- local operator alert journal/status surface, followed by optional external alert integrations for safety halts and quarantines;
- bounded non-authoritative proof-cache lifecycle management where appropriate, without pruning trust-critical DIR/PFC history;
- service lifecycle packaging/auto-start for supported operating systems;
- separately governed validator activation and live PoVI participation.
