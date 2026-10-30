# Spatial Metric Placement Plan

**Status:** approved 2026-10-27 (Phase 12 option A) · **Drafted:** 2026-10-27 · **Branch:** `ujjan-v2`
**Follows:** `docs/SPATIAL_RENDER_ACCURACY_PLAN.md` (phases 0–9) and `docs/SPATIAL_RENDER_ACCURACY_REPORT.md`
**How to test by hand:** `docs/SPATIAL_METRIC_PLACEMENT_TESTING_GUIDE.md`

The MS1/MS2 distance check on 2026-10-26 showed that the Spatial render does not put equipment at real
distances, and that one conclusion in the accuracy report was wrong. This plan fixes that, plus three
smaller bugs found in the same check. Phases continue the numbering of the accuracy plan.

## What the check found

Measured on the golden fixture (Brynhurst, SHA-256 `9ad7aea4…c323ec`) through the real import on a
production build.

| Finding | Evidence |
|---|---|
| The default view shows the one-line diagram (E-2), so MS1 and MS2 sit at schematic positions, 12.6 m apart. | `CompiledGraphViewer.tsx:193-201`: MODEL mode picks the first non-raster frame, which is p2 (SLD). |
| On the E-4 floor plan they render 0.71 m apart. Real distance is about 3.6 m between labels (about 1.6 m clear between their fronts). | PDF sheet units (long edge = 20) are drawn as metres. At 1/8" = 1'-0", 1 unit is 5.121 m. |
| The printed scale is correct. The report's "declared scale is 6.2× off" was wrong. | The 6'×8' transformer pad measures 6.0 × 8.0 ft on E-3 and E-4 at 5.121 m/unit. |
| "MS1 #1", a circuit callout on E-4, renders as a third switchboard. | `lib/candidate-gating.ts:30-34`: any digit in the name makes an INSTANCE. |
| MS1 floats 1.83 m (6 ft) above the floor on E-4. | Likely `lib/support-base-evidence.ts` reading "6'x8' T-Pad" as a 6-ft pad. Reproduced in isolation; not yet confirmed on the real run. |

## Root cause of the wrong scale check (found while planning)

`validateIndependentScale` receives page coordinates in **0–1 page space**: the PDF worker passes
`x/20+.5` with `coordinateSpan:1` (`workers/pdf-native-parser.worker-v2.ts:280-285`; also
`workers/pdf-native-parser.worker.ts:270` and `components/CompilerWorkspace.tsx:257,483`). But
`dimensionWitnesses` (`lib/scale-validation.ts:55-70`) applies thresholds meant for **20-unit space**:
segment length ≥ .15, text-to-line distance ≤ .45, tie margin .04. In 0–1 space that means:

- only lines longer than 15% of the page are considered (a 50-ft line at 1/8"), so real dimension lines are skipped;
- a dimension label can pair with any long line within 45% of the page, usually a wall or border.

Pairing a label with a longer line makes the scale come out too small, which is what Brynhurst showed (0.826
instead of 5.121). The Node QA never caught this because `scripts/qa-scale-validation.mjs` only tests
`coordinateSpan:20`.

Reproduced with the QA's own first case:

| Same witness, different coordinate space | Result |
|---|---|
| 20-unit space (what QA tests) | CORROBORATED, 10.973 m/unit |
| 0–1 space (what the worker passes) | UNRESOLVED, witness dropped |
| 0–1 space with a long wall line nearby | MISMATCH, 1.016 vs 10.973 (paired with the wall) |

**E-4 has no dimension strings of its own.** Its text has only `SCALE: 1/8" = 1'-0"` and `6' x 8'`; E-3 has
44 (`4'-0"`, `20'-0"`, `86'-0"` and so on). So fixing the witnesses can confirm the scale on E-3 but
not on E-4. Phase 12 needs a decision on this (see below).

## Truth boundary (unchanged)

Nothing becomes metric without evidence and a human confirming it. `applyAutomaticPdfMetricFrame` throws on
purpose, and this plan keeps it that way. A confirmed metric frame changes X/Y only, never Z, can be
undone, and stays `physicalTruth:false`.

## Phase status

| Phase | Title | Depends on | Status |
|---|---|---|---|
| 10 | Correct the record (docs) | — | ✅ done |
| 11 | Fix the scale witnesses (root cause) | — | ✅ done (consensus rule approved 2026-10-27) |
| 12 | Real metres on floor plans (reviewed, one confirm) | 11 + decision | ✅ done |
| 13 | Open on a floor plan by default | — | ✅ done |
| 14 | Circuit callouts are labels, not equipment | — | ✅ done |
| 15 | Pad footprints are not heights | — | ✅ done |
| 16 | Re-parse saved drawings after parser changes | — | ✅ done |

13, 14 and 15 are small and independent; they can land in any order. 12 waits for 11.

## Phase 10 — Correct the record

- `docs/SPATIAL_RENDER_ACCURACY_REPORT.md`: mark the Phase 3b finding (§3) and remaining item #3 (§4) as
  superseded, with the T-pad measurement, the witness root cause, and a link to this plan. Keep the
  original text, since the history matters.
- `docs/SPATIAL_RENDER_ACCURACY_PLAN.md`: the same note on Phase 3, Phase 3b and pending item #3, plus a
  decisions-log entry dated 2026-10-26.
- `lib/sheet-scale.ts` header comment cites the 6.2× as fact; that is fixed with Phase 11's code.

**Done when:** no doc claims Brynhurst's printed scale is wrong.

## Phase 11 — Fix the scale witnesses

1. **Confirm on the real file first.** Dump the E-3 (page 3) witnesses through the parse audit: label,
   matched line length, text-to-line distance. Expect the matched lines to be about 6× too long.
2. **Fix.** At the top of `validateIndependentScale`, convert items and segments into normalized 20-unit
   space once, so every threshold in `dimensionWitnesses` and `graphicScaleWitnesses` uses one unit.
   Review the graphic-scale thresholds (`.08` row window, `.45` column window, `.004` minimum, lines 77
   and 86); they look tuned for 0–1 space, so decide each one's intended unit and test it.
3. **Tests** in `scripts/qa-scale-validation.mjs`: a 0–1-space copy of every existing case, plus a
   negative case where a long wall sits near a dimension label and must not be chosen.
4. **Re-run the Brynhurst audit** and record each sheet's status. Expected: E-3 CORROBORATED near 5.121
   m/unit. Sheets with details at other scales may honestly stay MISMATCH. If E-3 stays MISMATCH only
   because a few detail dimensions disagree, consider a consensus rule (most witnesses agree with the
   declared scale) instead of today's max/min spread test. That rule would need its own approval.
5. **Check other consumers of witnesses** for side effects: `lib/elevation-surface.ts:49,139`,
   `lib/spatial-evidence-envelope.ts`, and the elevation controls built from `scaleValidation` in the
   worker. Re-run their QA.
6. Update the `lib/sheet-scale.ts` comment. Keep the policy: declared-only is still not a sizing candidate.

**Done when:** QA passes in both coordinate spaces, and E-3 reports a scale within 5% of 5.121 m/unit.

**Note:** scale evidence is computed at parse time, so graphs already saved in a browser keep the old
evidence. Uploading the same file again used to skip re-parsing; Phase 16 flags such drawings and
re-parses them (see the testing guide).

## Phase 12 — Real metres on floor plans

The route already exists: `derivePdfMetricFrameCandidates` → `applyReviewedPdfMetricFrame`
(`lib/pdf-metric-frame.ts`) multiplies X/Y by metres-per-unit, records the original, and
`restoreReviewedPdfMetricFrame` undoes it. A candidate is eligible only when the sheet is CORROBORATED with
confidence ≥ .6. The confirm button lives only on /compiler (`app/compiler/page.tsx:38`,
`components/PdfMetricFrameReview.tsx`).

**Decision needed: how does E-4 get a scale it can confirm?**

| Option | What it means | Recommendation |
|---|---|---|
| A. Same-set corroboration | A sheet whose own printed scale and page size match a sheet that *is* corroborated by measurements (E-3) gets a reviewable candidate, labelled with the sheet that proved it. A person still confirms it. | **Recommended.** Small change, and it covers most electrical plans, which rarely carry dimensions. |
| B. Footprint-label witness | Treat a label like `6' x 8'` next to a matching 6:8 rectangle as the sheet's own measurement. | Later. Stronger evidence, but more work and rarer on electrical sheets. |
| C. Apply automatically | No confirmation. | Not recommended. It reverses a deliberate safety rule. |

**Changes (assuming A):**
- `lib/pdf-metric-frame.ts`: allow a REVIEW candidate from same-set corroboration (same declared scale
  text, same page size, at least one CORROBORATED sibling). Its `reasons` name the sibling sheet.
- `components/CompiledGraphViewer.tsx`: next to the nominal-size banner (line 757), offer "Apply drawing
  scale" for the active sheet, reusing `PdfMetricFrameReview` logic. Once applied, the banner shows the
  scale, where it came from, and an undo. Optional: "apply to all sheets with this scale".
- Check that camera fit, grid and render origin handle extents about 5× larger (a sheet becomes about
  100 m wide).
- In the "All sheet frames" overlay, warn when metric and unscaled sheets are mixed.

**Tests:** extend `scripts/qa-pdf-metric-frame.mjs` (same-set candidate, apply, undo, refusal when
the scale text or page size differ). The Brynhurst e2e applies the scale on E-4 and checks the distance.

**Done when:** on E-4 after confirming, MS1↔MS2 renders 3.6 m ± 5% (0.708 units × 5.121 = 3.63 m), and
undo puts it back.

## Phase 13 — Open on a floor plan by default

- Move the frame choice (`CompiledGraphViewer.tsx:193-201`) into a pure function, for example
  `lib/sheet-frame-choice.ts`, so it can be tested in Node.
- MODEL mode: prefer non-SLD, non-raster plan frames, ranked by how many INSTANCE equipment items they
  draw, then by page order. Use an SLD frame only when there is no plan frame. ELECTRICAL mode is unchanged
  (SLD first is right there).
- When an SLD frame is showing, add one line to the banner: "One-line diagram: positions show drawing
  layout, not real distances."

**Tests:** new `qa:sheet-frame-choice`; the Brynhurst e2e asserts the default frame is p4, the first floor
plan.

**Done when:** Brynhurst opens on E-4 with MS1 and MS2 visible.

## Phase 14 — Circuit callouts are labels, not equipment

`isInstance` treats any name containing a digit as a designator, so "MS1 #1" (circuit 1 from MS1)
becomes a switchboard. Add a circuit-reference rule before the digit test:

- `#` followed by a number (`MS1 #1`, `HP1 #3`) → LABEL;
- a designator that already ends in a digit, followed by `-n` or `-n,m` (`HP1-1`, `HP1-1,3`) → LABEL.

`MS1`, `LP-3` and `XFMR-2` stay INSTANCE. Roles stay reversible, so a reviewer can still promote one. This
is the first half of the panel-vs-circuit designator rule paused in the accuracy plan.

**Tests:** cases in `scripts/qa-candidate-gating.mjs` for each pattern above.

**Done when:** Brynhurst has 6 instances instead of 7, and E-4 draws two switchboards.

## Phase 15 — Pad footprints are not heights

1. **Confirm the cause.** Read MS1's `meta.supportOffsetEvidenceLabel` from the Brynhurst run (the
   enrichment already stamps it).
2. **Fix** in `lib/support-base-evidence.ts`:
   - a label carrying a footprint (`6'x8'`, `6' x 8'`) is a plan size, not a height. Skip it unless a
     height word (`HIGH`, `H`, `THK`, `THICK`, `TALL`) sits next to a value, and then use that value;
   - per-kind limits: PAD and HOUSEKEEPING_PAD at most 0.6 m (real pads are about 4–12 in), CURB at most
     1 m (roof curbs commonly reach 24"; changed from 0.6 m during implementation). PLINTH and FOOTING keep
     today's 3 m limit.
3. **Tests** in `scripts/qa-support-base-offset.mjs`: `6'x8' T-Pad` → none; `6' x 8' CONC PAD` → none;
   `4" HOUSEKEEPING PAD` → 0.1016 m; `CONC PAD 6" HIGH` → 0.1524 m; `8' x 10' PAD, 6" THICK` → 0.1524 m.

**Done when:** MS1 sits on the floor datum (base Z 0) on E-4.

## Phase 16 — Re-parse saved drawings after parser changes

Added 2026-10-27 at the owner's request. Scale evidence, support notes and equipment candidates are
computed when a PDF is parsed, and uploading a file this browser already holds was skipped as a duplicate.
So anyone who imported a drawing before phases 11–15 kept the old results until they cleared browser data.

- `PDF_PARSE_REVISION` in `lib/spatial-source-reprocess.ts` names the current PDF parser. Every PDF parse
  stamps it on the source record (`parseRevision`). Bump it whenever a parser change alters saved results.
- `drawingSourceReprocessReason` keeps the legacy no-basemap reason first, then reports a PDF whose
  `parseRevision` is missing or different. That reason drives the existing flows: the Import page's
  **REPROCESS SAVED DRAWING** notice (one click when the browser kept a local copy, otherwise
  **REUPLOAD**), uploading the same file again now re-parses it, and Spatial shows **Older drawing parse**.
- The re-parse guard that rejects a result without a drawing basemap now applies only when the old
  reason was a missing basemap or the previous parse had one, so a revision re-parse of a PDF that never
  had a basemap (a spec sheet) is not rejected and left flagged forever.
- **Tests:** `qa:stale-drawing-reprocess` (unstamped and older revisions flagged, legacy reason first,
  failed and non-PDF sources not flagged, the stamp and narrowed guard wired in the import path).

**Done when:** a browser that imported Brynhurst with the old code is told to refresh it, and re-uploading
(or the one-click archived reprocess) brings back 6 instances, a corroborated E-3 and **Apply drawing
scale** on E-4.

**Result (2026-10-27).** Imported Brynhurst with the pre-change code (HEAD `013784b`) into two browser
profiles, then opened them with the new build. Both showed **REPROCESS SAVED DRAWING** and **Older drawing
parse**. Re-uploading the PDF (one profile) and **Reprocess archived drawing** (the other) each re-parsed in
about 30 s: revision stamped, 7 → 6 instances, "MS1 #1" a label, E-3 MISMATCH 0.826 → CORROBORATED 5.121,
**Apply drawing scale** offered on E-4.

## Expected Brynhurst numbers

| Check | Today | After |
|---|---|---|
| Default sheet | p2, one-line diagram (E-2) | p4, first floor plan (E-4) |
| Switchboards drawn on E-4 | 3 (includes "MS1 #1") | 2 |
| MS1 base height | 1.83 m | 0 m (floor datum) |
| E-3 scale check | MISMATCH (0.826 vs 5.121) | CORROBORATED ≈ 5.121 |
| MS1↔MS2 on E-4 | 0.71 m | ≈ 3.6 m after confirming the scale |

## Results (2026-10-27)

Measured on Brynhurst through the real import on a production build. The e2e
(`STRATUM_BRYNHURST_E2E=1`) passes with no silent failures.

| Check | Before | After |
|---|---|---|
| Default sheet | p2, one-line diagram (E-2) | **p4, first floor plan (E-4)** |
| Instances (switchboards drawn on E-4) | 7 (3, includes "MS1 #1") | **6 (2)** |
| MS1 base height | 1.83 m, from "6' x 8' T-Pad" | **0 m** (floor datum) |
| E-3 scale check | MISMATCH, median 0.826 | **CORROBORATED, 5.121** by consensus (14 of 19 witnesses within 5%) |
| E-4 scale offer | none | **Apply drawing scale**, corroborated by E-3 (same printed scale and page size) |
| MS1↔MS2 on E-4 | 0.71 m | **3.62 m** after **Apply drawing scale**; Undo restores 0.71 |

**What Phase 11 changed beyond the unit fix.** With thresholds in the right units, the nearest line to a
dimension label turned out to be a text box or tick, not the dimension line (all witnesses read 2–30× too
large). Witnesses now require a real dimension: a line centred on the label, crossed by perpendicular
extension lines near both ends with equal overshoot, measured between the crossings, one label per line,
duplicate PDF lines removed. Checked offline against E-3's real geometry (a Node copy of the worker's text
and vector extraction reproduces the browser's witnesses exactly).

**Consensus rule (approved 2026-10-27).** 12 witnesses read 5.121 within 1% and 2 more within 5%, but 5
pair with the wrong lines (0.38×, 0.80×, 0.85×, 0.86×, 1.17×), and the old rule failed a page when any
two usable witnesses differed by more than 18%. Now, when that spread test fails, a page still
corroborates if it has at least 5 usable witnesses and at least 60% of them agree with the declared scale
within 5% (`CONSENSUS_*` in `lib/scale-validation.ts`). The corroborated value is the median of the agreeing
witnesses, outliers stay listed but unused, confidence drops with the share that disagrees, and
`agreement` records the counts. E-3: 14 of 19 (74%), confidence 0.78. An even split or fewer than 5
witnesses is still MISMATCH.

**Apply/undo writes.** On the dev server right after an import, the write waits about a minute behind
background projection (the contention left open in Phase 6 of the accuracy plan). A first version that read
the graph, then wrote it with a signature check, lost every race to projection and retried for minutes.
Apply and undo now use `updateCurrentSpatialGraph` (`lib/spatial-browser-recovery.ts`), which reads, changes
and writes the graph in one turn of the write queue, so nothing is lost and nothing retries. The Spatial
button shows **Applying…** with an explanation, and stays busy until the rewritten graph reloads.

**Found on the way (Phase 12).** `derivePdfMetricFrameCandidates` only read scale evidence from sheet
geometry, but the PDF parser stores it on a non-spatial `scale-validation-candidate` record, so the
/compiler metric-frame panel never offered a candidate for a real PDF. It now reads the page record.

## Verification

- Node QA: `npm run typecheck`, `qa:scale-validation`, `qa:sheet-scale`, `qa:pdf-metric-frame`,
  `qa:candidate-gating`, `qa:support-base-offset`, `qa:spatial-parse-audit`, `qa:relative-story-datum`,
  `qa:brynhurst-golden`, and the new `qa:sheet-frame-choice`.
- Full pipeline on the real file: the prod-build e2e from the report (§6), extended with the default frame,
  the E-4 switchboard count, MS1 base Z, and the distance after confirming the scale.
- Each phase ends with a short entry in the accuracy report: before and after numbers.

## Later (separate approval)

- **Panel-schedule reader.** Still blocked upstream: schedule extraction returns noise ("A B", "9
  UTILITY CONTACTS"), so panels on the plans can't be recognised. A code-only parser first; the Claude API
  prototype only if that fails on two or more drawing sets.
- **More real drawing sets with source DXF**, so distances are scored against CAD automatically
  (depends on the tooling request).
- **A DXF-through-the-real-parser test and a full end-to-end test on a plan-heavy set.**
- **Footprint-label witnesses** (Phase 12 option B).
- **Projection write contention** (architectural, from Phase 6).
