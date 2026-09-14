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

For new incident packages, prefer the version-2 exporter so top-level manifest metadata is also bound by a canonical digest:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-export-v2 \
  --dir ~/.stratum/validator \
  --output ~/stratum-diagnostics/validator-d-2026-09-13T225500Z
```

The original command remains supported for previously established version-1 workflows:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-export \
  --dir ~/.stratum/validator \
  --output ~/stratum-diagnostics/validator-d-v1
```

The output directory must not already exist.

Both exporters copy only an explicit peer-state allowlist. They do not recursively walk the validator directory and do not traverse or copy `keys/` or `keys/private/`.

Both bundle versions include:

- raw allowlisted state bytes, including malformed/truncated bytes where present;
- SHA-256 digest and byte length for each copied file;
- the state-health report observed during export;
- a deterministic SHA-256 fingerprint of the public bootstrap configuration serialized by the implementation;
- the configured TRANSPORT public-key hash when that metadata exists and is a valid SHA-256 digest;
- a non-authority manifest with `voteAuthority=false`, `consensusParticipation=false`, `consensusAuthority=false`, `sourceMutation=false`, and `privateKeysIncluded=false`.

Version 2 additionally includes `bundleDigestSha256`, computed with the domain `STRATUM/PEER-STATE/DIAGNOSTIC-BUNDLE/2` over a canonicalized representation of manifest metadata, health information, and the file inventory. Ordering-only differences are normalized before digest calculation.

The source validator state is not changed. The config and TRANSPORT-key fingerprints are correlation metadata only. A version-2 bundle digest strengthens integrity but still does not prove who created the package.

## 3. Verify the exported bundle independently

On the same or another machine:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-verify \
  --bundle ~/stratum-diagnostics/validator-d-2026-09-13T225500Z
```

For a valid version-2 bundle, expect:

```text
integrityVerified=true
bundleDigestVerified=true
authenticityEstablished=false
consensusAuthority=false
```

For a valid version-1 bundle, `integrityVerified=true` remains valid but `bundleDigestVerified=false` because version 1 intentionally has no version-2 canonical digest.

The verifier checks:

- supported bundle profile and embedded state-health chain context;
- config fingerprint is a valid SHA-256 digest;
- transport public-key hash is either absent or a valid SHA-256 digest;
- exact allowlist mappings;
- duplicate names/paths;
- path traversal and bundle escapes;
- forbidden `keys` / `private` path segments;
- regular-file and size limits;
- SHA-256 and byte-length integrity for every listed file;
- absence of unexpected/unlisted files;
- non-authority manifest flags;
- for version 2, the domain-separated canonical bundle digest.

Version 1 must not claim version-2 digest semantics. Unknown profiles fail closed.

## 4. Optionally create a detached validator attestation

If provenance from the validator's TRANSPORT identity is useful, create a **detached** attestation for an already verified version-2 bundle:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-attest \
  --dir ~/.stratum/validator \
  --bundle ~/stratum-diagnostics/validator-d-2026-09-13T225500Z \
  --output ~/stratum-diagnostics/validator-d-2026-09-13T225500Z.attestation.json
```

Important constraints:

- attestation requires a verified version-2 bundle;
- the validator must remain `CANDIDATE` with `voteAuthority=false`;
- the bundle's chain ID, validator ID, config fingerprint, and TRANSPORT-key hash must match the local validator config;
- signing uses the local `ED25519_TRANSPORT_IDENTITY` private key only after confirming its public half matches the configured public identity;
- the attestation output must be outside both the validator data directory and the diagnostic bundle directory;
- the bundle is not modified;
- private key material is never copied into the bundle or attestation;
- the detached record carries false consensus, canonical-history, recovery, and vote authority flags.

Do not place the attestation file inside the diagnostic bundle. The bundle verifier intentionally rejects unexpected/unlisted files.

## 5. Verify the detached signature

Verify the bundle and detached signature together:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-attestation-verify \
  --bundle ~/stratum-diagnostics/validator-d-2026-09-13T225500Z \
  --attestation ~/stratum-diagnostics/validator-d-2026-09-13T225500Z.attestation.json
```

A self-contained valid signature can report:

```text
bundleIntegrityVerified=true
bundleDigestVerified=true
cryptographicSignatureValid=true
trustedConfigUsed=false
authenticityEstablished=false
consensusAuthority=false
canonicalHistorySelection=false
recoveryAuthority=false
voteAuthority=false
```

This is deliberate. Without an external trust anchor, the public key carried in the attestation is self-asserted provenance. It can verify its own signature but does not independently prove that this key is the trusted identity for the claimed validator.

## 6. Establish signer authenticity only from an independent trust anchor

When an independently obtained/trusted validator config is available, supply it explicitly:

```bash
./stratum-validator-bootstrap peer-state-diagnostic-attestation-verify \
  --bundle ~/stratum-diagnostics/validator-d-2026-09-13T225500Z \
  --attestation ~/stratum-diagnostics/validator-d-2026-09-13T225500Z.attestation.json \
  --trusted-config ~/trusted/validator-d-config.json
```

`authenticityEstablished=true` is permitted only when the separately supplied trusted config matches the attested chain ID, validator ID, implementation-derived config fingerprint, TRANSPORT public-key hash, and actual public key.

Even then, authenticity means only that the diagnostic attestation was signed by the independently trusted TRANSPORT identity for that validator/config context. It does **not** establish:

- PoVI finality;
- canonical chain history;
- which trusted head is correct;
- validator governance authority;
- recovery authorization;
- vote authority;
- permission to transition `CANDIDATE` to `ACTIVE`;
- physical truth about infrastructure.

The TRANSPORT identity is not promoted into a PoVI voting identity by this workflow.

## 7. Compare verified bundles when useful

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
- version-2 canonical bundle-digest correlation only when **both** bundles independently pass `bundleDigestVerified=true`;
- bundle timestamps;
- embedded state-health classifications;
- file presence;
- file byte lengths;
- file SHA-256 digests.

For canonical bundle-digest comparison, the output uses:

```text
bundleDigestComparable=<true|false>
bundleDigestMatch=<true|false>
leftBundleDigestSha256=<digest when available>
rightBundleDigestSha256=<digest when available>
```

`bundleDigestComparable=true` is possible only for two independently verified version-2 bundles with non-empty verified canonical digests. If either side is version 1, `bundleDigestComparable=false`; this means **not comparable**, not “digest mismatch.” A version-2 digest match means the two canonical diagnostic representations are equal under the version-2 digest profile. A digest mismatch means they differ under that profile. Neither result identifies the canonical chain state or authorizes recovery.

If either transport fingerprint is absent, the result is `transportPublicKeyHashComparable=false`; empty/empty is never treated as a positive key match.

Its output explicitly remains non-authoritative:

```text
authenticityEstablished=false
consensusAuthority=false
canonicalHistorySelection=false
recoveryAuthority=false
mutationPerformed=false
```

Comparison does not consume the detached attestation as fork-choice or recovery authority. Matching fingerprints and matching version-2 canonical bundle digests are correlation/integrity observations only; an independently trusted detached attestation can establish signer provenance, but none of these mechanisms tells the operator which divergent trusted head is canonical.

## 8. Understand the trust ladder

The diagnostic workflow deliberately separates four different claims:

1. **File integrity** — per-file SHA-256 and size match the manifest.
2. **Canonical bundle integrity** — version-2 `bundleDigestSha256` matches the canonicalized manifest/health/file inventory.
3. **Cryptographic signature validity** — the detached Ed25519 signature verifies under the public key carried by the attestation.
4. **Signer authenticity** — that signing key also matches a separately obtained trusted validator config.

None of those four claims, separately or together, equals PoVI finality, canonical-history selection, governance authorization, recovery authorization, vote authority, activation authority, or physical truth.

Do not treat `integrityVerified=true`, `bundleDigestVerified=true`, `cryptographicSignatureValid=true`, `authenticityEstablished=true`, fingerprint correlation, canonical bundle-digest correlation, or any comparison result as automatic authorization to restore state.

## 9. Review and recover deliberately

Recovery depends on the state type.

The proof-verified trusted head is the candidate's authority-bearing local synchronization checkpoint. Any replacement must come from independently verified chain/finality evidence and the separately approved recovery/governance procedure for that checkpoint. Diagnostic provenance can support incident analysis but cannot substitute for proof of canonical chain state.

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
