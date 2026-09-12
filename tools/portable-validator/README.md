# STRATUM Portable Validator

Status: **P0 / candidate-only portable validator with authenticated read-only peer transport and proof-verifying follower sync**. This is **not yet a live PoVI voting runtime** and does not grant consensus authority.

The Redbook portable-validator flow is:

install → verify Genesis → local purpose-separated keys → enrollment → peer discovery → proof-verifying sync → `CANDIDATE` → governed future-height `ACTIVE`.

The repository now implements substantial trust-verification, crash-safety, read-only peer synchronization, multi-peer disagreement handling, and continuous follower portions of that flow while deliberately keeping portable nodes non-voting.

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
- evidence journaling and local read-only peer quarantine;
- operational peer reliability metadata with `consensusWeighting=false`;
- continuous read-only candidate follower sync with bounded polling/backoff;
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
- re-authenticates the selected peer before proof download;
- requires that peer's finalized head to remain unchanged since the survey;
- requests bounded `SYNC_PROOF` batches;
- advances only through the existing governance-aware proof verifier;
- retries transient/unresolved conditions with bounded backoff;
- halts on finalized-history safety conflicts;
- never PROPOSEs, VERIFY-votes, COMMIT-votes, ROUND_CHANGE-votes, creates PLC/PFC votes, or activates the validator.

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

## Peer evidence, quarantine, and reliability

Authenticated peer-head observations are persisted and compared across runs. Objective self-inconsistency can produce evidence such as:

- `HEAD_EQUIVOCATION` — the same authenticated peer advertises different finalized DIR hashes at the same height;
- `PROOF_HEAD_MISMATCH` — a peer's proof-verified terminal history contradicts that same peer's authenticated head claim.

Such self-inconsistency may trigger **local read-only quarantine**. By contrast, disagreement between two different authenticated validators is a network safety event and does not automatically punish either peer.

Operator commands include:

```bash
./stratum-validator-bootstrap peer-quarantine-status --dir ~/.stratum/validator
./stratum-validator-bootstrap peer-quarantine-release --dir ~/.stratum/validator --peer-validator-id <validator-id>
./stratum-validator-bootstrap peer-reliability-status --dir ~/.stratum/validator
```

Quarantine and reliability are local synchronization metadata only. They do not alter validator membership, PoVI quorum weight, governance authority, vote authority, or activation state. Peer reliability state carries an explicit `consensusWeighting=false` invariant and refuses persisted state that enables consensus weighting.

## Build and test

```bash
cd tools/portable-validator
go test -race ./...
go vet ./...
go build -trimpath -o stratum-validator-bootstrap .
```

CI also cross-compiles Linux ARM64 for Raspberry Pi, Linux AMD64, macOS ARM64, and Windows AMD64. The dedicated peer-sync CI additionally guards the candidate-only follower, proof-verification, transport allow-list, and non-consensus reliability boundaries.

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
- service installation and auto-start for supported operating systems;
- signed release pipeline, SBOM generation, and production installers/packages;
- wider Byzantine, network-partition, clock-skew, storage-failure, and power-loss qualification;
- resource benchmarking before publishing final minimum hardware claims.

Until those activation gates are completed and distributed UAT passes, the portable validator remains **PARTIAL overall / candidate-only**, even though proof verification, multi-peer resolution, local peer-safety controls, operational reliability state, and the continuous read-only follower are implemented on this feature branch.
