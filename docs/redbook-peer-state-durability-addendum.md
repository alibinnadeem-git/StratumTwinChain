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
6. atomically rename the temporary file into place;
7. on non-Windows platforms, open and `fsync` the containing directory after the rename so the directory entry itself is forced toward stable storage.

The POSIX parent-directory sync is intentionally a no-op on Windows; Windows replacement handling remains in the individual atomic writers.

This pattern is implemented for:

- proof-verified trusted-head state;
- peer session state, including outbound sequence and replay-protection watermarks;
- authenticated cross-run peer-head observations;
- peer evidence journal;
- local peer quarantine state;
- follower lifecycle/status state;
- operator alerts and acknowledgements;
- webhook delivery receipts plus compact dedup/retry state;
- operational peer-reliability state;
- verified-proof-cache manifest and verified bundle files.

These durability improvements do not increase the authority of the stored data. In particular:

- peer session/replay state remains transport-security state only and cannot grant consensus authority;
- peer reliability still hard-fails if `consensusWeighting=true`;
- follower status still hard-fails if it claims vote authority or consensus participation;
- alert delivery state still carries `consensusAuthority=false` and `safetyStateMutation=false`;
- proof cache still hard-fails if `consensusAuthority=true` or `canonicalHistorySelection=true`;
- quarantine remains local read-only peer-selection policy, not validator governance.

## Fail-closed corruption semantics

A missing state file and an existing invalid state file are intentionally different conditions.

- Where a state type defines safe first-run initialization, a file that does not exist may initialize the documented empty/Genesis-bound default.
- If the file exists but contains malformed or truncated JSON, loading fails with an error. The runtime does not silently replace it with an empty/default state.
- If a persisted record parses but violates its profile or trust context, loading fails with an error.
- A trusted-head record with invalid hash/state metadata is rejected rather than falling back to Genesis.
- Peer session state with an invalid embedded replay trust context is rejected rather than resetting replay watermarks or outbound sequence.
- Follower status that claims vote authority or consensus participation is rejected.
- Reliability state that claims consensus weighting is rejected.
- Proof-cache manifests that claim consensus authority or canonical-history-selection authority are rejected even though the cache itself is non-authoritative.
- Corrupt evidence, quarantine, authenticated-head, follower-status, reliability, and proof-cache manifest files are not auto-deleted by their loaders.

The fail-closed regression suite covers malformed/truncated session state, trusted-head state, evidence journal, quarantine state, authenticated peer-head state, follower status, advisory reliability state, and proof-cache manifests, plus explicit authority-escalation cases.

## Operator inspection and recovery workflow

`peer-state-health --dir <validator-dir>` is the read-only first step whenever local peer state may have been damaged or partially written.

The command classifies each inspected state path as:

- `VALID` — the existing file passes its normal loader and trust-context checks;
- `MISSING_SAFE_DEFAULT` — the file is absent and that state type has a documented safe first-run default;
- `MISSING_OPTIONAL` — the file is absent and is optional observability state rather than a required checkpoint;
- `INVALID` — the file exists but cannot be accepted by its normal loader or violates a non-authority/trust invariant.

If any persisted state is invalid, the report returns `overallStatus=INVALID_PERSISTED_STATE`, exits nonzero, and reports `mutationPerformed=false`.

Operator recovery rules are deliberately conservative:

1. do not delete or overwrite an invalid file merely to make the health check pass;
2. preserve the suspect bytes for forensic/operator review;
3. identify whether the affected state is the authority-bearing proof-verified trusted head or non-authoritative transport/safety/operational metadata;
4. recover only from independently verified evidence or a separately governed/operator-approved recovery procedure appropriate to that state type;
5. rerun `peer-state-health` before restarting automated follower operation.

The health command itself has no repair, delete, rename, trusted-head rewrite, unquarantine, replay reset, safety-halt clearing, governance, activation, or PoVI-authority capability. CI contains negative source assertions preventing those mutation surfaces from entering this command.

The proof-verified trusted head is marked `authoritative=true` in the local health report because it is the candidate's authority-bearing local synchronization checkpoint. Session/replay, evidence, quarantine, authenticated-head observations, follower status, reliability, and proof-cache state remain non-consensus operational/safety metadata; their preservation can still be important for replay defense, evidence continuity, quarantine policy, and incident review.

## Non-mutating diagnostic export profiles

Two compatible diagnostic export profiles are implemented.

### Version 1 — file-integrity package

`peer-state-diagnostic-export --dir <validator-dir> --output <new-external-directory>` preserves the original `STRATUM-PEER-STATE-DIAGNOSTIC-EXPORT/1` format.

Version 1 uses an explicit allowlist rather than recursively walking the validator directory. It may copy only the peer-state files covered by the state-health surface: trusted head, session/replay, evidence, quarantine, authenticated peer-head observations, follower status, reliability, and the proof-cache manifest. It does not export proof-cache payload bundles by default.

Each exported file receives a SHA-256 digest and byte length in `manifest.json`. The manifest also carries the implementation-derived public bootstrap-config fingerprint and, when available and valid, the configured TRANSPORT public-key hash. Those fingerprints are correlation metadata only.

Version 1 intentionally has no canonical top-level bundle digest. Existing preserved version-1 packages remain valid and verifiable.

### Version 2 — canonical bundle digest

`peer-state-diagnostic-export-v2 --dir <validator-dir> --output <new-external-directory>` produces `STRATUM-PEER-STATE-DIAGNOSTIC-EXPORT/2`.

Version 2 preserves the same allowlist/private-key-exclusion/non-mutation boundaries, and adds `bundleDigestSha256`. The digest is domain-separated by `STRATUM/PEER-STATE/DIAGNOSTIC-BUNDLE/2` and is computed over a canonicalized representation of the diagnostic manifest metadata, state-health report, and file inventory. File and health-entry ordering is normalized before digest calculation so ordering-only permutations do not alter the digest.

The canonical digest binds diagnostic metadata such as chain ID, validator ID, timestamp, public-config fingerprint, optional TRANSPORT-key hash, non-authority flags, health classifications, file paths, sizes, and file SHA-256 values. Changing bound manifest metadata without recomputing the canonical digest causes verification to fail.

The version-2 digest is an **integrity/canonicalization primitive only**. By itself it does not prove who created the bundle or possession of any validator private key.

### Common export security boundary

For both versions:

- the destination must be outside the validator data directory;
- the destination must not already exist and is never overwritten;
- `keys/`, `keys/private/`, private PKCS#8 material, and other non-allowlisted files are never traversed or copied;
- each exported state file preserves the source bytes exactly, including malformed/truncated bytes needed for incident review;
- the manifest embeds the read-only state-health report observed at export time;
- the manifest states `consensusAuthority=false`, `consensusParticipation=false`, `voteAuthority=false`, `sourceMutation=false`, and `privateKeysIncluded=false`;
- individual output files are file-synced, output directory entries are synchronized where the host supports it, and the completed package is renamed into its new destination;
- export does not establish canonical history, PoVI finality, physical truth, governance authority, recovery authority, or activation authority.

Regression tests plant private-key sentinel material under `keys/private/` and verify it does not appear in the output, preserve and hash intentionally corrupt state bytes, confirm the source bytes remain unchanged, preserve version-1 compatibility, verify version-2 canonical digest stability, and reject manifest metadata tampering under version 2.

## Independent diagnostic bundle verification

`peer-state-diagnostic-verify --bundle <diagnostic-directory>` independently checks the internal integrity and allowed shape of a diagnostic package without modifying the package or any validator state.

The verifier accepts supported version-1 and version-2 export profiles and fails closed on unknown profiles.

For both versions it:

- rejects any manifest claiming consensus authority, consensus participation, vote authority, source mutation, or private-key inclusion;
- validates the embedded state-health profile and chain context;
- validates the public-config fingerprint and optional TRANSPORT-key hash shapes;
- requires every manifest entry to map exactly to the diagnostic export allowlist;
- rejects duplicate names or duplicate export paths;
- rejects absolute paths, `..` traversal, bundle escapes, and any path containing a `keys` or `private` segment;
- requires regular files and enforces the diagnostic file-size limit;
- recomputes every file's SHA-256 digest and byte length;
- walks the bundle and rejects unexpected/unlisted files or non-regular files;
- performs no delete, rename, repair, trusted-head rewrite, quarantine mutation, governance action, recovery action, or activation action.

For version 2 it additionally requires a valid SHA-256 `bundleDigestSha256`, recomputes the domain-separated canonical bundle digest, and rejects a mismatch. Version 1 must not claim version-2 digest semantics.

A successful unsigned verification returns `integrityVerified=true` and `consensusAuthority=false`. Version 2 additionally returns `bundleDigestVerified=true`. In both cases `authenticityEstablished=false` because integrity does not prove who created the package.

## Detached diagnostic attestation

`STRATUM-PEER-STATE-DIAGNOSTIC-ATTESTATION/1` adds an optional detached provenance signature for an already verified version-2 bundle. Its signing domain is `STRATUM/PEER-STATE/DIAGNOSTIC-ATTESTATION/1`.

Create the detached attestation with:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-attest \
  --dir <validator-dir> \
  --bundle <verified-v2-diagnostic-directory> \
  --output <new-external-attestation.json>
```

The signer:

- requires `CANDIDATE` state with `voteAuthority=false`;
- verifies the version-2 bundle before signing;
- requires the bundle's chain ID, validator ID, public-config fingerprint, and TRANSPORT-key hash to match the local validator config;
- uses the existing `ED25519_TRANSPORT_IDENTITY` private key from local `keys/private/transport.pk8`;
- proves the loaded private key's public half matches the configured TRANSPORT public identity before signing;
- signs a domain-separated digest of the detached attestation payload, which binds the verified version-2 bundle digest and signer context;
- writes the attestation outside both the validator data directory and the diagnostic bundle directory;
- refuses to overwrite an existing attestation path;
- never serializes or copies the TRANSPORT private key into the attestation or bundle;
- does not modify the diagnostic bundle.

The detached attestation explicitly carries `consensusAuthority=false`, `canonicalHistorySelection=false`, `recoveryAuthority=false`, and `voteAuthority=false`.

Verify it with:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-attestation-verify \
  --bundle <verified-v2-diagnostic-directory> \
  --attestation <detached-attestation.json>
```

Without an independently supplied trust anchor, a valid self-contained Ed25519 signature returns `cryptographicSignatureValid=true` but **must remain** `authenticityEstablished=false`. The included public key can verify the signature, but it is still self-asserted provenance.

To establish signer authenticity relative to a separately trusted validator configuration, use:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-attestation-verify \
  --bundle <verified-v2-diagnostic-directory> \
  --attestation <detached-attestation.json> \
  --trusted-config <independently-trusted-config.json>
```

Only when the independently supplied trusted config matches the attested chain ID, validator ID, implementation-derived config fingerprint, TRANSPORT public-key hash, and public key may the result set `trustedConfigUsed=true` and `authenticityEstablished=true`.

Even then, authenticated provenance means only that the detached signature matches the independently trusted TRANSPORT identity for that validator/config context. It does **not** establish PoVI finality, canonical chain history, validator governance authority, recovery authority, vote authority, CANDIDATE→ACTIVE authorization, or physical truth.

The attestation uses the TRANSPORT identity, not a PoVI voting key, and does not alter consensus ability.

## Independent diagnostic bundle comparison

`peer-state-diagnostic-compare --left <diagnostic-directory> --right <diagnostic-directory>` compares two diagnostic packages only after independently verifying both packages through the existing diagnostic verifier.

The comparison is observational and read-only. It reports chain/validator context, provenance-fingerprint correlation, timestamps, health differences, and file-presence/size/SHA-256 differences. Transport-key correlation is comparable only when both bundles carry non-empty valid hashes.

The comparison result explicitly carries `authenticityEstablished=false`, `consensusAuthority=false`, `canonicalHistorySelection=false`, `recoveryAuthority=false`, and `mutationPerformed=false`.

A matching fingerprint is correlation only, not proof of private-key possession. A trusted-head file difference is evidence for operator review only and does not determine which trusted head is correct, choose a fork, authorize replacement of local state, clear a safety halt, release quarantine, alter reliability state, modify validator governance, change PoVI quorum weight, grant vote authority, activate a validator, or establish physical truth.

If either bundle fails independent diagnostic verification, comparison fails rather than comparing unverified bytes.

## Dedicated durability and diagnostic CI

`STRATUM Peer State Durability CI` permanently checks persistence and non-authority boundaries for the candidate runtime, including fail-closed corruption, read-only state-health inspection, diagnostic export allowlisting/private-key exclusion, and diagnostic verifier non-mutation/integrity semantics.

`STRATUM Peer State Diagnostic Compare CI` separately guards the comparison surface with formatting, `go vet`, race-tested regressions, verification-first behavior, explicit non-authority flags, command registration, and negative source assertions preventing trusted-head writes, quarantine mutation, proof application, file deletion/rename, or recovery/state-mutation surfaces from entering comparison.

`STRATUM Peer State Diagnostic Attestation CI` separately guards version-2 canonical digest and detached-attestation semantics. It requires formatting, `go vet`, race-tested version-2 and attestation regressions, version-1 compatibility, verification-before-signing, exact `ED25519_TRANSPORT_IDENTITY` use, private/public key consistency, detached output, trusted-config-gated authenticity, and explicit false consensus/history/recovery/vote authority. It also contains negative source assertions preventing trusted-head mutation, quarantine mutation, governed proof application, activation, or authority escalation from entering the attestation path.

The full `STRATUM Portable Validator CI` remains the cross-platform promotion gate, including protocol vectors, vet/tests, host build, Linux ARM64/Raspberry Pi, Linux AMD64, macOS ARM64, Windows AMD64, and final safety invariants.

Operator Alert Delivery CI separately guards file-plus-parent-directory durability for operator alerts/acknowledgements and the delivery receipt/compact-state journal.

## Durability scope

For the persistence paths listed above, the implementation now claims both file-content durability before replacement and parent-directory durability after atomic rename on POSIX-style platforms. This is a local storage durability guarantee only; it is not a consensus, finality, governance, canonical-history, or physical-truth guarantee.

Filesystem, kernel, virtual-disk, hypervisor, and underlying hardware semantics still bound the practical strength of any `fsync` guarantee. The implementation therefore describes these records as crash-durable within the guarantees exposed by the host operating system and storage stack, not as physically infallible storage.

## Boundary unchanged

Nothing in this addendum permits a CANDIDATE node to PROPOSE, VERIFY-vote, COMMIT-vote, ROUND_CHANGE, create PLC/PFC votes, alter validator governance, select canonical history, authorize recovery, or become ACTIVE. Synchronization, durable local state, diagnostic integrity, and authenticated diagnostic provenance can make a candidate cryptographically informed and operationally resilient; they do not make it a consensus participant or establish physical truth.
