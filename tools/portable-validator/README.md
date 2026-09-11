# STRATUM Portable Validator Bootstrap

Status: **P0 foundation / candidate-only bootstrap**. This is not yet a PoVI-conformant voting runtime.

The Redbook portable-validator flow is: install → verify Genesis → local key generation → enrollment → peer discovery → proof-verifying sync → `CANDIDATE` → governed future-height `ACTIVE`.

This bootstrap implements the first safe executable slice of that flow:

- local validator identity creation without overwriting an existing identity;
- local purpose-separated key material for `CONSENSUS`, `VRF`, and `TRANSPORT`;
- private key files stored only under `keys/private` with restrictive filesystem permissions;
- raw enrollment codes accepted only through `STRATUM_ENROLLMENT_CODE` or a permission-restricted file, never as a command-line secret value;
- enrollment code persisted only as a SHA-256 digest;
- public enrollment bundle containing public keys and package-build attestation only;
- pinned `chainId` and `GenesisDIRHash` verification;
- persistent crash-safety state scaffold;
- candidate health checks;
- signed universal package-manifest verification;
- cross-compilation gates for Linux ARM64, Linux AMD64, macOS ARM64, and Windows AMD64.

## Safety boundary

A successful install **never grants vote authority**. `voteAuthority` is created as `false`, state is created as `CANDIDATE`, and this CLI intentionally exposes no `activate`, `vote`, or `force-active` command. Validator admission and activation remain governed future-height actions.

This release also intentionally blocks activation for two protocol gaps:

1. `VRF_CONFORMANCE_NOT_YET_IMPLEMENTED` — the generated VRF-purpose key is candidate key material only; the Redbook's production VRF proposer algorithm has not yet been implemented in this bootstrap.
2. `FULL_GENESIS_PROOF_VERIFIER_NOT_YET_IMPLEMENTED` — `verify-genesis` checks the locally pinned Genesis DIR identity (`chainId` + `GenesisDIRHash`), but does not yet perform complete canonical Genesis signatures/certificate/history verification.

These blocks prevent the bootstrap from overstating protocol conformance.

## Build

```bash
cd tools/portable-validator
go test ./...
go build -trimpath -o stratum-validator-bootstrap .
```

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

The bootstrap writes:

```text
~/.stratum/validator/
  config.json
  public-enrollment.json
  keys/private/
    consensus.pk8
    vrf.pk8
    transport.pk8
  state/consensus-safety.json
  logs/
  snapshots/
```

Only `public-enrollment.json` is intended for an authorized enrollment service. The contents of `keys/private/` must stay local.

## Health check

```bash
./stratum-validator-bootstrap doctor
```

The doctor fails if vote authority is enabled, the state is not `CANDIDATE`, a required key is missing, private-key permissions are too broad on Unix systems, the Genesis hash is malformed, or the governance activation block is missing.

## Verify pinned Genesis identity

```bash
./stratum-validator-bootstrap verify-genesis --file genesis-dir.json
```

This rejects a mismatched `chainId` or `GenesisDIRHash`. Full certified Genesis proof verification remains a subsequent P0 implementation step.

## Verify a package

The Redbook package manifest contains `packageId`, `validatorVersion`, `protocolVersion`, `platform`, `architecture`, `binaryHash`, `SBOMHash`, `publisherSignature`, `minimumResources`, `supportedFeatures`, and `releaseChannel`.

```bash
./stratum-validator-bootstrap verify-package \
  --manifest manifest.json \
  --publisher-public-key publisher.der \
  --binary validator-binary \
  --sbom sbom.json
```

The command verifies the publisher's Ed25519 signature and, when supplied, the actual binary and SBOM hashes.

## Still required before production PoVI voting

- canonical Genesis signature/PFC/trust-root verification;
- proof-verifying snapshot/DIR catch-up;
- actual VRF implementation and proposer proof verification;
- dynamic registry activation governed at a future height;
- persistent PoVI runtime integration with crash-safe locks/last-signed state;
- peer discovery/NAT/VPN/manual bootstrap runtime;
- service installation/auto-start for each operating system;
- signed release pipeline, SBOM generation, installers (MSI/PKG/DEB/RPM/Raspberry Pi image/package);
- adversarial/Byzantine and power-loss testing;
- resource benchmarking before publishing minimum hardware claims.
