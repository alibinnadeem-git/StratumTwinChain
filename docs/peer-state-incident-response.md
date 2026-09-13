# STRATUM Peer-State Incident Response

Status: **IMPLEMENTED tooling for read-only CANDIDATE validators.** This workflow does not grant vote authority, activate a validator, choose canonical history, or perform PoVI recovery automatically.

Use this sequence when a validator reports malformed, truncated, trust-context-invalid, or otherwise suspicious local peer state.

## 1. Inspect without mutation

```bash
./stratum-validator-bootstrap peer-state-health --dir ~/.stratum/validator
```

Interpretation:

- `VALID` — the existing file passed its normal loader and trust-context checks.
- `MISSING_SAFE_DEFAULT` — the file is absent and that state type has a documented first-run default.
- `MISSING_OPTIONAL` — optional observability state is absent.
- `INVALID` — an existing persisted file failed parsing, trust-context, or authority-boundary validation.

If any state is invalid, the command returns `overallStatus=INVALID_PERSISTED_STATE`, exits nonzero, and reports `mutationPerformed=false`.

Do **not** delete or overwrite the suspect file merely to make the health check pass.

## 2. Preserve a diagnostic package

Choose a new destination outside the validator data directory:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-export \
  --dir ~/.stratum/validator \
  --output ~/stratum-diagnostics/validator-d-2026-09-13T225500Z
```

The output directory must not already exist.

The exporter copies only its explicit peer-state allowlist. It does not recursively walk the validator directory and does not traverse or copy `keys/` or `keys/private/`.

The bundle includes:

- raw allowlisted state bytes, including malformed/truncated bytes where present;
- SHA-256 digest and byte length for each copied file;
- the state-health report observed during export;
- a deterministic SHA-256 fingerprint of the public bootstrap configuration serialized by the implementation;
- the configured TRANSPORT public-key hash when that metadata exists and is a valid SHA-256 digest;
- a non-authority manifest with `voteAuthority=false`, `consensusParticipation=false`, `consensusAuthority=false`, `sourceMutation=false`, and `privateKeysIncluded=false`.

The source validator state is not changed. The config and transport-key fingerprints are correlation metadata only; export does not sign the bundle and does not prove who created it.

## 3. Verify the exported bundle independently

On the same or another machine:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-verify \
  --bundle ~/stratum-diagnostics/validator-d-2026-09-13T225500Z
```

A successful result reports:

```text
integrityVerified=true
authenticityEstablished=false
consensusAuthority=false
```

The verifier checks:

- bundle profile and embedded state-health chain context;
- config fingerprint is a valid SHA-256 digest;
- transport public-key hash is either absent or a valid SHA-256 digest;
- exact allowlist mappings;
- duplicate names/paths;
- path traversal and bundle escapes;
- forbidden `keys` / `private` path segments;
- regular-file and size limits;
- SHA-256 and byte-length integrity for every listed file;
- absence of unexpected/unlisted files;
- non-authority manifest flags.

Valid fingerprint metadata still does not establish bundle authenticity. It is descriptive/correlation metadata unless a separate future signature-verification profile cryptographically proves possession of an independently trusted key.

## 4. Compare verified bundles when useful

If two preserved packages need to be reviewed side-by-side, compare them only through the verification-first comparison command:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-compare \
  --left ~/stratum-diagnostics/validator-d-before \
  --right ~/stratum-diagnostics/validator-d-after
```

The command independently verifies both bundles before comparing them. It reports only diagnostic differences/correlation such as:

- chain-ID and validator-ID match/mismatch;
- config-fingerprint match/mismatch;
- transport public-key hash correlation only when **both** bundles contain a non-empty valid hash;
- bundle timestamps;
- embedded state-health classifications;
- file presence;
- file byte lengths;
- file SHA-256 digests.

If either transport fingerprint is absent, the result is `transportPublicKeyHashComparable=false`; empty/empty is never treated as a positive key match.

Its output explicitly remains non-authoritative:

```text
authenticityEstablished=false
consensusAuthority=false
canonicalHistorySelection=false
recoveryAuthority=false
mutationPerformed=false
```

A matching config fingerprint means only that the two verified manifests report the same implementation-derived public bootstrap-config fingerprint. A matching transport public-key hash means only that the two verified manifests report the same non-empty hash value. Neither match proves that the same machine created both bundles, that the claimed validator created either bundle, or that any party possesses the corresponding private key.

A trusted-head file difference is evidence for review only. It does not tell the operator which trusted head is correct and must never be used as automatic fork choice or automatic recovery authorization.

## 5. Understand what verification and comparison do not prove

Diagnostic verification is an **integrity check**, and diagnostic comparison is an **observational difference/correlation report**. Neither is an authenticated provenance or consensus proof.

A valid unsigned diagnostic bundle, matching config/transport fingerprints, or a comparison between two valid bundles does not establish:

- who created either package;
- that a particular validator actually produced either package;
- possession/control of the TRANSPORT private key;
- PoVI finality;
- canonical chain history;
- which differing trusted head is correct;
- validator governance authority;
- permission to recover/replace a trusted head;
- permission to clear a safety halt or release quarantine;
- physical truth about infrastructure.

Do not treat `integrityVerified=true`, fingerprint correlation, or any comparison result as authorization to restore state automatically.

## 6. Review and recover deliberately

Recovery depends on the state type.

The proof-verified trusted head is the candidate's authority-bearing local synchronization checkpoint. Any replacement must come from independently verified evidence and the separately approved recovery/governance procedure for that checkpoint.

Session/replay, evidence, quarantine, authenticated peer-head observations, follower status, reliability, and proof-cache metadata are non-consensus state, but may still be important for replay defense, evidence continuity, quarantine policy, and incident review. Do not silently discard them.

After an approved recovery action, rerun:

```bash
./stratum-validator-bootstrap peer-state-health --dir ~/.stratum/validator
```

Only restart automated follower operation after the intended state is healthy and the recovery record has been retained for operator review.

## Safety boundary

None of the commands in this guide can:

- PROPOSE;
- create VERIFY votes;
- create COMMIT votes;
- ROUND_CHANGE;
- create PLC/PFC votes;
- grant vote authority;
- modify validator governance;
- select canonical history;
- authorize recovery;
- transition `CANDIDATE` to `ACTIVE`.

The incident-response workflow is intentionally separate from future activation and live PoVI participation.
