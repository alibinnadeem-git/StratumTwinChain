# STRATUM electrical model ID registry — migration for Ali review (Oct 10, 2026)

## Rules locked
- Immutable **generic** identity: `stlib-{discipline}-{slug}-v{n}`. Registered basename matches the ID exactly, preserving .glb or .gltf format.
- Reserved **licensed OEM** namespace: `oem-{mfr}-{mfr_model_id}-v{n}`, requiring explicit `license_ref` and `license_expiry`. No existing branded /models/oem asset is silently renamed or claimed licensed.
- Mandatory fields: `model_id`, `serves_classes[]`, `tier`, `source` with source kind/url, `license`, `file.path` + *real SHA-256 of bytes*, `dims_w_h_d` (metres), `version`, `supersedes`.
- A model may serve multiple classes but a class **must never map to two model IDs**. `variant_by_class` controls which mesh-group is shown for each class. Missing class-specific candidate stays UNRESOLVED.
- Once published an ID cannot be modified, reassigned, or removed. A changed model mints `-v2` with `supersedes` to the v1 ID, retaining v1 bytes and record.
- Existing filenames remain as compatibility aliases. New canonical filenames reference exactly the same Git blob bytes. There is no geometric reauthoring or status promotion in this PR.
- Existing default model URLs remain stable for clients; `modelId` is derived from the URL and resolved by canonical/legacy URL lookup. OEM-only paths remain NULL, **never given a generic stlib ID**.
- Current library / physical truth remains separate from ID creation. A candidate requires its class-specific seven-check Intake Gate plus locked classification thresholds before a placed model can be treated as resolved.

## Scope and gaps
| Detail | Count |
|---|---:|
| Existing electrical generic binaries registered | **17** |
| A10 priority-1–12 shared generic builds registered | **12** |
| Unique new immutable IDs | **29** |
| Electrical taxonomy classes with a defensible unique candidate binding | **42** |
| Electrical taxonomy classes intentionally UNMAPPED | **20** |
| Mechanical end-suction pump included | **0** |

- Mapped class IDs: E-01, E-02, E-03, E-04, E-05, E-06, E-07, E-08, E-09, E-10, E-11, E-12, E-13, E-15, E-16, E-17, E-18, E-19, E-21, E-22, E-23, E-24, E-27, E-34, E-35, E-36, E-38, E-39, E-40, E-41, E-42, E-44, E-45, E-46, E-47, E-48, E-49, E-50, E-51, E-58, E-59, E-60.
- No class-model source for E-14, E-20, E-25, E-26, E-28, E-29, E-30, E-31, E-32, E-33, E-37, E-43, E-52, E-53, E-54, E-55, E-56, E-57, E-61, E-62; do not fabricate a link to an unrelated GLB. A10 needs to add appropriate Tier-1 generic model candidates and human-review them before all 62 can be completely bound.
- E-10 meter/CT cabinet is `stlib-ele-meter-ct-cabinet-v1`, distinct from `stlib-ele-power-meter-standalone-v1`. The standalone meter never masquerades as the cabinet.
- `stlib-ele-panelboard-surface-v1` serves E-05/E-06/E-42; `stlib-ele-disconnect-enclosure-v1` serves E-11/E-12; `stlib-ele-tray-ladder-v1` serves E-21/E-22/E-23/E-24. Exact in-file variants are recorded.
- `end-suction-pump.glb` belongs to mechanical and is excluded from this **electrical** migration. Its future ID would require an explicitly scoped `stlib-mec-...` registration, not `stlib-ele-`.

**Evidence and safety.** Each `file.sha256` was computed over actual binary bytes retrieved from the repository (not the 40-hex Git blob hash). The CI test independently computes `crypto.createHash('sha256')` from registered and legacy alias paths. Both must match the registry. Default-registry mapping still does not switch to candidates or confer verification. This is a stacked review PR on open #221; no production deploy, data migration, OEM promotions or merges.

**CI routing note:** This draft is stacked on unmerged PR #221. Its test workflow only runs against PRs based on `main`; check evidence is obtained against main before restoring the stacked review base. No merge or production deploy is authorized.
