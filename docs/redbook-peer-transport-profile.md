# STRATUM Authenticated Peer Transport Implementation Profile

Status: **PARTIAL — read-only authenticated transport and proof-sync foundation**

This implementation profile defines how portable STRATUM validators authenticate peer messages before live PoVI networking is enabled. It is an engineering profile for the current implementation; it does not claim that the STRATUM Redbook normatively selects a particular socket, TLS, mTLS, QUIC, WebSocket, or overlay-network technology.

## Safety objective

The first networking boundary is intentionally non-voting. A candidate validator may verify peer identity and read-only health/trust information without obtaining PoVI vote authority and without emitting PROPOSE, VERIFY, COMMIT, ROUND_CHANGE, PLC, PFC, or other consensus-bearing signatures.

Allowed read-only message types are:

- `PING`
- `STATUS`
- `TRUST_ROOTS`
- `SYNC_HEAD`
- `SYNC_PROOF`

`SYNC_HEAD` and `SYNC_PROOF` are read-only proof-discovery/catch-up traffic. They do not create PoVI votes, do not change validator activation state, and do not grant consensus authority. Consensus-bearing message types fail closed at the candidate transport boundary.

## Trust binding

Every signed envelope is bound to:

- STRATUM Chain `chainId`
- network name
- pinned `GenesisDIRHash`
- PoVI `protocolVersion`
- sender validator ID
- purpose-separated TRANSPORT key ID
- monotonic per-sender sequence
- unique nonce
- issue and expiration timestamps
- message type
- canonical payload hash

The sender signs the canonical envelope message hash with its purpose-separated `ED25519_TRANSPORT_IDENTITY` key. The verifier resolves that key from a height-specific `STRATUM-PEER-REGISTRY/1` allowlist and checks the independently trusted registry root.

The transport registry is separate from consensus vote authority. Being present in the transport registry means a peer may authenticate for allowed read-only exchange; it does not mean the peer may participate in PoVI voting.

## Replay and freshness protection

The verifier checks both time validity and replay state. A durable replay-state file may persist the highest accepted sequence per sender and seen nonces. A repeated nonce, repeated/rollback sequence, stale envelope, or envelope issued beyond the permitted clock-skew window is rejected.

This is deliberately designed so a validator restart does not reset a peer's monotonic replay watermark when durable replay state is supplied.

## Proof-sync separation

Transport authentication proves which trusted peer sent a message; it does not make the peer's claimed chain state authoritative.

`SYNC_HEAD` is discovery-only. A received head claim cannot advance the local trusted head by itself.

`SYNC_PROOF` may carry snapshot, PFC/DIR finality, and governed validator-set transition evidence. That evidence is independently verified by the proof-sync runtime against locally pinned trust context before any durable trusted-head advancement.

## Failure conditions

Verification fails closed for wrong chain, wrong Genesis DIR, wrong protocol version, unknown validator, wrong or retired TRANSPORT key, untrusted registry root, payload/message tampering, invalid signature, unsupported/consensus-bearing message type, future/stale timestamps, repeated nonce, or sequence rollback.

## Activation boundary

This profile does **not** remove `LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED`, does not set `voteAuthority: true`, and does not add `activate`, `vote`, or `force-active` commands.

Consensus-bearing outbound messages remain gated behind separately governed validator activation and the durable persist-before-sign PoVI consensus-safety journal.

## Current status

- Portable Go peer registry and envelope verifier: **IMPLEMENTED on feature branch**
- Durable replay watermark/nonces: **IMPLEMENTED on feature branch**
- Authenticated read-only peer listener/session: **IMPLEMENTED on feature branch**
- `PING` / `STATUS` / `TRUST_ROOTS`: **IMPLEMENTED on feature branch**
- `SYNC_HEAD` / `SYNC_PROOF` read-only transport: **IMPLEMENTED on feature branch**
- Shared Redbook TypeScript transport schemas: **IMPLEMENTED on feature branch**
- Proof-verifying peer catch-up: **PARTIAL — implemented for snapshot/PFC/DIR/governance verification; multi-peer ancestry/disagreement handling is being completed**
- Consensus message exchange: **PLANNED**
- Vote authority / production activation: **PLANNED and separately governed**
