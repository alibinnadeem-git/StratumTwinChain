# Handoff Note — Parametric Enclosure Family (v1)

**From:** Ujjan · **To:** Ali (→ A10 for integration) · **Date:** 2026-10-12
**Package:** parametric generator — enclosure family · **Delivery:** `stratum-48h-delivery-v1.zip`

## What I built

A parametric Python generator (`tools/generators/enclosure_family.py`) that
produces in-house GLB enclosure models, and a **full first pass of the family**:
8 models covering every enclosure row in the taxonomy —

| Row | Model | Variant | W×H×D (m) |
|-----|-------|---------|-----------|
| E-02 | mv_switchgear_2section | switchgear | 1.8 × 2.3 × 1.5 |
| E-03 | lv_switchgear_3section | switchgear | 2.4 × 2.3 × 1.5 |
| E-04 | main_switchboard_2section | switchboard | 1.5 × 2.28 × 0.9 |
| E-05 | distribution_panelboard_600x1800 | panelboard | 0.6 × 1.8 × 0.25 |
| E-06 | branch_panelboard_500x1000 | panelboard | 0.5 × 1.0 × 0.15 |
| E-07 | mcc_2section_5bucket | mcc | 1.0 × 2.286 × 0.5 |
| E-11 | disconnect_switch_60a | disconnect | 0.3 × 0.45 × 0.18 |
| E-12 | enclosed_breaker_100a | enclosed_breaker | 0.3 × 0.5 × 0.2 |

Every model: `.glb` + `.meta.json`, listed in `manifest.json`, **7/7 Intake
Gate pass**. Consolidated gate report at `gate-reports/enclosure_family.json`.

## Acceptance — verified, not claimed

- **7/7 on all 8 models**, including check 6 (Khronos glTF-Validator): the
  validator genuinely **ran** (not skipped) and reported **zero errors, zero
  warnings** on every model. Only informational `NODE_EMPTY` notes for the
  named anchor locators, which are correct.
- `extras.sha256` matches the gate's masked (detached-signature) hash on every
  file, and the manifest sha256 matches the gate-computed digest.
- **One-unzip integration tested:** unzipped the delivery into a clean tree and
  re-ran the gate from there — all 8 still 7/7. Paths mirror the repo exactly
  (`assets/library/models/<TYPE_ID>/…`), so A10 unzips at repo root, no moves.

## How to integrate

Unzip `stratum-48h-delivery-v1.zip` at the repo root. Read
`assets/library/models/manifest.json` and loop. Generator lives at
`tools/generators/enclosure_family.py` for reproducibility (deps: Python 3.8+,
numpy; see `tools/generators/README.md`).

## Judgment calls

- **Anchors per variant.** Wall-mounted (panelboard, disconnect, enclosed
  breaker): `mount_face` (back/wall face), `power_in` (top), `conduit_entry`,
  `ground_lug`. Floor-standing (switchgear, switchboard, MCC): `mount_face`
  (floor plane), `power_in` (top bus), `ground_lug`. Each model's
  `expected_anchors` is in its `.meta.json`.
- **Origin.** Wall face for wall-mounted, floor for floor-standing — per the
  gate's normalization rule. Back face sits at z=0 (against the wall), front
  along +Z.
- **Dimensions are parameters, never guessed.** Defaults follow published
  *envelope* standards (NEMA PB 1 / UL 67, ANSI/IEEE C37.20.1 / .2, UL 891,
  NEMA ICS 18 / UL 845, NEMA 250 / UL 50) — envelope figures, not any single
  SKU's drawing. Override any dimension on the CLI. No OEM geometry was traced,
  converted or re-meshed; these are generic in-house solids (licence tier T1).
- **Detail level.** "Standard": tub + proud door panel(s) + latch/operator
  handles + base plinth (floor units) + bucket/section door seams. Flat-shaded,
  ANSI-61 light-grey PBR. Triangle counts are a few hundred each — far under the
  50k budget, so no mesh compression was needed (meshopt/Draco is "preferred",
  not required by the gate).
- **`ifc_predefined_type`** is carried in `extras` alongside `ifc_class`
  (e.g. E-06 → IfcElectricDistributionBoard / DISTRIBUTIONBOARD) for the
  asset-record schema, though the gate only requires `ifc_class`.

## About check 6 (validator)

The npm `gltf-validator` ships as a library, not a CLI, so the gate skips check
6 by default. I wrote a thin CLI shim (`.validator/bin/gltf-validator`, backed
by that same Khronos library) so the gate runs check 6 for real on my side —
that's how the reports show a genuine pass rather than a skip. The shim is my
local verification tooling and is **not** in the delivery zip; A10's own
validator install will produce the same result. If A10 has no validator, the
gate skips check 6 and still returns overall pass (a missing tool is not a model
defect) — but the models are genuinely valid either way.

## What I did NOT do (next steps)

- Only one representative size per row. The generator is fully parametric, so
  more sizes/configs (e.g. 42-circuit vs 84-circuit panels, NEMA 3R outdoor
  variants, deeper MV sections) are a matter of more CLI calls / manifest rows.
- Next families in priority order remain open: **boxes** (E-27 junction/pull,
  E-26 conduit bodies), **luminaires**, **wiring devices**, **tray + fittings**.
- No mesh compression applied (not needed for the budget). Easy to add via
  glTF-Transform meshopt in a later pass if asset weight matters at scale.

## Verified vs inferred

- **Verified:** all 8 models pass the gate 7/7; validator zero errors/warnings;
  sha256 consistency; one-unzip re-gate from a clean tree.
- **Inferred:** default dimensions are representative published envelopes, not a
  specific project's equipment schedule — intended to be overridden per real
  schedule data when available.

## Hard rules check (brief §5)

No OEM geometry · licence tier T1 throughout · no guessed dimensions (all
parameters with documented sources) · Z-up/metre canonical frame with +Y-up GLB
· touched none of the frozen PRs or paused tracks · worked entirely inside my
own handoff workspace (did not modify the live repo tree).
