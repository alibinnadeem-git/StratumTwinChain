# Enclosure Family — Delivery & Test Report (v1)

**Package:** parametric generator — enclosure family · **From:** Ujjan
**Date:** 2026-10-12 · **Delivery:** `stratum-48h-delivery-v1.zip` (one unzip at repo root)

## What was delivered

A parametric Python generator (`tools/generators/enclosure_family.py`) plus a
full first pass of the family — **8 models across all enclosure rows**, each
with a `.glb`, a `.meta.json`, a `manifest.json` entry, and a consolidated gate
report:

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

## ✅ Tested by me (automated / objective — all passing)

| Check | Result |
|-------|--------|
| STRATUM Intake Gate (all 7 checks) | **7/7 pass on all 8 models** |
| Check 6 — Khronos glTF-Validator | Ran for real (not skipped): **zero errors, zero warnings** on every model |
| Check 3 — normalization | `+Y` up, metres, bbox diagonals in range; exact POSITION min/max (no `ACCESSOR_*_MISMATCH`) |
| Check 4 — anchors | Every `expected_anchor` node present per model |
| Check 5 — triangle budget | A few hundred tris each — far under the 50k equipment budget |
| Check 7 — registration + sha256 | All `extras` fields present; embedded masked sha256 matches the file |
| `meta.json` correctness | type_id, licence_tier T1, anchors, declared up/origin/front, params |
| `manifest.json` | 8 models, sha256 matches gate digest, gate = "7/7 pass" |
| One-unzip integration | Unzipped into a clean tree and re-ran the gate from there → still 7/7 |
| Repo-mirrored paths | `assets/library/models/<TYPE_ID>/…` — lands in place, no moves |

These are the objective, byte-level and spec-conformance checks. They prove the
files are **valid, registered, and gate-passing**. They do **not** prove the
geometry *looks right* — that's the part below.

## 👁️ Needs testing by you (visual / engineering judgment)

This is exactly the "3D judgment" the brief flagged as the reason a human owns
this lane. Open each `.glb` in a viewer and sanity-check:

1. **Proportions & realism** — does each enclosure read correctly (a panelboard
   looks like a panelboard, switchgear like a line-up, MCC buckets look like
   buckets)? Door panels, handles, base plinths, section/bucket seams.
2. **Orientation & origin** — `+Y` up, **front faces `+Z`**, and the origin sits
   where declared (wall face for wall-mounted, floor for floor-standing) so the
   unit mounts flush when placed in a twin. (The gate can't prove orientation
   from bytes — it says so — so this needs a human.)
3. **Anchor placement** — `mount_face`, `power_in`, `conduit_entry`,
   `ground_lug` locators land in sensible spots for conduit/feeder attachment.
4. **Default dimensions vs. real schedules** — my defaults are published
   *envelope* figures (NEMA/ANSI/UL), not a specific project's equipment
   schedule. Confirm they're close enough, or override per the real schedule
   (every dimension is a CLI parameter).
5. **Detail level / finish acceptable** for this milestone (flat-shaded,
   ANSI-61 light-grey).

### How to view them

- Quickest: drag a `.glb` into a glTF viewer (e.g. the VS Code **glTF Tools**
  extension, or https://gltf-viewer.donmccurdy.com — note that's an external
  upload).
- In-app: once A10 integrates the delivery into the repo's asset library, view
  via the `/component-library` route on the local app (the DB I set up earlier
  lets you run that locally and log in).

## Judgment calls I made (flag if any are wrong)

- Anchors per variant (listed in each `.meta.json`); wall-mounted get
  `conduit_entry`, floor-standing don't.
- Back face at `z=0` against the wall, front along `+Z`.
- One representative size per row (generator is fully parametric for more).
- No mesh compression (not needed under the budget).

## Not done yet (next steps)

- More sizes/configs per row (e.g. 42- vs 84-circuit panels, NEMA 3R outdoor,
  deeper MV sections) — just more CLI calls / manifest rows.
- Next families in priority order: boxes (E-26/E-27), luminaires, wiring
  devices, tray + fittings.
