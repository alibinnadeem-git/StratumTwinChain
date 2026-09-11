# STRATUM Portable Validator

Status: **P0 / candidate-only portable validator with read-only authenticated peer sessions**. This is **not yet a live PoVI voting runtime** and does not grant consensus authority.

The Redbook portable-validator flow is:

install → verify Genesis → local purpose-separated keys → enrollment → peer discovery → proof-verifying sync → `CANDIDATE` → governed future-height `ACTIVE`.

The repository now implements substantial trust-verification and crash-safety portions of that flow while deliberately keeping portable nodes non-voting.

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

The current peer transport is intentionally restricted to these application messages:

- `PING`
- `STATUS`
- `TRUST_ROOTS`

Every peer envelope is bound to the STRATUM Chain identity, network name, Genesis DIR hash, protocol version, sender validator identity, sender TRANSPORT key, monotonic sequence, nonce, issuance/expiry times, message type, canonical payload hash, message hash, and Ed25519 TRANSPORT signature.

The peer-key registry is height-aware. Incoming envelopes are rejected for wrong chain/Genesis/protocol context, untrusted or inactive peer keys, signature/hash mismatch, stale or future timestamps, reused nonce, or sequence rollback.

`PROPOSAL`, `VERIFY`, `COMMIT`, `ROUND_CHANGE`, PLC/PFC traffic, and all other consensus-bearing messages remain disabled in this runtime slice.

### Transport security boundary

The signed application envelope provides peer authentication and message integrity. It does **not** by itself provide network confidentiality.

`serve-readonly-peer` defaults to loopback-only plaintext (`127.0.0.1:9443`). A non-loopback plaintext listener is refused unless the operator explicitly acknowledges a trusted reverse-proxy/TLS boundary with `--allow-plaintext-lan`. `peer-probe` refuses non-loopback `http://` targets; remote peers are expected to use HTTPS or a future native secure transport profile.

This is an implementation profile. It does not claim that the Redbook normatively mandates HTTP, TLS termination, mTLS, QUIC, WebSockets, or another specific wire transport.

## Build and test

```bash
cd tools/portable-validator
go test -race ./...
go vet ./...
go build -trimpath -o stratum-validator-bootstrap .
```

CI also cross-compiles Linux ARM64 for Raspberry Pi, Linux AMD64, macOS ARM64, and Windows AMD64.

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

The bootstrap writes approximately:

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
  logs/
  snapshots/
```

Only `public-enrollment.json` is intended for an authorized enrollment service. Files under `keys/private/` must stay local.

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
```

The doctor verifies candidate-only state, purpose-separated key presence, pinned Genesis identity, and the signed crash/restart safety journal. Individual trust commands verify the corresponding Redbook/STRATUM implementation-profile proof surfaces.

## Read-only peer session

Start a loopback read-only peer service:

```bash
./stratum-validator-bootstrap serve-readonly-peer \
  --peer-registry peer-registry.json \
  --peer-registry-root <64-char-sha256> \
  --height <trusted-height> \
  --listen 127.0.0.1:9443
```

Probe an authenticated peer and verify its signed `STATUS` response:

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

Until those activation gates are completed and distributed UAT passes, the portable validator remains **PARTIAL / candidate-only**, even though its proof-verification and read-only peer-session surfaces are operational.
