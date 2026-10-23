# Spatial Render Accuracy Plan

**Status:** active · **Started:** 2026-10-21 · **Branch:** `ujjan-v1`
**Consolidated findings + remaining work:** `docs/SPATIAL_RENDER_ACCURACY_REPORT.md`

Tracked source of truth for making the Spatial 3D render as accurate as the source evidence allows —
especially **Z / elevation** — while making the background processing **observable** so nothing fails
silently. This file is the per-phase plan; the report is the clean cross-phase summary.

## Goal & constraints

- **Goal:** maximize the accuracy of the final Spatial render (geometry, scale, Z) relative to what the
  source documents actually support. Never invent physical truth; "unresolved" stays honestly unresolved.
- **Observability first:** the background processing (graph worker + projection engine) must be monitored
  so any silent failure or silent fallback is visible.
- **Phased:** inspect each pipeline stage in its own phase.

## Working agreement

- One phase at a time. Each phase: **instrument → reproduce → report findings → fix → verify with a
  committed test**. Nothing pushed without request; all work stays on `ujjan-v1`.
- **Plan-gated:** before implementation code for a phase, its section here is refined and **explicitly
  approved**. (Phase 0 predated this doc and is retained by agreement.)

## Phase status

| Phase | Title | Status |
|---|---|---|
| 0 | Diagnostics backbone | ✅ done |
| 1 | Parse + symbol/library audit | ✅ done |
| 2 | Component identification (class/tag → library) | ✅ done |
| 2b | Identification tail + precision | ✅ done |
| 2c | Candidate gating / dedup | ✅ done |
| 3 | Metric scale (measure + consolidate) | ✅ done |
| 3b | Scale discrepancy resolution | ✅ done |
| 4 | Render identified instances (nominal) | ✅ done |
| 5 | Z base-elevation (review candidate) | ✅ done |
| 6 | Projection enrichment (SLD + thrash) | ◑ partial — contention left |
| 7 | Persistence & handoff audit | ✅ done |
| 8 | Render audit (full hardening) | ✅ done (ELECTRICAL lift = visual QA) |
| 9 | End-to-end accuracy validation | ✅ done — more fixtures left |

## Golden fixture

- `tests/fixtures/spatial/5749 Brynhurst - Electrical - Bid Set 2025.04.17.pdf` (gitignored 5.3 MB
  customer drawing; matches `scripts/qa-brynhurst-golden.mjs` policy).
- Verified exact locked source, SHA-256 `9ad7aea4dccfe584dd3837796d4b5ba04588aeea8e2b1a90cc547575d4c323ec`.

## Pipeline map (all client-side, browser-persisted)

| # | Stage | Code | Owns |
|---|-------|------|------|
| A | Parse | `CompilerWorkspace.processFiles` + per-format parsers | Raw `x/y/z/vertices` + `meta` (units, `rawX/Y`, `sourceType`, `unitToMeters`) |
| B | Z-candidate enrichment | `enrichZCandidates` → `z-resolver`, `z-recovery`, `project-datum`, `z-constraint-graph` | Per-entity `zResolutionStatus`, candidate Z, review surfaces |
| C | Assemble / compile | `graph-assembly.worker.ts` ← `graph-assembly-client` | Zones, links, intelligence, the compiled `Graph` |
| D | Persist + handoff | `spatial-browser-recovery` (IndexedDB/chunked + localStorage shadow) + render handoff | Durability, revision identity |
| E | Projection enrichment | `SpatialProjectionEngine` → `enrichSpatialProjection` (off-thread, debounced) | CAD→metric XY scaling, SLD detection, `sldLogicalDepth`, `SLD_FEEDS` |
| F | Render | `CompiledGraphViewer` (three.js) + `asset-placement` / `z-solution-chain` / `render-local-origin` | Final geometry, Z placement, camera, picking |

## Observability backbone

- `lib/spatial-diagnostics.ts` — bounded ring buffer on `window.__STRATUM_SPATIAL_DIAG`;
  `reportSpatialDiag({stage,level,code,counts,durationMs,data})`. Recording always on; console + HUD
  dev-gated (`NODE_ENV!=='production'` or `localStorage['stratum_spatial_diag']='1'`).
- `components/SpatialDiagnosticsHud.tsx` — dev-only overlay (live stream, per-stage health, copy JSON).
- e2e `tests/e2e/spatial-diagnostics.spec.ts` asserts no error-level / silent-fallback events. Needs the
  **prod** server (dev StrictMode breaks seeded hydration); `STRATUM_DIST_DIR` in `next.config.ts` gives
  an isolated prod build that doesn't clobber a running dev server. Full fixture opt-in: `STRATUM_BRYNHURST_E2E=1`.

---

## Phase 0 — Diagnostics backbone · ✅ DONE (2026-10-21)

Instrumented the graph worker client (incl. `WORKER_*_FELL_BACK`), projection engine (silent `catch{}`
removed → `PROJECT_*`), persistence (`WRITE_OK`/`WRITE_IDB_FAILED`/`PROTECT_FAILED`/`READ_SERVED_SHADOW`),
render (`RENDER_START/BUILT`, `RENDER_Z_SUMMARY`, WebGL/model-load/fit failures), and parse
(`PARSE_SUMMARY/FAILED`); dev HUD; e2e. Typecheck + `qa:brynhurst-golden` green.

**Baseline findings (28,714 entities, no silent failures):** Z totally unresolved (`{UNRESOLVED:8}`);
projection thrash (multiple passes, one 6.8 s, `WRITE_CONTENDED`, 3× rebuild); only 152/28,714 visible
under auto single-sheet isolation.

## Phase 1 — Parse + symbol/library linkage audit · ✅ DONE (2026-10-21)

Pure `lib/spatial-parse-audit.ts` (`auditParsedGraph`) → `PARSE_AUDIT` event; `qa:spatial-parse-audit`.

**Findings:** **identification is the dominant gap** — 4/117 equipment resolve to a library class
(≈97% unresolved); when a class resolves, dimensions exist (4/4). Symbol anchoring weak (4 vector / 18
text-abbreviation of 22). **No PDF metric scale** (`metricScaleKnown=false`). Coordinates healthy
(28,615 finite). → Reframed the accuracy chain to **identify → scale → size → Z**; Z deferred.

## Phase 2 — Component identification (class/tag → library) · ✅ DONE (2026-10-21)

Two unreconciled taxonomies: `classifyElectricalLabel` (tag/abbreviation-savvy) vs
`resolveElectricalComponent` (alias-substring only). Built the bridge: `lib/library-component-resolution.ts`
(`resolveLibraryComponentForLabel` + `CLASS_TO_LIBRARY_KEY`, alias-first → coarse-class bridge,
prose-guarded) stamped by `lib/library-component-identity.ts` into `meta.libraryComponent*` (deliberately
not `componentKey` — render consumption is Phase 4). `qa:library-component-resolution`.

**Result:** identification **4/117 → 88/117**. Prose guard caught a real false positive ("GENERAL
NOTES"→generator). No render change (identity isolated from placement by design).

## Phase 2b — Identification tail + precision · ✅ DONE (2026-10-21)

Audit `samples` (unidentified names, bridged name→key, `bridgedByKey` histogram) + a precision fix:
bridge prose guard now also refuses view/sheet titles (ELEVATION/SECTION/DIAGRAM/ONE-LINE/RISER),
**bridge-path only** (guarding the alias path wrongly dropped 4 real "MOTOR · …legend…" matches — caught
and reverted).

**Result:** removed 2 drawing-title false positives → **88/117, all genuine** (panelboard 68,
main-switchboard 10, pv-array 6, + 4 alias motors). The unidentified tail is mostly correct
(`Elevator`, `CO` aren't library components); `Fire Alarm ×2` recoverable (optional). Surfaced the
candidate over-generation handled in 2c.

## Phase 2c — Candidate gating / dedup · ✅ DONE (2026-10-22)

Root-caused the 117 inflation: 55 derived L4 `asset-candidate` duplicates (`withAssetCandidates`) + bare
text multiplied (`PANEL ×64`, `CO ×18`). `lib/candidate-gating.ts` (`gateEquipmentCandidates` →
`meta.candidateRole` INSTANCE | LABEL | REGISTRATION_SHADOW): `derivedFrom`→SHADOW; placed-symbol /
resolved anchor / **numeric designator**→INSTANCE (letter-only tags excluded so "P"≠"PANEL"); else LABEL.
`qa:candidate-gating`.

**Result:** **117 → 7 INSTANCE / 55 LABEL / 55 SHADOW**, 7/7 instances identified. Reversible roles,
nothing deleted. Surfaced: PDF extraction yields bare "PANEL" not panel tags (parse limitation, §Remaining).

## Phase 3 — Metric scale (measure + consolidate) · ✅ DONE (2026-10-22)

Scale machinery already existed (`title-block` `scaleCalibration`, `scale-validation`
`validateIndependentScale`, `pdf-metric-frame`). Consolidated one reviewable per-sheet candidate:
`lib/sheet-scale.ts` `resolveSheetScaleCandidate` (corroborated > declared; MISMATCH → none; declared-only
→ capped REVIEW); audit `scale` section. `qa:sheet-scale`. No coordinates converted.

**Result:** 4/9 sheets carry evidence. **Page 3 MISMATCH: declared 5.121 vs 19 witnesses 0.826 (6.2×).**
Declared repeats on every sheet → declared-only candidates suspect. → Phase 3b.

## Phase 3b — Scale discrepancy resolution · ✅ DONE (2026-10-22)

The 6.2× is a genuine disagreement on the same normalized basis, not a units bug. Declared is a
title-block heuristic; the 19 witnesses are empirical; `96/6.2 ≈ 15.5` ≈ a detail-view scale (multi-scale
sheet), so declared is the less trustworthy side. **Fix:** `resolveSheetScaleCandidate` emits a sizing
candidate **only** from witness corroboration; declared-only stays audit evidence, not a candidate.

**Result:** Brynhurst `sheetsWithCandidate = 0` → **no trustworthy auto-derivable sizing scale**; metric
placement needs human XY calibration (`ManualSheetXYCalibrationReview`).

**Manual XY calibration route confirmed (remaining item #3, 2026-10-22):** `ManualSheetXYCalibrationReview`
(/compiler) → `applySheetXYTransform` is the sanctioned, tested, XY-only, review-gated metric transform
(mutually exclusive with auto/project/full alignment). Added `scale.manualXYCalibratedEntities` /
`manualXYCalibrations` to the audit so an established metric XY frame is observable. It is a built route,
not new work; a human still must calibrate a sheet, and it establishes metric XY (not equipment size).

## Phase 4 — Render identified instances (nominal size) · ✅ DONE (2026-10-22)

(1) Identity drives geometry — `libraryComponentKey` added to `explicitComponentKey`
(`spatial-model-resolution`) and preferred in `asset-placement` (`componentForPlacement`). (2) Role gate
in `CompiledGraphViewer.equipment()` — only `candidateRole==='INSTANCE'` (or ungated legacy) draws;
`LABEL`/`SHADOW` stay in the review list, not drawn. (3) Nominal-size banner. e2e extended to drive
all-frames.

**Result:** **117 candidates → 7 instance meshes** (3 procedural + 4 GLB library models), no phantoms.
The "3-of-7" was a synchronous-snapshot artifact (GLB tags async); confirmed via live
`data-clickable-assets` that **all 7 draw** (`realGap:0`); gap diagnostic now async-aware. Default plan
frame draws 0 (its equipment are all LABELs) — UX addressed in Phase 8.

## Phase 5 — Z base-elevation (library-derived review candidate) · ✅ DONE (2026-10-22)

`lib/relative-story-datum.ts` `applyRelativeStoryDatum` stamps a RELATIVE story datum (from floor labels,
`RELATIVE_STORY_LABEL_DATUM`, low confidence, `physicalTruth:false`) on plan-placed equipment so
`asset-placement` class profiles anchor and library height gives the Z extent. SLD symbols
(`meta.sldCandidate`) and real-evidence entities untouched. `qa:relative-story-datum`.

**Key fix — ordering:** `enrichZRecovery` deletes heuristic Z for *floored* entities (z-recovery.ts:88–95),
so the datum pass must run **after** `enrichZCandidates` (first attempt lifted only the 2 floorless
motors; the 3 `L1` switchboards were stripped).

**Result:** `instanceZ` **`{UNRESOLVED:7}` → `{RELATIVE_VISUALIZATION_ONLY:5, UNRESOLVED:2}`**. The 5 plan
instances sit on a relative datum with library-height extent; 2 SLD/schematic nodes honestly stay
unresolved. Single-floor → datum z=0 (floor plane); absolute Z still needs calibration/evidence.

## Phase 6 — Projection enrichment (SLD + thrash) · ◑ PARTIAL (2026-10-22)

**Done:** (1) self-echo guard — the engine no longer re-serializes the 28k-entity graph to the worker to
confirm its own write (`lastAppliedSignature` → `PROJECT_SKIPPED_SELF_ECHO`; cleared on registry/storage).
(2) **Contention-aware backoff** — on `PROJECT_WRITE_CONTENDED` the retry waits `CONTENTION_BACKOFF_MS`
(700 ms) so it re-reads a settled graph instead of immediately losing again. (3) e2e now **asserts
projection settles** to a terminal outcome (`PROJECT_APPLIED`/`NO_OP`/`SKIPPED`), guarding against
starvation. Investigation found the only `/spatial` primary-graph writers are `SpatialServerHydrator`
(writes once) and projection — `SpatialAutoSync` only pushes to the server; the review panels aren't
mounted here. So contention is a **one-time hydration race**, not a storm.
**Verified:** sequence `START→START→CONTENDED→CONTENDED→START→START→APPLIED` — converges in ≤2 retries,
no starvation, no silent failure.
**Remaining (architectural):** eliminating the residual 2 contending passes needs ordering coordination
(projection waits for hydration, or a shared write lease) — deferred; convergence is already guaranteed.

## Phase 7 — Persistence & handoff audit · ✅ DONE (2026-10-22)

Audited via persist-stage diagnostics across every Brynhurst capture: durable chunked writes
(`WRITE_OK`), no `WRITE_IDB_FAILED`/`READ_SERVED_SHADOW`/`PROTECT_FAILED`, no silent fallbacks; the
Import→Spatial handoff verifies. Healthy; no fix required (Phase 0 instrumentation is the standing guard).

## Phase 8 — Render audit (full hardening) · ✅ DONE (2026-10-22)

**Done:** (1) default-frame hint ("IDENTIFIED EQUIPMENT IS ON ANOTHER SHEET"); (2) async-aware
instance-gap diagnostic (Phase-4 chase); (3) **unified the two render Z paths** — one
`entityRenderBaseZ(e,mode,registry)` is the single source for mesh placement (`height`), links, and
camera-on-select. Fixes the concrete divergence where clicking equipment flew the camera to a different
Z (`displayElevation` e.z/surface) than the mesh (`placement.baseZ`); the SLD logical-depth lift now
applies coherently to meshes/links/camera in ELECTRICAL mode.
**Verified:** MODEL-mode render Z provably unchanged (`instanceZ` + all `RENDER_Z_SUMMARY` identical;
default view safe); e2e green, no silent failures.
**Note:** ELECTRICAL-mode SLD meshes now lift by logical depth (intended coherence, new visual) — worth
a visual glance; can't be QA'd headlessly.

## Phase 9 — End-to-end accuracy validation · ✅ DONE (2026-10-22)

`tests/e2e/spatial-diagnostics.spec.ts` is the golden regression guard (real Brynhurst import → Spatial,
no error/fallback events, gated instances render, async-aware). Node QA suite green:
`qa:spatial-parse-audit`, `qa:library-component-resolution`, `qa:candidate-gating`, `qa:sheet-scale`,
`qa:relative-story-datum` (+ pre-existing `qa:z-resolver`/`qa:z-solution`/`qa:spatial-model-resolution`).
**Breadth added (2026-10-22):** committed synthetic IFC `tests/fixtures/spatial/sample-electrical.ifc`
+ `qa:spatial-fixture-breadth` — a non-PDF source that carries metric units, proving scale +
identification + gating generalize (the metric path Brynhurst can't exercise). **Remaining:** a
DXF-through-real-parser test and a full-pipeline e2e on a plan-heavy set.

---

## Pending work — session stopped 2026-10-23

Phases 0–9 and remaining items #1–#6 were worked; the list below is only what is **genuinely still open**.
Everything else is done/mitigated (see each phase above and report §3–4). All work is local on `ujjan-v1`;
nothing pushed.

**Still open (substantial / separate efforts):**
1. **Panel-tag recovery needs an upstream PDF schedule-parser fix (reframed #4, blocked).** The chosen
   panel-schedule cross-reference is **not viable** until the equipment-/panel-schedule extraction yields
   clean panel names — on Brynhurst it returns garbage fragments (`"A B"`, `"9 UTILITY CONTACTS"`; audit
   `scheduleProbe`). Fix the parser first, *then* cross-reference plan designators to recover plan panels.
2. **Projection contention-elimination (architectural, Phase 6).** Backoff already makes projection
   *settle* (no starvation); removing the residual contending passes needs writer-ordering coordination
   (projection waits for server hydration, or a shared write lease).
3. **Metric sizing requires a human XY calibration (Phase 3b, user action).** The route exists
   (`ManualSheetXYCalibrationReview`); auto scale is non-sizing. Until a sheet is calibrated, sizing is nominal.
4. **Fixture breadth remainder (Phase 9).** A DXF-through-real-parser test and a full-pipeline e2e on a
   plan-heavy set (the synthetic IFC fixture is done).

**Minor / optional:**
5. **ELECTRICAL-mode SLD mesh-lift (Phase 8)** — new coherent visual; needs a human visual glance (can't QA headlessly).
6. **Symbol-fingerprint/legend for the genuinely symbol-only unidentified (Phase 2b)** — small, optional.

## Decisions log

- **2026-10-21** Golden fixture = user-supplied Brynhurst PDF (gitignored).
- **2026-10-21** Phase 0 monitoring is dev-only (HUD + `window.__STRATUM_SPATIAL_DIAG` + console); prod UI untouched.
- **2026-10-21** e2e requires the prod server; added env-gated `STRATUM_DIST_DIR` for isolated prod builds.
- **2026-10-21** Accuracy chain reframed to **identify → scale → size → Z** (Z deferred from the original Phase 2).
- **2026-10-21** Z from component library (user requirement): symbol → class → library `dimensionsMeters`
  drives **Z extent**; class + floor evidence yields a **base-elevation candidate**.
- **2026-10-21/22** Every derived value (identification, size, scale, elevation) is a **review candidate
  only, never physical truth** (`physicalTruth:false`, `reviewRequired:true`); demotions reversible, no source deleted.
- **2026-10-22** Declared-only scale is not a sizing candidate (shown ~6.2× unreliable); witness corroboration required.
- **2026-10-22** Floor-label-only sheets get a relative/nominal review datum (not absolute Z).
