# STRATUM Portable Validator

Status: **P0 / candidate-only portable validator with authenticated read-only peer transport and proof-verifying follower sync**. This is **not yet a live PoVI voting runtime** and does not grant consensus authority.

The Redbook portable-validator flow is:

install → verify Genesis → local purpose-separated keys → enrollment → peer discovery → proof-verifying sync → `CANDIDATE` → governed future-height `ACTIVE`.

The repository now implements substantial trust-verification, crash-safety, read-only peer synchronization, multi-peer disagreement handling, bounded verified-proof caching, continuous follower operation, explicit and optional follower-triggered one-way operator webhook alert delivery, and reviewable candidate-only auto-start packaging while deliberately keeping portable nodes non-voting.

## Implemented foundation

The portable validator currently provides:

- permanent local validator identity creation without overwriting an existing identity;
- purpose-separated `CONSENSUS`, `VRF`, and `TRANSPORT` key material;
- private key files stored only under `keys/private` with restrictive filesystem permissions;
- enrollment codes accepted through `STRATUM_ENROLLMENT_CODE` or a permission-restricted file, never as a command-line secret value;
- canonical Genesis DIR verification and threshold Genesis trust-certificate verification;
- snapshot certificate and validator-set-root verification;
- PFC and finalized DIR continuity verification;
- governed validator-set-change verification;
- ROUND_CHANGE liveness verification;
- PLC safe-reproposal verification;
- proposer/entropy implementation-profile verification;
- authenticated read-only peer-envelope verification;
- multi-peer finalized-head survey and conflict detection;
- governance-aware proof-backed ancestry verification;
- durable authenticated peer-head observations across restarts;
- evidence journaling, bounded unpinned peer-evidence retention, and local read-only peer quarantine;
- operational peer reliability metadata with `consensusWeighting=false`;
- advisory reliability ordering only among already proof-eligible sync peers;
- continuous read-only candidate follower sync with bounded polling/backoff;
- signal-aware follower lifecycle and in-flight peer-request cancellation;
- durable read-only follower status/heartbeat state;
- durable local operator-alert journaling from objective follower safety evidence;
- append-only operator alert acknowledgements that do not clear quarantine or safety state;
- explicit one-way HTTPS webhook delivery of an existing operator alert;
- optional follower-triggered best-effort webhook delivery of already-persisted alerts;
- follower lifecycle/safety status persistence before automatic external delivery;
- endpoint-scoped successful-delivery deduplication, acknowledgement skipping, and later-cycle retry of failed deliveries;
- automatic delivery bounded to 16 pending alerts per follower cycle;
- trust-context-bound, non-authoritative alert-delivery receipts with read-only status inspection;
- automatic hard alert-delivery receipt retention at 4,096 receipts plus an explicit prune command;
- bounded non-authoritative caching of already verified governed proof bundles;
- reviewable Linux/Raspberry Pi `systemd` candidate-follower auto-start packaging;
- reviewable macOS `launchd` candidate-follower auto-start packaging;
- reviewable Windows Task Scheduler candidate-follower auto-start packaging;
- crash/restart consensus-safety journal verification;
- signed package-manifest verification;
- cross-build gates for Raspberry Pi/Linux ARM64, Linux AMD64, macOS ARM64, and Windows AMD64.

## Safety boundary

A successful install **never grants vote authority**. The validator is created as `CANDIDATE` with `voteAuthority: false`. The CLI exposes no `activate`, `vote`, or `force-active` command.

Governed activation and live consensus participation are separate future steps. The local bootstrap retains these explicit blockers:

- `GOVERNANCE_ACTIVATION_REQUIRED`
- `VRF_CONFORMANCE_NOT_YET_IMPLEMENTED`
- `LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED`

The current proposer/entropy mechanism is a STRATUM implementation profile used for deterministic cross-language verification. It is not represented as the Redbook having normatively selected an RFC 9381 ECVRF primitive.

## Read-only authenticated peer transport

The current peer transport explicitly recognizes these read-only application messages:

- `PING`
- `STATUS`
- `TRUST_ROOTS`
- `SYNC_HEAD`
- `SYNC_PROOF`

`SYNC_HEAD` advertises an authenticated peer's claimed finalized head. It is discovery information only and **never advances local trust by itself**.

`SYNC_PROOF` transports snapshot, PFC/DIR finality, validator-set, and governed validator-transition evidence used by the local verifier. It is not a PoVI vote.

Every peer envelope is bound to the STRATUM Chain identity, network name, Genesis DIR hash, protocol version, sender validator identity, sender TRANSPORT key, monotonic sequence, nonce, issuance/expiry times, message type, canonical payload hash, message hash, and Ed25519 TRANSPORT signature.

The peer-key registry is height-aware. Incoming envelopes are rejected for wrong chain/Genesis/protocol context, untrusted or inactive peer keys, signature/hash mismatch, stale or future timestamps, reused nonce, or sequence rollback.

`PROPOSAL`, `VERIFY`, `COMMIT`, `ROUND_CHANGE`, PLC/PFC voting traffic, and all other consensus-bearing messages remain disabled in this runtime slice.

### Transport security boundary

The signed application envelope provides peer authentication and message integrity. It does **not** by itself provide network confidentiality.

`serve-readonly-peer` defaults to loopback-only plaintext (`127.0.0.1:9443`). A non-loopback plaintext listener is refused unless the operator explicitly acknowledges a trusted reverse-proxy/TLS boundary with `--allow-plaintext-lan`. Remote peer clients refuse unsafe non-loopback plaintext HTTP targets; remote deployments are expected to use HTTPS or a future native secure transport profile.

This is an implementation profile. It does not claim that the Redbook normatively mandates HTTP, TLS termination, mTLS, QUIC, WebSockets, or another specific wire transport.

## Proof-verifying peer synchronization

The synchronization model separates peer claims from locally verified trust:

1. `peer-sync-survey` authenticates multiple `SYNC_HEAD` claims.
2. `peer-sync-resolve` distinguishes exact agreement, unresolved height skew, proof-backed lag, and finalized-history conflicts.
3. `SYNC_HEAD` alone never moves the durable trusted head.
4. `SYNC_PROOF` evidence is verified locally using snapshot, PFC/DIR continuity, and validator-governance verification.
5. The durable local trusted head advances transactionally only after all required checks succeed.
6. Only after successful governed verification and durable advancement may the follower persist a redundant copy of that verified proof bundle in the local bounded cache.

Important classifications include:

- `EXACT_HEAD_AGREEMENT` — authenticated peers advertise the same finalized height and DIR hash;
- `UNRESOLVED_HEIGHT_SKEW` — peers advertise different heights and ancestry is not yet proven;
- `PROVEN_LAG` — a higher peer cryptographically proves its finalized history extends the lower finalized checkpoint;
- `FINALIZED_HEAD_CONFLICT` — authenticated peers advertise different DIR hashes at the same finalized height; automatic advancement halts;
- `HISTORICAL_DIVERGENCE` — separately verified finalized histories cannot be reconciled; automatic advancement halts for operator review.

Do not interpret a higher advertised height as canonical merely because more peers report it. Proof verification, not peer-count popularity, advances local trust.

## Continuous read-only follower

`peer-sync-follow` continuously performs authenticated survey → resolve → governed proof verification → durable trusted-head advancement while the local validator remains `CANDIDATE` with `voteAuthority=false`.

The follower:

- persists authenticated head observations across process restarts;
- excludes locally quarantined identities from sync selection;
- records local operator alerts from existing objective evidence/safety classifications;
- requires the resolver to set `AutoAdvanceAllowed=true` before peer selection;
- limits selection to authenticated peers already eligible through exact agreement or proof-backed ancestry;
- uses reliability only to order that already eligible set operationally;
- re-authenticates the selected peer before proof download;
- requires that peer's finalized head to remain unchanged since the survey;
- requests bounded `SYNC_PROOF` batches;
- advances only through the existing governance-aware proof verifier;
- caches a proof bundle only after it has successfully advanced the verified trusted head;
- treats proof-cache writes/pruning as best-effort redundant storage, so cache failure does not block verified advancement;
- retries transient/unresolved conditions with bounded backoff;
- halts on finalized-history safety conflicts;
- propagates SIGINT/SIGTERM cancellation into in-flight survey, ancestry, head-refresh, governed proof, and optional alert-webhook HTTP requests;
- when `--alert-webhook` is configured, persists `IDLE`, `BACKOFF`, `SAFETY_HALT`, or `STOPPED` first and only then attempts best-effort external notification;
- skips locally acknowledged alerts and alerts already successfully delivered to the configured endpoint;
- leaves failed webhook attempts eligible for retry on a later cycle;
- attempts at most 16 pending alert deliveries per follower cycle;
- never PROPOSEs, VERIFY-votes, COMMIT-votes, ROUND_CHANGE-votes, creates PLC/PFC votes, or activates the validator.

Reliability ordering cannot add an unproven peer to a `PROVEN_LAG` candidate set, cannot make `AutoAdvanceAllowed=false` become true, and cannot choose canonical history. Persisted reliability state with `consensusWeighting=true` is rejected.

Single-cycle example:

```bash
./stratum-validator-bootstrap peer-sync-follow \
  --peer-registry peer-registry.json \
  --peer-registry-root <64-char-sha256> \
  --height <trusted-registry-height> \
  --targets https://validator-a.example,https://validator-b.example,https://validator-c.example \
  --governance-policy-hash <64-char-sha256> \
  --once
```

For continuous operation, omit `--once`. The default successful polling interval is 15 seconds and retry backoff is bounded; both can be configured with `--poll-interval` and `--max-backoff`.

Optional automatic webhook notification can be enabled without granting any consensus authority:

```bash
./stratum-validator-bootstrap peer-sync-follow \
  <normal follower options> \
  --alert-webhook https://alerts.example/stratum \
  --alert-bearer-token-file /secure/path/alert-token
```

The bearer token is read from the owner-only file and is not accepted as a command-line secret value. Remote webhook targets require HTTPS; redirects are refused. Delivery remains a notification side effect only and cannot clear safety state or alter proof-verification outcomes.

`peer-follower-status` exposes the local trust-context-bound follower heartbeat/status without changing chain state, validator membership, or consensus authority.

## Candidate follower auto-start packaging

Auto-start package generation is reviewable and candidate-only. Each package generator reads the local validator configuration and refuses to generate artifacts unless the node is `CANDIDATE` with `voteAuthority=false`. Generated runtimes launch `peer-sync-follow` only.

### Linux / Raspberry Pi systemd

```bash
./stratum-validator-bootstrap peer-service-package-systemd <options>
```

This emits reviewable `systemd` unit/install/uninstall artifacts. The generated unit is constrained to the read-only follower and does not expose activation or consensus commands.

### macOS launchd

```bash
./stratum-validator-bootstrap peer-service-package-launchd <options>
```

This emits reviewable LaunchDaemon plist/install/uninstall artifacts. The generated plist runs the candidate follower only.

### Windows Task Scheduler

```powershell
.\stratum-validator-bootstrap.exe peer-service-package-windows-task <options>
```

This emits:

- `install-windows-task.ps1`
- `uninstall-windows-task.ps1`
- `manifest.json`

The generated installer uses an `AtStartup` Task Scheduler trigger and `RunLevel Limited`, requests the configured Windows user's credential at install time, and does not persist the password into generated package files. This is **Windows Task Scheduler auto-start packaging, not a Windows Service Control Manager service**.

None of the three packaging paths can grant vote authority, transition the validator to `ACTIVE`, or enable PROPOSE/VERIFY/COMMIT/ROUND_CHANGE/PLC/PFC voting.

## Peer evidence, quarantine, reliability, retention, and local alerts

Authenticated peer-head observations are persisted and compared across runs. Objective self-inconsistency can produce evidence such as:

- `HEAD_EQUIVOCATION` — the same authenticated peer advertises different finalized DIR hashes at the same height;
- `PROOF_HEAD_MISMATCH` — a peer's proof-verified terminal history contradicts that same peer's authenticated head claim.

Such self-inconsistency may trigger **local read-only quarantine**. By contrast, disagreement between two different authenticated validators is a network safety event and does not automatically punish either peer.

`STRATUM-PEER-OPERATOR-ALERTS/1` records local operator alerts in `peer-operator-alerts.json`. It is trust-context-bound, deduplicates repeated events with deterministic SHA-256 alert IDs, and rejects any state that claims `consensusAuthority=true`. Quarantine alerts are sourced only from existing objective `HEAD_EQUIVOCATION` / `PROOF_HEAD_MISMATCH` evidence; follower safety-halt alerts are sourced from `FINALIZED_HEAD_CONFLICT` / `HISTORICAL_DIVERGENCE` classifications. The alert journal does not change chain history, quorum weight, membership, or vote authority.

`peer-alert-ack` appends operator review metadata to the same journal as a separate acknowledgement record. It requires an existing alert ID and operator identity. The original alert remains unchanged. Acknowledging an alert does **not** release quarantine, clear `SAFETY_HALT`, resume follower advancement, change reliability scoring, or affect PoVI state. Quarantine release remains a separate explicit command.

`STRATUM-PEER-ALERT-DELIVERY/1` provides explicit one-way webhook delivery of an existing local operator alert and optional follower-triggered delivery of already-persisted alerts. Remote delivery requires HTTPS; plaintext HTTP is accepted only for loopback testing. Embedded URL credentials are rejected. Optional bearer authentication is supplied through an owner-only token file rather than a command-line token.

Webhook responses are deliberately non-authoritative: the response body is discarded and never interpreted as an acknowledgement, quarantine release, follower-resume instruction, canonical-history choice, or PoVI/governance action. Redirect following is disabled. Delivery attempts are written to the separate trust-context-bound `peer-operator-alert-deliveries.json` journal with `consensusAuthority=false` and `safetyStateMutation=false`.

Delivery receipts are bounded to **4,096 records**. Every normal receipt append automatically enforces the hard cap; `peer-alert-delivery-prune` also remains available for explicit operator enforcement. Retention removes only the oldest non-authoritative delivery receipts. It does not prune or alter operator alerts, alert acknowledgements, quarantine/evidence, follower safety state, trusted heads, snapshots, DIR/PFC history, validator governance, or proof cache content.

Automatic follower delivery is best-effort and endpoint-scoped. The follower writes its durable lifecycle/safety status before attempting the webhook. A successful receipt suppresses repeat delivery of the same alert to that endpoint, a failed receipt remains retryable, and locally acknowledged alerts are skipped. Automatic work is bounded to 16 pending alerts per cycle.

Operator commands include:

```bash
./stratum-validator-bootstrap peer-quarantine-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-quarantine-release --dir ~/.stratum/validator --peer-validator-id <validator-id>
./stratum-validator-bootstrap peer-reliability-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-follower-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-alert-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-alert-ack --dir ~/.stratum/validator --alert-id <sha256> --operator <operator-id> --note "reviewed"
./stratum-validator-bootstrap peer-alert-deliver-webhook --dir ~/.stratum/validator --alert-id <sha256> --webhook https://alerts.example/stratum --bearer-token-file /secure/path/alert-token
./stratum-validator-bootstrap peer-alert-delivery-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-alert-delivery-prune --dir ~/.stratum/validator
```

Quarantine, reliability, follower status, alerts, alert acknowledgements, and alert-delivery receipts are local synchronization/operational metadata only. They do not alter validator membership, PoVI quorum weight, governance authority, vote authority, canonical history, or activation state. Peer reliability state carries an explicit `consensusWeighting=false` invariant and refuses persisted state that enables consensus weighting.

Local peer-operational evidence retention is bounded to 4,096 unpinned records. Any evidence hash referenced by quarantine state remains pinned, including evidence retained after an operator release. Pinned evidence may exceed the unpinned cap; the retention path will not delete it to satisfy the cap. This mechanism does not prune trust-critical DIR/PFC history.

Email delivery, SMS/paging, and third-party incident-management integrations are not implemented. They remain separate optional notification-layer work and must not become consensus or safety authority.

## Verified proof cache

`STRATUM-PEER-PROOF-CACHE/1` is a local redundant cache for governed proof bundles that have already passed the normal independent verification path. It is not a source of trust.

The cache manifest is trust-context-bound and refuses `consensusAuthority=true` or `canonicalHistorySelection=true`. It therefore cannot choose chain history, change consensus weighting, alter validator membership, grant vote authority, or bypass governance/PFC/DIR verification.

Retention is bounded to **64 bundles / 64 MiB**. The pruning path deletes only manifest-listed `verified-bundle-*.json` files in the proof-cache directory, oldest first. It never prunes the durable trusted head, snapshots, source DIR/PFC trust history, quarantine/evidence state, or unrelated files.

Cache writes happen only after the follower's governed proof verifier succeeds and the durable trusted head advances. Cache write/prune errors are best-effort and cannot roll back or block that verified advancement.

Operator commands:

```bash
./stratum-validator-bootstrap peer-proof-cache-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-proof-cache-prune --dir ~/.stratum/validator
```

## Build and test

```bash
cd tools/portable-validator
go test -race ./...
go vet ./...
go build -trimpath -o stratum-validator-bootstrap .
```

CI cross-compiles Linux ARM64 for Raspberry Pi, Linux AMD64, macOS ARM64, and Windows AMD64. The dedicated peer-sync CI additionally guards the candidate-only follower, request-context cancellation, advisory reliability-ordering boundary, local alert/acknowledgement non-authority, post-verification-only proof caching, proof-cache non-authority/non-canonicality, proof-verification, transport allow-list, and non-consensus reliability invariants. A dedicated operator-alert-delivery CI guards explicit and follower-triggered one-way webhook delivery, request cancellation, endpoint-scoped deduplication/retry, read-only receipt status, hard bounded receipt retention, secret-file bearer authentication, redirect refusal, and the prohibition on safety/trust-state mutation. A dedicated Windows startup-task CI checks formatting, vet, package tests, Windows AMD64 cross-build, credential-at-install behavior, and the non-SCM/non-consensus boundary.

## Candidate initialization

Use a secret file readable only by the current operator:

```bash
chmod 600 /path/to/enrollment-code
./stratum-validator-bootstrap init \
  --friendly-label "Validator D" \
  --chain-id stratum-devnet-1 \
  --network-name "STRATUM Devnet" \
  --genesis-hash <64-char-sha256> \
  --enrollment-code-file /path/to/enrollment-code \
  --bootstrap https://validator-a.example,https://validator-b.example
```

For automated installers, `STRATUM_ENROLLMENT_CODE` may be supplied by the installer process rather than putting the secret in shell history.

The bootstrap and peer-sync runtime use state approximately like:

```text
~/.stratum/validator/
  config.json
  public-enrollment.json
  keys/private/
    consensus.pk8
    vrf.pk8
    transport.pk8
  state/
    consensus-safety.json
    peer-session.json
    peer-sync-head.json
    peer-heads.json
    peer-evidence.json
    peer-quarantine.json
    peer-reliability.json
    peer-follower-status.json
    peer-operator-alerts.json
    peer-operator-alert-deliveries.json
    peer-proof-cache/
      manifest.json
      verified-bundle-*.json
  logs/
  snapshots/
```

Only `public-enrollment.json` is intended for an authorized enrollment service. Files under `keys/private/` must stay local. Peer sync state is trust-context-bound and must not be copied between unrelated chain/Genesis/protocol contexts.

## Health and trust verification

```bash
./stratum-validator-bootstrap doctor
./stratum-validator-bootstrap verify-genesis --file genesis-dir.json
./stratum-validator-bootstrap verify-genesis-trust <options>
./stratum-validator-bootstrap verify-snapshot <options>
./stratum-validator-bootstrap verify-finality <options>
./stratum-validator-bootstrap verify-validator-governance <options>
./stratum-validator-bootstrap verify-round-change <options>
./stratum-validator-bootstrap verify-plc <options>
./stratum-validator-bootstrap verify-proposer <options>
./stratum-validator-bootstrap verify-peer-envelope <options>
./stratum-validator-bootstrap verify-peer-ancestry <options>
```

The doctor verifies candidate-only state, purpose-separated key presence, pinned Genesis identity, and the signed crash/restart safety journal. Individual trust commands verify the corresponding Redbook/STRATUM implementation-profile proof surfaces.

## Read-only peer services

Start a loopback read-only peer service:

```bash
./stratum-validator-bootstrap serve-readonly-peer \
  --peer-registry peer-registry.json \
  --peer-registry-root <64-char-sha256> \
  --height <trusted-height> \
  --listen 127.0.0.1:9443
```

Governance-aware proof serving is exposed separately through `serve-readonly-peer-sync-governed`.

Probe an authenticated peer and verify its signed response:

```bash
./stratum-validator-bootstrap peer-probe \
  --peer-registry peer-registry.json \
  --peer-registry-root <64-char-sha256> \
  --height <trusted-height> \
  --target https://validator-b.example
```

The session state persists outbound sequence and inbound replay watermarks. The runtime refuses to start if the local validator is not `CANDIDATE`, if `voteAuthority` is true, if the live-execution safety blocker has been removed, or if the local TRANSPORT identity does not match the trusted height-specific peer registry.

## Package verification

```bash
./stratum-validator-bootstrap verify-package \
  --manifest manifest.json \
  --publisher-public-key publisher.der \
  --binary validator-binary \
  --sbom sbom.json
```

The command verifies the publisher Ed25519 signature and, when supplied, the actual binary and SBOM hashes.

## Still required before live production PoVI voting

The following remain incomplete and must not be represented as implemented:

- a production-selected VRF primitive/profile and corresponding activation decision;
- governed conversion from `CANDIDATE` to `ACTIVE` at a future height;
- live distributed PROPOSAL → VERIFY → LOCK → COMMIT → PFC execution across validators;
- consensus-bearing peer transport integrated with the persist-before-sign safety journal;
- complete peer discovery/service-discovery strategy across cloud, PC, and Raspberry Pi deployments;
- native production transport hardening as selected for the deployment model, including certificate/key lifecycle where applicable;
- optional native Windows SCM service integration if required operationally; current Windows auto-start packaging uses Task Scheduler instead;
- email/SMS/paging and third-party incident-management notification integrations;
- signed release pipeline, SBOM generation, and production installers/packages;
- wider Byzantine, network-partition, clock-skew, storage-failure, and power-loss qualification;
- resource benchmarking before publishing final minimum hardware claims.

Until those activation gates are completed and distributed UAT passes, the portable validator remains **PARTIAL overall / candidate-only**, even though proof verification, multi-peer resolution, local peer-safety controls, bounded peer-evidence retention, operational reliability state, advisory sync-peer ordering, request-cancelable continuous read-only following, durable follower status, local operator alert journaling, append-only alert acknowledgement, explicit and optional follower-triggered one-way webhook delivery, read-only/hard-bounded delivery-receipt operations, bounded non-authoritative verified-proof caching, and reviewable Linux/Raspberry Pi, macOS, and Windows candidate-follower auto-start packaging are implemented on this feature branch.
