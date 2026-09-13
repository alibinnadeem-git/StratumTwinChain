# STRATUM Proof-Verifying Peer Sync Implementation Profile

Status: **PARTIAL overall — read-only proof-verifying catch-up, governance-aware ancestry, peer safety controls, bounded evidence retention, operational reliability metadata, advisory peer ordering, continuous candidate follower, request-level cancellation, durable follower status, local operator alert journaling, append-only alert acknowledgements, explicit and optional follower-triggered one-way webhook alert delivery with bounded delivery receipts, bounded non-authoritative verified-proof caching, and reviewable candidate-only auto-start packaging for Linux/Raspberry Pi, macOS, and Windows are implemented; live PoVI participation remains intentionally unimplemented**

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
8. **Local operator alerts and acknowledgements** — surface already-derived safety events and record operator review metadata; they carry no consensus authority and cannot release quarantine or resume advancement.
9. **Operator alert delivery** — transmits an already-existing local alert outward and records non-authoritative delivery receipts; webhook responses cannot mutate local safety, trust, canonical history, governance, or consensus state.
10. **Verified proof cache** — stores only redundant copies of proof bundles after successful governed verification; it cannot select canonical history or carry consensus authority.
11. **Service lifecycle packaging** — emits reviewable auto-start artifacts only for the already non-voting follower; package generation cannot activate a validator or grant vote authority.
12. **Validator activation** — remains a separate governed process; synchronization never grants vote authority.

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

Reliability is used only for advisory query ordering among peers that are already authenticated and cryptographically eligible for follower advancement. `EXACT_HEAD_AGREEMENT` peers may be ordered operationally after agreement is established. For `PROVEN_LAG`, a peer may enter the candidate set only when its ancestry classification is itself `PROVEN_LAG`. Reliability cannot make an unproven peer eligible, cannot turn `AutoAdvanceAllowed=false` into true, and cannot resolve a finalized-history conflict.

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
7. persists local operator alerts from already-derived objective evidence and safety-halt classification;
8. requires `AutoAdvanceAllowed=true` before any reliability ordering is considered;
9. selects only an authenticated proof-eligible peer, with reliability used only as an advisory ordering signal among that eligible set;
10. re-authenticates that peer and requires its finalized head to remain unchanged since the survey;
11. downloads bounded governed `SYNC_PROOF` batches;
12. advances only through the existing governance-aware proof verifier and durable trusted-head transaction boundary;
13. only after successful verification and durable advancement, may persist a redundant non-authoritative copy of that verified proof bundle in the bounded local cache.

`FINALIZED_HEAD_CONFLICT` and `HISTORICAL_DIVERGENCE` cause a safety halt. Transient/unresolved conditions use bounded retry/backoff. A follower cycle never converts a candidate into an ACTIVE validator.

The follower has no path to PROPOSE, VERIFY, COMMIT, ROUND_CHANGE, create PLC/PFC votes, or alter validator governance.

## Managed follower lifecycle, cancellation, and status

`STRATUM-PEER-FOLLOWER-STATUS/1` persists trust-context-bound local follower lifecycle state in `peer-follower-status.json`.

The public `peer-sync-follow` command is signal-aware for `SIGINT` and `SIGTERM`. Cancellation propagates through polling/backoff waits and through the managed follower's peer HTTP requests using request contexts. Survey requests, ancestry-proof retrieval, selected-head refresh, governed proof downloads, and optional webhook delivery can therefore be canceled while in flight rather than waiting for the ordinary request lifecycle to finish.

The managed wrapper records operational states such as `RUNNING`, `IDLE`, `BACKOFF`, `SAFETY_HALT`, and `STOPPED`, plus the last resolution classification, locally proof-verified trusted height/hash, selected peer identity, failure count, last error, and next retry time where applicable.

Follower status is bound to chain ID, Genesis DIR hash, and protocol version. A foreign trust context is rejected. The persisted status profile hard-codes `voteAuthority=false` and `consensusParticipation=false`; loading or saving a status that claims consensus participation is rejected.

Operators may inspect the current local follower state with `peer-follower-status`. This command is read-only and cannot alter PoVI membership, governance, finality, validator activation, or consensus weight.

## Local operator alert journal, acknowledgements, and external delivery

`STRATUM-PEER-OPERATOR-ALERTS/1` persists trust-context-bound local alerts in `peer-operator-alerts.json`.

The journal is operational metadata only and hard-fails if `consensusAuthority=true`. It does not select chain history, change quorum weight, modify validator membership, or grant vote authority.

Alerts are derived from existing safety evidence rather than from a parallel fault detector:

- `HEAD_EQUIVOCATION` and `PROOF_HEAD_MISMATCH` may produce `PEER_QUARANTINED` alerts;
- `FINALIZED_HEAD_CONFLICT` and `HISTORICAL_DIVERGENCE` produce `FOLLOWER_SAFETY_HALT` alerts.

Alert IDs are deterministic SHA-256 identifiers bound to chain/Genesis/protocol context and the underlying evidence/source key, so repeated observation of the same event does not append duplicate alerts. Operators may inspect the journal with the read-only `peer-alert-status` command.

`peer-alert-ack` appends a separate `PeerOperatorAlertAcknowledgement` record bound to an existing alert ID, operator identity, note, and acknowledgement timestamp. The original alert remains present and unchanged. Acknowledgement is idempotent for an already-acknowledged alert and cannot release a quarantined peer, clear a follower safety halt, resume automatic advancement, change reliability scoring, or affect consensus state. Quarantine release remains a separate explicit operator action.

`STRATUM-PEER-ALERT-DELIVERY/1` implements explicit one-way webhook delivery of an already-existing local operator alert through `peer-alert-deliver-webhook`, and optional follower-triggered delivery through `peer-sync-follow --alert-webhook`.

Delivery preserves these boundaries:

- the validator must still be `CANDIDATE` with `voteAuthority=false`;
- remote webhook endpoints must use HTTPS; plaintext HTTP is allowed only for loopback testing;
- embedded URL credentials are rejected;
- optional bearer authentication is read from an owner-only token file rather than accepted as command-line secret material;
- HTTP redirects are not followed;
- the response body is bounded and discarded rather than interpreted;
- webhook responses cannot acknowledge alerts, release quarantine, clear `SAFETY_HALT`, resume automatic advancement, select canonical history, mutate trusted heads, alter validator governance, or affect PoVI state.

Delivery attempts are recorded separately in the trust-context-bound `peer-operator-alert-deliveries.json` journal. Every receipt carries `consensusAuthority=false` and `safetyStateMutation=false`. The read-only `peer-alert-delivery-status` command reports attempt history and may filter by exact alert ID without replaying or mutating an alert.

Delivery receipt retention is bounded to **4,096 receipts**. The normal receipt append path automatically enforces this hard cap, and `peer-alert-delivery-prune` remains available for explicit operator enforcement. Retention removes only the oldest non-authoritative delivery receipts. It does not prune or alter alerts, acknowledgement records, quarantine/evidence, follower safety state, trusted heads, snapshots, DIR/PFC history, validator governance, or proof-cache material. Malformed receipt timestamps fail closed rather than being silently discarded.

Optional follower-triggered webhook delivery is a best-effort notification layer over alerts that have already been durably persisted. The follower first persists its own `IDLE`, `BACKOFF`, `SAFETY_HALT`, or `STOPPED` lifecycle/safety status and only then attempts external delivery. Webhook failure therefore cannot change or delay the durable safety classification. Successful delivery is deduplicated per alert and endpoint; locally acknowledged alerts are skipped; failed deliveries remain eligible for retry on later cycles. Automatic delivery is bounded to **16 pending alerts per follower cycle** so an old notification backlog cannot become an unbounded follower workload.

Email, SMS/paging, and third-party incident-management integrations remain unimplemented optional notification-layer work. They are not consensus, governance, or safety authority.

## Bounded non-authoritative verified-proof cache

`STRATUM-PEER-PROOF-CACHE/1` stores redundant local copies of governed `SYNC_PROOF` bundles only after the existing verifier has successfully applied the bundle and durably advanced the local trusted head.

The cache manifest is bound to chain ID, Genesis DIR hash, and protocol version. It hard-fails if either `consensusAuthority=true` or `canonicalHistorySelection=true`. Cache content therefore cannot decide which chain is canonical, grant vote authority, change PoVI quorum weight, alter validator membership, or bypass PFC/DIR/governance verification.

Retention is bounded to **64 verified bundles or 64 MiB**, whichever limit is reached first. Pruning removes the oldest redundant manifest-listed `verified-bundle-*.json` files only. It does not prune the durable trusted head, source snapshots, peer evidence, quarantine state, DIR/PFC trust history, operator-supplied proof material, or any other trust-critical chain record.

Cache persistence is deliberately best-effort and occurs after verification/advancement. A cache write or prune failure cannot roll back or block an already proof-verified trusted-head advance. Cached material currently has no authority-bearing replay path back into verification; future reuse would still require the normal independent trust verification path.

Operators may inspect or enforce the bounded retention policy with:

- `peer-proof-cache-status`
- `peer-proof-cache-prune`

## Candidate-only service lifecycle packaging

Reviewable auto-start packaging is implemented for the read-only candidate follower. Package generation first loads local validator configuration and fails closed unless `state=CANDIDATE` and `voteAuthority=false`.

Supported packaging surfaces are:

- `STRATUM-PEER-FOLLOWER-SYSTEMD/1` via `peer-service-package-systemd` for Linux and Raspberry Pi;
- `STRATUM-PEER-FOLLOWER-LAUNCHD/1` via `peer-service-package-launchd` for macOS;
- `STRATUM-PEER-FOLLOWER-WINDOWS-TASK/1` via `peer-service-package-windows-task` for Windows Task Scheduler startup.

Every generated runtime launches `peer-sync-follow` only. None of these package generators installs or activates a validator implicitly, and none can enable PROPOSE, VERIFY, COMMIT, ROUND_CHANGE, PLC/PFC voting, or an ACTIVE transition.

Linux/Raspberry Pi and macOS emit reviewable install/uninstall service artifacts. Windows emits reviewable PowerShell Task Scheduler scripts using an `AtStartup` trigger and `RunLevel Limited`; the installer requests the configured Windows user's credential at install time and does not write the password into generated package files.

The Windows package is intentionally described as **Task Scheduler auto-start packaging, not a Windows Service Control Manager service**. Native Windows SCM service integration is not claimed by this profile.

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
- durable trust-context-bound `STRATUM-PEER-OPERATOR-ALERTS/1` journal;
- deterministic alert deduplication from objective safety evidence;
- local `PEER_QUARANTINED` and `FOLLOWER_SAFETY_HALT` alert generation;
- read-only `peer-alert-status` command;
- append-only/idempotent `peer-alert-ack` operator acknowledgement workflow;
- permanent tests/CI guard that alert acknowledgement does not release quarantine or gain consensus authority;
- explicit one-way `STRATUM-PEER-ALERT-DELIVERY/1` webhook delivery of an existing local alert;
- optional best-effort follower-triggered webhook delivery of already-persisted local alerts;
- follower lifecycle/safety status persisted before automatic external delivery;
- endpoint-scoped successful-delivery deduplication, acknowledgement skipping, and later-cycle retry of failed deliveries;
- automatic delivery bounded to 16 pending alerts per follower cycle;
- remote HTTPS requirement with loopback-only HTTP testing exception;
- owner-only bearer-token-file authentication and redirect refusal;
- request-context cancellation for follower-triggered webhook requests;
- non-authoritative delivery receipt journal with webhook response bodies ignored;
- read-only `peer-alert-delivery-status` command;
- automatic hard delivery-receipt retention at 4,096 records plus explicit `peer-alert-delivery-prune`;
- permanent alert-delivery CI guards preventing acknowledgement, quarantine release, trusted-head changes, governed-proof application, or other safety/consensus mutation;
- trust-context-bound `STRATUM-PEER-PROOF-CACHE/1` manifest;
- post-verification-only caching of governed proof bundles;
- bounded retention at 64 bundles / 64 MiB with deterministic oldest-first pruning;
- cache pruning limited to safe manifest-listed `verified-bundle-*` files;
- explicit `consensusAuthority=false` and `canonicalHistorySelection=false` cache invariants;
- `peer-proof-cache-status` and `peer-proof-cache-prune` operator commands;
- permanent CI assertion that proof caching occurs only after governed proof verification and remains best-effort/non-authoritative;
- reviewable Linux/Raspberry Pi `systemd` candidate-follower package generation;
- reviewable macOS `launchd` candidate-follower package generation;
- reviewable Windows Task Scheduler candidate-follower auto-start package generation;
- dedicated Windows startup-task CI covering formatting, vet, package tests, Windows AMD64 cross-build, credential-at-install behavior, and non-SCM/non-consensus invariants;
- candidate-only/non-voting safety tests;
- dedicated peer-sync CI covering formatting, vet, race tests, host build, Raspberry Pi ARM64 build, alert/reliability/cancellation/cache/service boundaries, and trust-boundary invariants;
- full portable-validator CI covering trust vectors, host build, Linux ARM64/AMD64, macOS ARM64, Windows AMD64, and safety invariants.

### Partial

- email/SMS/paging and third-party incident-management integration are not implemented;
- native Windows SCM service integration is not implemented; Windows auto-start currently uses reviewable Task Scheduler packaging instead;
- wider Byzantine/network/storage/power-loss qualification remains incomplete.

### Planned

- optional email/SMS/paging/incident-management notification integrations that remain strictly non-authoritative;
- optional native Windows SCM service wrapper/integration if an operational requirement justifies it;
- separately governed validator activation and live PoVI participation.
