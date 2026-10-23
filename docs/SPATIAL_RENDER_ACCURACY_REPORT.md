# Spatial Render Accuracy — Findings & Remaining Work Report

**Date:** 2026-10-22 · **Branch:** `ujjan-v1` · **Fixture:** `5749 Brynhurst - Electrical - Bid Set` (9-page PDF, 28,714 parsed entities)
**Companion:** `docs/SPATIAL_RENDER_ACCURACY_PLAN.md` (per-phase plan). Nothing pushed; all work local on `ujjan-v1`.

## 1. Executive summary

The Spatial render was showing an inflated, un-scaled, Z=0 model with no way to see *why*. We worked the
pipeline end-to-end, **instrument-first**, and the render now shows only genuinely-identified,
de-duplicated equipment, sized from the component library and rested on a reviewable elevation datum —
every inference clearly flagged as a review candidate, never physical truth. The biggest correction was
not a Z bug: it was that **the equipment set was ~94% noise** (duplicates + bare-word labels), and only
a handful of items were ever identified to the library.

### Headline Brynhurst numbers (before → after)

| Signal | Before | After |
|---|---:|---:|
| Equipment "candidates" rendered | 117 (duplicated/labels) | **7 real instances** (55 labels + 55 shadows hidden) |
| Identified to a library component | 4 / 117 (3%) | **7 / 7 instances (100%)**; 88/117 across all candidates |
| Equipment with a Z base | 0 (all `UNRESOLVED`, on Z=0) | **5 of 7** on a relative review datum + library-height extent (2 SLD stay logical) |
| Silent pipeline failures | invisible | **observable** (diagnostics bus); none on the golden run |

## 2. What was built (observability backbone)

- `lib/spatial-diagnostics.ts` — a ring-buffer event bus on `window.__STRATUM_SPATIAL_DIAG`; every stage
  reports structured events; dev-only HUD (`components/SpatialDiagnosticsHud.tsx`).
- `tests/e2e/spatial-diagnostics.spec.ts` — golden regression guard (real Brynhurst import → Spatial,
  asserts no error/fallback events, instances render).
- Node QA contracts: `qa:spatial-parse-audit`, `qa:library-component-resolution`, `qa:candidate-gating`,
  `qa:sheet-scale`, `qa:relative-story-datum` (+ pre-existing `qa:z-resolver`, `qa:z-solution`,
  `qa:spatial-model-resolution`). All green.
- `STRATUM_DIST_DIR` in `next.config.ts` → isolated prod build/capture that never touches a running dev server.

## 3. Phase-by-phase findings

- **Phase 0 — Diagnostics backbone ✅.** Instrumented worker/projection/persist/render/parse. Surfaced silent
  `catch{}`s and silent worker→main-thread fallbacks. Baseline: all stages fire, no silent failures.
- **Phase 1 — Parse + symbol/library audit ✅.** Coordinates healthy (28,615 finite). **Identification is the
  dominant gap:** 4/117 equipment resolved to the library; two unreconciled taxonomies
  (`classifyElectricalLabel` tag-savvy vs `resolveElectricalComponent` alias-only). No metric scale on PDF.
- **Phase 2 — Component identification ✅.** Built a precision-guarded class/tag→library-key bridge
  (`lib/library-component-resolution.ts`, stamped by `lib/library-component-identity.ts`). **4→88/117 (79%→
  later refined).** Caught a real false-positive ("GENERAL NOTES"→generator) and added a prose guard.
- **Phase 2b — Tail + precision ✅.** The remaining unidentified are mostly correct (Elevator, CO = not library
  components). Removed drawing-title false positives (ELEVATION/DIAGRAM/ONE-LINE guard). `Fire Alarm ×2`
  recoverable (deferred).
- **Phase 2c — Candidate gating ✅.** Root-caused the inflation: 55 derived L4 duplicates + bare-word text
  multiplied ("PANEL ×64"). `lib/candidate-gating.ts` roles each candidate INSTANCE / LABEL /
  REGISTRATION_SHADOW. **117 → 7 real instances.**
- **Phase 3 / 3b — Metric scale ✅.** Scale machinery already existed; consolidated a per-sheet candidate
  (`lib/sheet-scale.ts`). **Found the declared title-block scale is ~6.2× wrong** vs 19 independent witnesses
  (multi-scale sheet). Downgraded declared-only to non-sizing. **Brynhurst has no trustworthy auto scale** →
  needs human XY calibration.
- **Phase 4 — Render nominal ✅.** Identity now drives render geometry (`libraryComponentKey`); role gate draws
  only INSTANCEs; nominal-size banner. **117 phantom candidates → 7 real instances drawn** (3 procedural + 4
  GLB library models, async). The "3-of-7 gap" was a synchronous-snapshot artifact — all 7 render (`realGap:0`).
- **Phase 5 — Z base-elevation ✅.** `lib/relative-story-datum.ts` anchors plan equipment to a relative
  story datum (from floor labels) so class profiles + library height apply. Key fix: run it **after**
  `enrichZCandidates` (z-recovery strips heuristic Z for floored entities). **`{UNRESOLVED:7}` →
  `{RELATIVE_VISUALIZATION_ONLY:5, UNRESOLVED:2}`.** The 2 SLD/schematic nodes honestly stay unresolved.
- **Phase 6 — Projection thrash ◑ partial.** Added a self-echo guard (no redundant 28k re-serialize). The
  dominant thrash is **write contention** among reactive panels — an architectural refactor left open.
- **Phase 7 — Persistence ✅.** Audited healthy: durable chunked writes, no shadow/protect warnings, handoff verifies.
- **Phase 8 — Render audit ◑ partial.** Added the "equipment on another sheet" default-frame hint + async-aware
  gap diagnostic. **Remaining:** unify the two Z paths (`height()` vs `displayElevation()`).
- **Phase 9 — E2E validation ✅.** Golden diagnostics e2e + Node QA suite in place. Remaining: more fixtures (DXF/IFC/plan-heavy).

## 4. What's left — session stopped 2026-10-23

Items #1–#6 were all worked this session; each line below marks what was *done* vs what is *still open*.
The genuinely-open work is substantial/separate (an upstream parser fix, an architectural refactor, a
human calibration action, and extra fixtures) — captured here and in the plan's "Pending work" section.

1. **Projection write-contention (from Phase 6).** *Mitigated:* self-echo guard + contention-aware
   backoff; projection now verifiably **settles** (`…→APPLIED`) in ≤2 retries, no starvation (e2e-guarded).
   *Remaining (architectural):* eliminate the residual contending passes by ordering projection after the
   one-time server hydration (or a shared write lease).
2. **Unify the two render Z paths (from Phase 8).** *Done:* one `entityRenderBaseZ` drives mesh, links and
   camera; fixed the camera-select-vs-mesh Z divergence; MODEL-mode render provably unchanged. *Caveat:*
   ELECTRICAL-mode SLD meshes now lift by logical depth (intended) — worth a visual glance.
3. **Metric scale via human XY calibration (from Phase 3b).** *Confirmed built:* `ManualSheetXYCalibrationReview`
   (/compiler) → `applySheetXYTransform` (two control pairs + a validation pair) is the sanctioned, tested,
   **XY-only**, review-gated metric route, mutually exclusive with auto/project/full alignment. Added a scale-audit
   signal (`manualXYCalibratedEntities`/`manualXYCalibrations`) so an established metric XY frame is observable.
   *Remaining:* a human must actually calibrate a sheet (Brynhurst has none); surface the workflow from Spatial
   (currently /compiler only). Note: calibration establishes metric *XY*, not equipment size (that stays library-nominal).
4. **Parse-extraction: recover plan-placed panel tags (from Phase 2c/1).** *Feasibility probed (audit
   `designatorProbe`):* 33 designator tags exist in the graph (`HP1-1`, `HL-2`, `HP3-7`, `D-2`…) as
   circuit/logical-tags, not panel instances. *Chosen approach (panel-schedule cross-reference) probed and
   found NOT viable on Brynhurst:* the equipment-schedule extraction yields **garbage tags** (`"A B"`,
   `"6 CONDUCTOR SIZE, TYPE & DEPTH 12"`, `"9 UTILITY CONTACTS"`), not a clean panel roster (`LP-1`, `HP1`),
   so there is nothing authoritative to cross-reference against. (Audit `scheduleProbe` records this.)
   **Blocked upstream:** recovering plan-placed panels needs a real PDF **panel-/equipment-schedule parser**
   improvement to extract clean panel names first — a substantial separate effort, not a cross-reference layer.
   Building the cross-reference now would match against noise. Deprioritized pending that parser work.
5. **Identification tail (from Phase 2b).** *Done:* `Fire Alarm` now identifies (added `fire alarm` alias),
   which also fixed "Fire Alarm Control Panel" wrongly bridging to panelboard. *Remaining (optional):*
   symbol-fingerprint/legend for the genuinely symbol-only unidentified.
6. **Golden-fixture breadth (from Phase 9).** *Done:* committed a synthetic IFC fixture
   (`tests/fixtures/spatial/sample-electrical.ifc`) + `qa:spatial-fixture-breadth` — proves scale +
   identification + gating generalize to a non-PDF source that *has* metric units (the path Brynhurst lacks).
   *Remaining:* a DXF-through-real-parser and a full-pipeline e2e on a plan-heavy set.

## 5. Truth boundary (held throughout)

Every derived value — identification, size, scale, elevation — is a **review candidate**
(`physicalTruth:false`, `reviewRequired:true`, labeled authority/confidence). Nothing claims metric or
physical truth without source evidence or human calibration. Demotions/roles are reversible; no source data
is deleted.

## 6. How to verify

- Node QA (fast): `npm run qa:spatial-parse-audit` (+ the other `qa:*` above).
- Full pipeline on the real file (prod build): `STRATUM_DIST_DIR=.next-prod-baseline npx next build` →
  `npx next start -p 3100` → `STRATUM_UAT_BASE_URL=http://127.0.0.1:3100 STRATUM_BRYNHURST_E2E=1 npx playwright
  test spatial-diagnostics --project=desktop-chromium`. The Brynhurst PDF is gitignored; the trace writes to
  `test-results/` (also gitignored).
