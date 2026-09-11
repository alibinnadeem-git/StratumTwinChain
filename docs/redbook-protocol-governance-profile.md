# STRATUM Protocol Governance & Activation Profile v1

`STRATUM-PROTOCOL-GOVERNANCE/1` is the first executable Redbook profile for proving when consensus-affecting protocol versions become authoritative.

The profile treats software delivery as transport, not consensus authority. A binary can be installed before activation, but validators derive the active protocol version from a governed proof and its scheduled future activation height.

## Proof contents

Each proof binds:

- previous and next `STRATUM-PROTOCOL-STATE/1` hashes;
- `fromProtocolVersion` and `toProtocolVersion`;
- approval height and strictly later activation height;
- an independently pinned PROTOCOL governance-policy hash;
- a hashed change manifest carrying rationale, security impact, compatibility impact, migration plan, test-evidence root, minimum validator version and resource-profile commitment;
- purpose-specific GOVERNANCE signatures.

## Scope enforcement

The verifier always requires `PROTOCOL_VERSION` authority. It additionally requires:

- `CONSENSUS_RULES` if the consensus-rules commitment changes;
- `CANONICAL_SCHEMA` if the canonical schema version changes;
- `RESOURCE_POLICY` if the resource-policy commitment changes.

This prevents a narrow protocol authority from silently changing unrelated consensus-critical domains.

## Threshold classes

The Redbook allows multiple governance threshold classes. The v1 implementation keeps that class explicit:

- `SIMPLE`: configured threshold;
- `DUAL`: at least two eligible members;
- `MAJORITY`: at least `floor(N/2)+1`;
- `SUPERMAJORITY`: at least `floor(2N/3)+1`;
- `MULTI_PARTY_HIGH_ASSURANCE`: at least two plus any stronger configured threshold.

The deterministic v1 vector uses `SUPERMAJORITY` with three eligible PROTOCOL governance members, so all three signatures are required even though the configured numeric threshold is two.

## Catch-up handoff

Successful verification returns a trusted tuple containing the activation height, next protocol version and next protocol-state hash. A recovering validator can use that tuple when checking subsequent DIR/PFC history. The sender, update server, package host or cloud database does not define the active consensus rules.

## Current boundary

This profile proves scheduled protocol-version authority. Deterministic application-state execution/state-root reconstruction, production VRF proposer selection, higher-round/NIL safety, dynamic production activation and distributed adversarial PoVI qualification remain later P0 gates.
