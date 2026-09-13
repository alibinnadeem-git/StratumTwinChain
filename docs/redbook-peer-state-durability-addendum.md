# STRATUM Redbook Peer-State Durability Addendum

Status: **IMPLEMENTED for the read-only CANDIDATE runtime on this feature branch. Live PoVI participation and CANDIDATE→ACTIVE activation remain intentionally unimplemented.**

This addendum supplements `redbook-peer-sync-profile.md` with the durability guarantees that are now enforced by code and CI. It does not alter PoVI finality, validator governance, validator membership, consensus weight, canonical-history selection, or activation rules.

## Alert delivery durability and retry semantics

`STRATUM-PEER-ALERT-DELIVERY/1` separates bounded audit receipts from compact durable delivery state.

- Delivery receipts are bounded to 4,096 records and are non-authoritative audit history.
- Automatic delivery deduplication and retry depth are derived from compact durable delivery state, not from the prunable receipt list.
- Legacy receipt-only journals migrate once by reconstructing compact state from retained receipts when no compact state is present.
- A successful delivery remains suppressed even after its old receipt is pruned.
- Failed automatic delivery retries begin at one minute and double up to a one-hour maximum delay.
- Failed alerts are not silently dead-lettered or permanently dropped.
- At most 16 pending alerts are attempted per follower cycle.
- `peer-alert-delivery-status` exposes endpoint-scoped delivery/retry state without sending or mutating an alert.
- `peer-alert-delivery-state-prune` may delete compact state only for alerts that already have a durable operator acknowledgement. Unacknowledged success and retry state remain pinned so cleanup cannot resurrect delivery or reset retry depth.
- Alert acknowledgement remains separate from quarantine release and from follower safety-state control.

Webhook responses remain one-way notification responses only. They cannot acknowledge an alert, clear `SAFETY_HALT`, release quarantine, advance a trusted head, select canonical history, alter governance, or grant PoVI authority.

## Crash-durable local persistence

The read-only runtime now uses an explicit temp-file durability pattern for safety-adjacent and operational state:

1. create/open the temporary file with owner-only permissions;
2. write the complete new representation;
3. `fsync` the temporary file;
4. close the file;
5. use Windows-safe destination replacement when required;
6. atomically rename the temporary file into place.

This pattern is implemented for:

- proof-verified trusted-head state;
- authenticated cross-run peer-head observations;
- peer evidence journal;
- local peer quarantine state;
- follower lifecycle/status state;
- operator alerts and acknowledgements;
- webhook delivery receipts plus compact dedup/retry state;
- operational peer-reliability state;
- verified-proof-cache manifest and verified bundle files.

These durability improvements do not increase the authority of the stored data. In particular:

- peer reliability still hard-fails if `consensusWeighting=true`;
- follower status still hard-fails if it claims vote authority or consensus participation;
- alert delivery state still carries `consensusAuthority=false` and `safetyStateMutation=false`;
- proof cache still hard-fails if `consensusAuthority=true` or `canonicalHistorySelection=true`;
- quarantine remains local read-only peer-selection policy, not validator governance.

## Dedicated durability CI

`STRATUM Peer State Durability CI` permanently checks the persistence and non-authority boundaries for:

- authenticated peer-head state;
- peer evidence journal;
- follower status;
- peer quarantine;
- advisory peer reliability;
- verified proof cache.

The gate includes Go formatting, `go vet`, targeted race tests, and source-level assertions for the crash-durable write pattern and non-authority invariants. Separate Peer Sync, Operator Alert Delivery, and full Portable Validator CI remain additional gates.

## Remaining durability qualification

File-content `fsync` before atomic rename is implemented. A stricter POSIX power-loss profile may additionally require syncing the parent directory after rename so the directory entry itself is forced to stable storage. That parent-directory durability step is not yet claimed by this addendum and remains a hardening item.

## Boundary unchanged

Nothing in this addendum permits a CANDIDATE node to PROPOSE, VERIFY-vote, COMMIT-vote, ROUND_CHANGE, create PLC/PFC votes, alter validator governance, or become ACTIVE. Synchronization and durable local state can make a candidate cryptographically informed and operationally resilient; they do not make it a consensus participant.
