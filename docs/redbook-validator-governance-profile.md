# STRATUM Validator Governance Proof Profile v1

`STRATUM-VALIDATOR-GOVERNANCE/1` is the first executable Redbook profile for proving validator membership and CONSENSUS-key history during proof-verifying catch-up.

It deliberately separates three trust domains:

- PoVI validator votes finalize DIRs.
- VALIDATOR governance authority approves validator membership/key changes.
- A verifier begins from independently trusted governance-policy and validator-set roots; a downloaded proof cannot nominate its own authority.

## Governed actions

The v1 action registry supports `ACTIVATE`, `QUARANTINE`, `REINSTATE`, `RETIRE`, `REVOKE`, and `ROTATE_CONSENSUS_KEY`.

Every action carries `approvedAtHeight` and a strictly later `effectiveHeight`. This prevents an operator from presenting a same-height membership/key mutation as if it had already been governed before consensus used it.

## Authority rule

The active VALIDATOR governance policy is evaluated at `approvedAtHeight`. Signatures must come from purpose-specific ACTIVE GOVERNANCE keys valid at that height. The required signature count is:

`max(policy.threshold, floor(2N/3)+1)`

where `N` is the eligible governance authority count. A configured threshold therefore cannot weaken the Redbook supermajority floor.

## State commitments

Each proof binds both full validator-set state hashes and height-specific ACTIVE validator-set roots:

- `previousValidatorSetHash` / `nextValidatorSetHash` preserve membership and key-history state.
- `previousValidatorSetRoot` is recomputed at `effectiveHeight - 1` and must match an independently trusted prior root.
- `nextValidatorSetRoot` is recomputed at `effectiveHeight` and becomes the trusted root for subsequent DIR/PFC verification after the governance proof succeeds.

Only the governed target may change in a single v1 action. Unrelated validator mutations invalidate the proof.

## Consensus-key rotation

For `ROTATE_CONSENSUS_KEY`, the validator's permanent identity and membership lifecycle remain unchanged. The previously active CONSENSUS key must retire exactly at `effectiveHeight`, and exactly one replacement CONSENSUS key must activate at that same height.

The deterministic v1 test vector rotates Validator B at height 12, chaining from the height-11 validator-set root already proven by the PFC/DIR finality vector. Three separate GOVERNANCE keys approve the action; consensus keys are not reused as governance keys.

## Current boundary

This profile proves authorized validator-set/key history. It does not yet prove protocol-version activation, deterministic application-state transitions, production VRF proposer selection, higher-round/NIL behavior, or production PoVI activation. Those remain subsequent P0 gates.
