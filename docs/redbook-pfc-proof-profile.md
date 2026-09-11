# STRATUM PFC Proof Profile v1

`STRATUM-PFC-PROOF/1` is an engineering implementation profile for independently verifying PoVI finality during catch-up.

The Redbook canonical PFC fields remain the architectural baseline. This portable proof envelope additionally preserves `proposalHash` and the individual COMMIT proof records because the current `POVI/1` COMMIT signature domain binds `proposalHash` together with `stateRoot`, `validatorSetRoot`, height, round and protocol version. Without that material, a third-party verifier could not reconstruct and verify the original signed message.

Verification order is deterministic:

1. Continue the independently trusted previous DIR height/hash.
2. Recompute the height-specific validator-set root from ACTIVE validators and their valid CONSENSUS keys.
3. Recompute the proposal hash from the DIR candidate header.
4. Recompute the COMMIT message hash.
5. Verify each COMMIT signature against the validator key valid at that height.
6. Require `floor(2N/3)+1` unique valid ACTIVE-validator signatures.
7. Require the declared signer set to exactly match the valid signer set.
8. Recompute `DIRHash` from the header and finality commitment.

This profile does not by itself make the current compatibility network fully PoVI-conformant. VRF proposer selection, governed validator-set changes, protocol activation, deterministic state execution, higher-round/NIL behavior and production-network activation remain separate gates.
