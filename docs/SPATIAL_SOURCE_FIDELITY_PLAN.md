# Spatial Source-Fidelity Plan

**Status:** proposed, awaiting approval · **Drafted:** 2026-10-29 · **Branch:** `ujjan-v2`
**Follows:** `docs/SPATIAL_RENDER_ACCURACY_PLAN.md` (phases 0–9), `docs/SPATIAL_METRIC_PLACEMENT_PLAN.md`
(phases 10–16). Phase numbers continue from there.

## The problem in one paragraph

After **Apply drawing scale**, E-4 shows two library components (MS1, MS2). The drawing has dozens of
electrical items: switchboard sections, panels, unit load centres, light fixtures, fans, receptacles, switches,
motors and junction boxes. Phases 0–16 made the few detected items accurate (scale, Z, de-duplication). They
did not change **how items are detected**. The pipeline still turns **text words** into equipment, using a
fixed vocabulary. It does not find **drawn symbols** on the electrical layers. Better scale or Z handling
cannot fix this. Detection has to work differently.

## What we found (verified 2026-10-29 on the Brynhurst bid set)

### 1. Why only two components are placed

| Finding | Evidence |
|---|---|
| Equipment comes from single pdf.js text items matched against a fixed regex list. | `workers/pdf-native-parser.worker-v2.ts:342`; `lib/sld-recognition.ts:13` (`RULES`). |
| The project's own designators are not recognised. `HP1`, `HL`, `HP3`, `DIST`, `P/S`, `EF`, `A1`, `T`, `M` all return `null`. Only `MS1`/`MS2` (via `MS\d+`) and the bare word `PANEL` match. | Ran `classifyElectricalLabel` on every E-4 designator. |
| The gate keeps only names that contain a digit, so letter-only tags such as `HL`, `DIST` and `P/S` can never become equipment. | `lib/candidate-gating.ts:33`. |
| Legend symbol matching fingerprints **one closed polygon** per legend row by vertex count, aspect and radial profile. Real symbols are several primitives (circle + ticks, circle + letter, hexagon + tag). The audit found 4 vector matches in the whole set. | `lib/electrical-symbol-fingerprint.ts`; Phase 1 audit. |
| Curves are approximated by averaging control points, so circles (the most common device shape) come out as crude polygons. | `workers/pdf-native-parser.worker-v2.ts:116` (`code===2`). |
| Layer, colour, fill and line weight are thrown away. | Same file. Only path coordinates are kept. |
| **The PDF carries its AutoCAD layers.** It has 56 optional-content groups, including `E-WIRE`, `ETEXT`, `EE_CKT01…24` (one per circuit), `A-WALL`, `A-DOOR` and `XREF_ARCH\|EE_Building`. On E-4, **13,479 of about 15,300 paths are on the architectural xref** and about 1,900 are electrical. | pdf.js `getOptionalContentConfig` + `beginMarkedContentProps`, counted per layer. |

**Apply drawing scale** only multiplies X/Y. It does not add equipment, so the same two items appear before and
after.

### 2. Why labels are extracted wrongly

- **No phrase assembly.** Each text item stands alone. `ELEC.` + `PANEL` (11 unit load centres on E-4) becomes
  11 bare `PANEL` labels. `F.O. BOX MIN. 12"X12"X6"` breaks into fragments.
- **No project vocabulary.** The one-line (E-2) and the panel schedules list every panel: MS1, MS2, P/S, DIST,
  HL, HP1, HP2, HP3, HWH and unit panels 101–414. Nothing reads that list and uses it to recognise tags on the
  plans.
- **Much of the set is images, not text.** E-2 has 12 embedded images (the panel schedules, the MS2 load table
  and the LADWP notes), and only 88 words are extractable on the whole sheet. E-7 to E-9 (unit plans) are scanned
  CCITT rasters. No OCR runs, so the panel names, ratings and mounting types in the schedules are invisible.
- **Labels are treated as objects.** `HP1-4` and `HL-1` are homerun circuit tags, `A1` is a fixture type and
  `EF 3` is a fan tag. Each is an **attribute of a nearby symbol**. The pipeline makes them objects of their own,
  or drops them.

### 3. Why "Resolve Z" and similar buttons lead to a read-only section

- **Resolve Z** (`SpatialAssetInspector.tsx:215`), **Review elevation evidence** and the **Z NEEDS REVIEW**
  link (`CompiledGraphViewer.tsx:889,904`), and **Resolve elevation / Z** (`SpatialReviewQueue.tsx:44`) are all
  `href="#z-resolution-review"` anchors.
- The target, `ZResolutionReview`, sits inside the collapsed **Review & trust details**
  (`app/spatial/page.tsx:66`). It shows KPI tiles and explanations and has no inputs. Its own buttons go back to
  `#spatial-model`, to `/compiler#z-review` or to `/docs`, so the user goes round in a loop.
- The only Z control that saves anything is **Use this design chain** (`SpatialAssetInspector.tsx:383`). It
  appears only when two absolute chains **conflict**, and it needs a signed-in server session.
- Nowhere can a person set a level elevation, a ceiling height or a mounting height (AFF), confirm a detected
  symbol, or change an item's class.

## The output we actually need

For each plan sheet, one 3D object per real electrical item, built from:

| Attribute | Source on Brynhurst |
|---|---|
| **Class** | The legend symbol on E-1 ("DUPLEX RECEPTACLE", "SUB-PANEL (LOAD CENTER) SURFACE MOUNTED", "DISCONNECT SWITCH"…) and the fixture schedule (types A, A1, B…). |
| **Tag** | The nearby text from the project roster (MS1, HP1, HL, unit 105) or the fixture type (A1). |
| **Position + rotation** | Symbol centre and orientation, in metres after the sheet scale. Wall devices snap to the nearest `A-WALL` line. |
| **Footprint** | To-scale items (switchboards, panels, pads) use the **drawn rectangle**. MS2 is a long lineup, and E-2's elevation gives 36"/30"/36" section widths. Devices use library nominal dimensions. |
| **Z** | Story datum + a mounting rule from the source. The legend says `+18"` to the receptacle centre, and the schedule says "FLUSH/SURFACE MOUNTED". Fixtures go at the ceiling, and switchboards at the floor or pad. |
| **Circuit** | The `EE_CKTnn` layer + homerun tag (`HP1-4` → panel HP1, circuit 4). |
| **Library model** | Existing GLBs: `main-switchboard`, `panelboard-full`, `meter-ct-cabinet`, `wall-device-plate`, `luminaire-family`, `ceiling-device-puck`, `disconnect-breaker-generic`, `industrial-electric-motor`. |

Things seen on E-4's electrical room alone: MS2 lineup, the DIST / MS1 / P/S lineup, HP1 and HL panels, an
F.O. box, A and A1 (EM) fixtures, two EF-3 fans, thermostats, receptacles and homeruns. The building-wide set
adds 11 unit load centres per floor, motors (M) and time clocks (TC).

## Recommended changes

The core change: **symbols on electrical layers become objects. Text labels become their attributes.** Today
text words become objects.

### Phase 17 — Ground-truth inventory and scorecard (do first)

Hand-label E-4 in a JSON fixture: every electrical item with its class, sheet position, tag and circuit.
Add `qa:brynhurst-inventory` to score precision and recall **per class** and the position error. Today's tests
check the pipeline against its own past output. None of them check it against the drawing, which is how "2 of
dozens" got through. Every later phase is judged against this fixture.
**Size:** S (about a day of careful labelling).

### Phase 18 — Read the PDF like CAD (layer-, colour- and curve-aware)

- Record each path's **optional-content layer** (`beginMarkedContentProps` + `getOptionalContentConfig`),
  stroke and fill colour, fill vs stroke, and line width.
- Keep curves: fit circles and arcs from Bézier control points instead of averaging them.
- Give each layer a role from its name (`A-*`/`XREF_ARCH*` → architecture, `E-*`/`EE_*` → electrical,
  `ETEXT` → electrical text, `G-ANNO*` → annotation). When a PDF has no layers, fall back to colour (black for
  electrical, grey for the architectural background, as on E-4).
- Group electrical primitives into **glyph clusters**, the candidate symbols.
- Bonus: the viewer can dim architecture and draw walls from `A-WALL` instead of from every line.

**Why:** this removes about 85% of the noise before matching starts, and gives circuits for free.
**Size:** M.

### Phase 19 — Legend-driven symbol detection (the core fix)

- Read E-1's **General Symbols** rows as (glyph cluster, description, mounting note such as `+18"`). Read the
  **light fixture schedule** as (type, description, watts, volts).
- Match each multi-primitive template against glyph clusters on plan sheets, on electrical layers only.
  Matching must allow rotation and mirroring (normalised primitive sets plus chamfer or shape-context distance),
  and must include the **letter inside the symbol** (S, S3, M, T, EF, hexagon A/A1).
- Each match becomes a `legend-symbol-match-candidate` (an existing kind, already INSTANCE in the gate) with
  its legend row, so class, mounting note and library key travel together.
- Scanned pages (E-7 to E-9): render to raster and template-match there (OpenCV.js), as a separate,
  lower-confidence path.
- **Optional AI assist (needs a decision):** a vision model reads the legend and decides ambiguous clusters
  from a crop. The geometric matcher stays primary, and AI output stays a review candidate. See Decision 1.

**Size:** L.

### Phase 20 — Labels: phrases, project roster and OCR

- Join text items into phrases (same baseline, gap under one character width): `ELEC. PANEL`, `F.O. BOX`.
- Build a **project equipment roster** from the one-line, the riser and the panel schedules (name, rating,
  mounting, location, for example "PANEL HP1 · 100 A · SURFACE · METER ROOM"). The classifier becomes generic
  vocabulary + roster, so `HP1`, `HL`, `DIST` and `P/S` are recognised.
- **OCR the raster schedules** on E-2 with the reader pipeline in Phase 20a (no AI). This is the "upstream
  schedule parser" that the accuracy report (§4 #4) found blocking.
- Attach labels to symbols: a tag belongs to the nearest compatible glyph (inside it, on a leader, or within a
  class-specific radius). Homerun tags become circuit attributes.
- Replace the "name contains a digit" gate: an item is an INSTANCE when it is **symbol-backed** or is a
  **roster designator with a drawn footprint**.

**Size:** M (L with OCR).

**Result (2026-10-29): roster, phrases and plan recognition done; general label-to-symbol attachment waits for
Phase 19.**

What was built:

- **Phrases** (`lib/text-phrases.ts`). Runs on one baseline join. Two short centred lines stacked on top of each
  other join too, so "ELEC." over "PANEL" becomes one label.
- **Text direction.** The worker now records each run's direction as printed, page rotation included
  (`sheetDirX`/`sheetDirY`), plus its font size.
  - The older `dirX`/`dirY` fields ignore a page's `/Rotate`. Brynhurst's sheets are stored rotated, so
    horizontal labels read as vertical in those fields.
  - The legend symbol matcher still uses the old fields, a likely cause of its 4-match result. That fix
    belongs to Phase 19.
- **Footprints.** Each short label gets the drawn rectangle it sits in (a lineup box) or beside (a panel bar).
  - Rectangles come from closed paths and from solid fills that CAD exports as two triangles sharing a
    diagonal, which is how HP1 and HL are drawn.
  - Footprint shapes are collected apart from the capped polygon list, which drops shapes past 6,000 per page:
    E-4 has 6,808 closed paths and E-5 14,352.
- **Text layer.** One non-spatial `pdf-text-layer` record per drawing page keeps the phrases, footprints and
  plan frames for later passes.
- **Roster** (`lib/equipment-roster.ts`), built from:
  - the panel schedules (OCR of the embedded images): tag, rating, mounting, location, mains, voltage, phase
    and totals. OCR garbles ø, so phase comes from the wire count;
  - the service load table: fed-from and feeds;
  - the dwelling load table: units served and demand;
  - the one-line text: switchboards and their nearest bus rating.
- **Checks recorded on every entry:**
  - subtotals add up to the printed total (largest-continuous-load allowance included);
  - VA ÷ volts (or ÷ √3·volts) gives the printed amps;
  - the written phase agrees with the wire count;
  - the service table repeats each panel's load.
  A failed check is kept and lowers confidence, never hidden.
- **Recognition on plans.** A roster name labelling a drawn symbol becomes a candidate on the symbol, with its
  roster identity and library model. So do:
  - a class phrase ("ELEC. PANEL") beside a filled bar, as a unit load centre;
  - boxed section words (DIST, P/S) beside a switchboard box, as sections of that lineup.
- **Guards:**
  - a panelboard must be a thin wall bar (≥ 2.5:1). An "HP1" on the roof labels a 1.2 m × 0.7 m box (a heat
    pump), and is rejected;
  - a roster name placed twice keeps the match on the floor its schedule names;
  - symbols are placed only on frames with a resolved floor. The enlarged typical-unit plans on E-7 to E-9
    repeat panels already on the floor plans.
- **Gate.** A roster name or class phrase with a drawn footprint is an INSTANCE even without a digit (HL). A
  lineup section stays a LABEL of its switchboard.
- **Records and audit.** Roster entries are kept as non-spatial `equipment-roster-entry` records. The parse
  audit gains a `roster` section. `PDF_PARSE_REVISION` is now `2026-10-29.equipment-roster`.

| Check (golden fixture) | Before | After |
|---|---|---|
| Equipment roster | none | HL, HP1, HP2, HP3, HWH, MS1, MS2 |
| Roster self-checks | — | 20 of 20 pass (Node and browser) |
| HP1 | — | 100 A, surface, meter room, 120/208 V 1ø, 10,820 VA = 52 A, fed from MS1 |
| MS1 / MS2 | — | feeds the elevator motor and five panels, 400 A bus / 53 units, 640 A, 800 A bus |
| Roster names on drawn symbols | MS1, MS2 on E-4 | + HL, HP1, HP3 on E-4 and HP2 on E-5 (HP3 and HP2 on their scheduled floors) |
| Unit load centres | 0 (25 bare "PANEL" labels) | 25 (11 on E-4, 14 on E-5) |
| MS1 lineup | one label | DIST \| MS1 \| P/S: 36.0" \| 30.0" \| 36.0" × 19.8" deep at the printed scale, matching E-2's elevation |
| Instances drawn (browser e2e) | 6 | 35, all drawn, 0 gaps |
| E-3 scale, MS1↔MS2 after Apply | 5.121 · 3.62 m | unchanged |

Not covered by this step:

- **Not yet on the plans.** HWH is on the roster but has no text label on E-6, only circuit callouts. The
  elevator motor and the 53 unit panels per floor are roster facts without per-unit names.
- **Panel tags drawn as strokes** on the one-line (the HL, HP1… boxes) need OCR step 4.
- **Size is still nominal.** Positions follow the drawn symbol, but rendered size is still the library's
  nominal size. Sizing from `drawnFootprint` (stored in sheet units) is Phase 21. *Done; see Phase 21.*
- **Projection settles slower.** The browser e2e settle window went from 30 s to 60 s. Each projection pass
  re-reads and re-writes the whole ~39 MB graph, and under heavy machine load the first pass applied about 38 s
  after render and Apply took 33 s. Phase 20 adds no graph writer. The fix is the open writer-ordering item
  (accuracy report §4 #1). *Fixed 2026-10-29: about 21 s to settle and 17.6 s for Apply (see Phase 21).*

**Tests:**

- `npm run qa:equipment-roster` covers phrases, rectangles, footprints, roster parsing and checks (including a
  misread subtotal and the browser's "3,486 |LCL" read), recognition guards, the gate and the wiring. It runs
  in prebuild.
- `npm run qa:ocr-brynhurst` now also builds the real roster and runs recognition on E-2 to E-9.
- The Brynhurst e2e asserts the roster, its checks, the roster symbols, the 25 load centres, the MS1 sections
  and the 35 instances.

### Phase 20a — Stable OCR without AI, ready for AI later (measured 2026-10-29)

**Today's OCR barely runs and reads little when it does.** Tesseract.js 7 runs only on pages with fewer than
3 text items (`workers/pdf-native-parser.worker-v2.ts:70`), so E-2 and the scanned unit plans are never read.
When it does run, it renders the whole sheet about 1,800 px wide (`components/CompilerWorkspace.tsx`
`parsePdfSelectedOcrPages`). On a 42" sheet that is about 43 dpi: drawing text ends up 3–4 px tall. It uses
Tesseract's automatic page layout and starts a new engine per file. In the browser it downloads its worker
script, WASM engine and language data from the jsDelivr CDN at run time, because no `workerPath`, `corePath` or
`langPath` is set; offline use or a CDN outage breaks it. The fallback path swallows errors (`catch{}`). The E-2 schedules are also stored **rotated 90°** inside the PDF.

**Measured on Brynhurst** (Node, Apple-silicon CPU, one drawing set; scratch harness, not committed). Counts are
expected tokens found. Answer keys: HP1 and Service MS1 typed from the images; E-4 from its own text layer.

| Test | Tesseract.js 7, today's settings | Tesseract.js 7, tuned¹ | PaddleOCR PP-OCRv5 EN mobile | PaddleOCR PP-OCRv6 small |
|---|---|---|---|---|
| E-2 whole sheet at today's render size: HP1 values | 1/19 | 1/19 | 0/19 | 0/19 |
| HP1 schedule, native 400 ppi image, turned upright: words / values | 18/49 · 15/19 | 49/49 · 19/19 | 48/49 · 19/19 | 49/49 · 19/19 |
| Service MS1 table, native, upright: words / values | 2/17 · 0/23 | 15/17 · 20/23 | 13/17 · 23/23 | 17/17 · 23/23 |
| E-4 electrical room at 150 dpi (86 text-layer words) | 7 | 25 | 35 | 53 |
| E-4 electrical room at 300 dpi | 16 | 42 | 44 | 49 |
| E-2 one-line labels drawn as strokes (29) | 20 | 16 | 15, misread `114A` as `14A` | 19 |
| Same, vertical fault-current labels, crop turned 90° (6; 0 for every engine unturned) | 5 | 5 | 1, misread `8,059` as `8054` | 2 |
| Time per crop | 0.4–3.4 s | 0.4–1.4 s | 0.6–1.4 s | 0.6–1.5 s |
| Download | 5 MB language data + 3 MB core | same | 12 MB models | 30 MB models |

¹ Sparse-text page segmentation (PSM 11), English dictionaries off.

What this shows:

- **Input matters more than the engine.** Whole-sheet renders fail with every engine. Native image pixels,
  turned upright, take the same Tesseract from 0/23 to 20/23 values on the MS1 table.
- **Tuning Tesseract is free and large:** 2/17 → 15/17 words on MS1 and 16 → 42 words on E-4.
- **PaddleOCR PP-OCRv6 small is the best single reader** for schedules and plan text, but not for rotated
  italic labels, where Tesseract reads 5 of 6.
- **No engine is safe alone.** Each made a different wrong-digit misread on the one-line. Two readers that must
  agree, plus the drawing's own sums, catch this; the HP1 and MS1 values had no misreads from the tuned readers.
- **OCR is the wrong tool for single letters inside symbols** (`M`, `1`, `T`); every engine dropped most of
  them. Those come from the text layer or from symbol matching (Phase 19).

**Design**

1. **Read only what has no text.** Use the PDF text layer wherever it exists; it is exact and free. Send to OCR
   only embedded images, scanned pages, and regions drawn as stroked text (found from Phase 18's layers and
   glyph clusters).
2. **Use native pixels.** Pull embedded images out at their stored resolution through pdf.js, and use their
   placement matrix to turn them upright. That rule is exact, so there is no guessing orientation. Render
   stroked-text regions at 300 dpi. Tile scanned pages (about 2,048 px tiles, 10% overlap). Never send a whole
   sheet.
3. **Try vertical text both ways.** Read tall boxes at 0° and 90°.
4. **Read tables as tables.** Find the grid lines and read each cell. Numeric columns get a digits-only
   whitelist. Check column sums against printed subtotals, VA ÷ volts against printed amps, and values against
   the one-line.
5. **One reader contract** (`lib/ocr-reader.ts`):
   - **Request:** source SHA-256, page, region in sheet units, rotation, pixels, and a kind (TABLE, LABELS
     or SCAN), with an optional vocabulary.
   - **Response:** items with text, polygon in sheet coordinates, score, reader id and reader version.
   - **Readers:** `tesseract` (tuned) and `paddleocr` now; an AI vision reader later implements the same
     interface.
6. **Reconcile, then validate.**
   - **Reconcile:** match readings by box overlap and mark each token AGREED, DISAGREED or SINGLE.
   - **Validate:** run checks that do not depend on the reader (sums, project roster, cross-sheet values).
   - **Accept automatically** only what is agreed or check-confirmed. Everything else goes to the review
     queue.
   - **Authority:** this is a review candidate, as with `ocrAuthority:'REVIEW_ONLY'` today.
7. **Runtime.**
   - **Workers:** one long-lived module worker per engine, using OffscreenCanvas.
   - **Assets:** self-host all of them (Tesseract core and `eng.traineddata`, ONNX Runtime wasm, Paddle
     models) under `public/` with pinned versions. Nothing is fetched from a CDN at run time.
   - **Loading:** lazy-load Paddle only when a page needs OCR.
   - **Threads:** single-threaded WASM, so no COOP/COEP headers are needed. Threads and WebGPU need
     cross-origin isolation, so they are a later option.
   - **Limits:** crop budget, timeout per crop, cancel through the existing `AbortSignal`.
   - **Diagnostics:** emit `OCR_READ`, `OCR_DISAGREE` and `OCR_FAILED` events instead of `catch{}`.
8. **Cache** every reading in IndexedDB by (source SHA-256, page, region, rotation, reader, version), so a
   re-parse does not re-read. Keep raw output for audit. Bump `PDF_PARSE_REVISION`.
9. **Calibrate against the text layer.** Pages with a text layer are a free answer key. Render a region, read it
   and compare. The parse audit reports a per-set OCR accuracy, and a drop after an engine upgrade becomes
   visible.

**Engine choice:**

- **Primary reader:** PaddleOCR PP-OCRv6 small (Apache-2.0 project), through the official
  `@paddleocr/paddleocr-js` browser SDK with a pinned version and self-hosted models.
- **Low-bandwidth fallback:** PP-OCRv5 EN mobile (12 MB).
- **Second reader:** Tesseract.js 7, tuned (already a dependency).

The weights were measured through the community `ppu-paddle-ocr` package in Node, so a one-day browser spike
must confirm accuracy parity and speed before adoption. Browser WASM will be slower than these Node timings.

**Not now:**

- **Cloud OCR** (Google Document AI, AWS Textract, Azure Document Intelligence): drawings leave the browser,
  which is the same approval as AI.
- **Python services** (PaddleOCR PP-StructureV3 tables, docTR, Docling): add a backend.
- **Vision-language OCR models** (PaddleOCR-VL and similar): these are AI vision.

Revisit all of these with the AI work. The reader contract means none of them changes anything downstream.

**Steps:**

| Step | What | Size |
|---|---|---|
| 1 | Trigger fix, native-image extraction and orientation, tuned Tesseract, self-hosted assets, long-lived worker, cache, diagnostics. ✅ done 2026-10-29 | S–M |
| 2 | Reader contract, reconcile, validators | M |
| 3 | PaddleOCR browser spike, then second reader | M |
| 4 | Stroked-text regions (after Phase 18) | S |
| 5 | Table cell reading for schedules | M |

**Step 1 result (2026-10-29).**

What was built:

- **Placements.** The PDF worker records where every raster image lands on every page
  (`collectImagePlacements`).
- **Reading.** After the native pass, the import reads each image region as printed. Rotated images come out
  upright. Regions are read at up to 400 dpi, never above the image's own resolution, and dropped toward
  300 dpi when that keeps them to one tile.
- **Engine.** One shared Tesseract engine is used everywhere (`lib/client/ocr-runtime.ts`):
  - tuned for drawings: PSM 11, dictionaries off;
  - loaded from `public/ocr/tesseract`, which `scripts/prepare-pdf-assets.mjs` fills from the pinned
    `@tesseract.js-data/eng@1.0.0`;
  - a read that fails or runs past 120 s restarts the engine, and it is released after 3 idle minutes.
- **Cache.** Readings are cached in IndexedDB by source, page, tile, scale and reader version.
- **Scanned pages** are read in 300 dpi tiles instead of one screen-size render. **Uploaded images** are read
  at their own pixels. The main-thread fallback uses the same engine.
- **Records.** Results are stored as `ocr-region` and `ocr-text-line` records: non-spatial, reference-only and
  review-only. They are not drawn, are not equipment, and are not read by Expected Power. Phase 20 turns them
  into schedule records.
- **Diagnostics.** Events `OCR_ENGINE_READY`, `OCR_ENGINE_FAILED`, `OCR_TILE_FAILED`,
  `OCR_EMBEDDED_IMAGES_READ` and `OCR_*_OVER_BUDGET`. The parse audit gains an `ocr` section.
- **Re-parse.** `PDF_PARSE_REVISION` is now `2026-10-29.embedded-image-ocr`, so older imports are offered for
  re-parsing.

| Check (golden fixture) | Before | After |
|---|---|---|
| E-2 schedule images read | none (page never OCR'd) | all 10, at 400 dpi |
| E-7 to E-9 scans read | none | all 7, one tile each, ~340 dpi |
| HP1 schedule (Node QA) | — | 49/49 words, 20/20 values |
| Service MS1 values inside the image (Node QA) | — | 20/20 |
| Panel headers HL, HP1, HP2, HP3, HWH (browser e2e) | — | all read |
| Browser import, prod build | — | 17 images, 2,032 lines, 0 failed tiles, 37 s |
| Instances, E-3 scale, MS1↔MS2 after Apply | 6 · 5.121 · 3.62 m | unchanged |

Not covered by this step:

- The MS1 totals (127,158 VA, 352 A, 374 A) and the one-line labels are stroked vector text, not images.
  Reading them is step 4, after Phase 18.
- The browser cache hit path is covered by Node QA only.

**Tests:**

- `npm run qa:ocr-regions` covers planning, tiling, seams, the reader adapter, the cache and failure and cancel
  paths, and the wiring. It runs in prebuild.
- `npm run qa:ocr-brynhurst` runs the real engine on the golden PDF and skips without it. It takes about 30 s.
- The Brynhurst e2e asserts the OCR events and the five panel headers.

### Phase 21 — Placement from footprint + library

- To-scale equipment uses the drawn rectangle on the electrical layer for size and orientation: MS2's full
  lineup length, the DIST/MS1/P/S sections, the HP1/HL panel faces. The library model supplies height and
  appearance.
- Devices use library nominal size, the symbol's rotation, and snap to the nearest wall with the face pointing
  into the room.
- Fill library gaps: wall switch, thermostat, exhaust fan, time clock, meter-socket stack (MS2), pull section,
  fibre box, smoke/CO detector and ceiling fan, each with a model or a procedural shape.
- Offer **Apply drawing scale to all sheets with this printed scale** once a sheet is corroborated (still
  undoable), so people do not confirm three sheets one by one.

**Size:** M.

**Result (2026-10-29): placement, direction and size from the drawn symbol are done. Wall snapping, library
gaps and apply-to-all are not done yet.**

- **Placement** (`lib/drawn-footprint-placement.ts`):
  - recognised equipment sits on the centre of its drawn symbol; a switchboard sits on its whole lineup, so
    MS1 sits on DIST | MS1 | P/S;
  - it turns with the symbol's long side (0° or 90°);
  - selecting it points the camera there.
- **Size at a reviewed scale** (Apply drawing scale), in `lib/asset-placement.ts`:
  - plan width and depth are the drawn size in metres, under a new `DRAWN_SYMBOL` authority with its source
    text;
  - height stays the library's;
  - source or OEM dimensions still win over the drawing;
  - before the scale is confirmed, size stays nominal, as the banner says.
- **Graph and banner.** Projection stamps the drawn size on the graph (`assetDimensionsMeters`,
  `assetDimensionAuthority`). The banner reads **SIZED FROM DRAWN SYMBOLS · DRAWING SCALE APPLIED** with
  counts, and calls the sizes drawn, not measured.
- **Golden fixture, browser e2e after Apply:**
  - the MS1 lineup is **102.0" × 19.8"** (E-2's elevation: 36" + 30" + 36", 20" deep);
  - the HP1 bar is 16.7" × 3.1";
  - MS1↔MS2 is unchanged at 3.62 m.

**Projection write contention (accuracy report §4 #1) fixed in the same step:**

- **One pass at a time.** The Import and Spatial pages each mount the projection engine. Now one pass runs at a
  time, and a pass whose page has unmounted stops before writing (`PROJECT_CANCELLED_UNMOUNTED`). Before, the
  Import page's unfinished pass raced the Spatial page's.
- **No redundant rewrite.** The persistence guard no longer rewrites an unchanged chunked graph after every
  update. That rewrite re-put about 39 MB of chunks and queued every other writer behind it.
- **Cheaper change detection.** It skips the per-page text layer.
- **Measured on the golden fixture:**

  | Measure | Before | After |
  |---|---|---|
  | First settled projection after navigation | 54 s (load average ~12) | 21 s (load average ~5) |
  | Apply → Undo | 33 s | 17.6 s |

  Machine load differed between the runs, so this is not a clean comparison. The trace shows the race gone.
- The e2e timeouts stay at 60 s for heavy machine load.

**Tests:**

- `npm run qa:drawn-footprint-placement` covers geometry, rotation, lineup, authority order, the golden sizes
  and projection stamping.
- `npm run qa:projection-contention` covers serialized passes, cancel on unmount, no redundant rewrite, and
  signature behaviour.
- Both run in prebuild. The Brynhurst e2e asserts the drawn MS1 size and the banner.

### Phase 22 — Z from a rule chain the user can see and edit

- **Level table:** one elevation per story, filled from the set (E-4 = 1st floor, E-5 = 2nd/3rd, E-6 =
  4th/roof). Floor-to-floor height comes from sections when present; otherwise the user enters it once.
- **Mounting rules by class, with their source:** the legend (`+18"` to the receptacle centre), schedules
  (flush/surface panel → top of the highest handle at or below 6'7", per NEC 240.24), ceiling height for
  fixtures and detectors, and switches at 48". Each value records where it came from: legend, schedule,
  standard default, or user.
- Everything stays a review candidate (`physicalTruth:false`), but items reach a **resolved** design Z instead of
  `UNRESOLVED`.

**Size:** M.

### Phase 23 — Make the review buttons do something

1. **Quick fix (S):** open the `<details>` and scroll when any `#z-resolution-review` link is followed, so no
   link lands on a collapsed or hidden section.
2. **Real controls in the inspector (M):**
   - **Set level elevation.**
   - **Set mounting height (AFF)**, with a reference-point picker (base, centre or top).
   - **Apply to all N similar** (for example "23 receptacles → +18"").
   - **Confirm / reject / change class** for detected symbols.
   - **Attach label to symbol**, and **promote label to equipment**.
3. **Batch review queue:** grouped by class, with one-click confirm and per-item exceptions.
4. **Save decisions in the browser graph when signed out**, and on the server when signed in. Z review is
   currently server-only.
5. **Rule:** every button either changes the model or opens the exact control. Explanations move into
   tooltips or docs.

### Phase 24 — Breadth

Test on a second drawing set, ideally one with **DWG/DXF**, so the work does not overfit Brynhurst. The E-4
margin names `BRYNHURST.DWG`. The engineer's DWG would give block names and attributes: exact equipment with
no symbol recognition at all. The existing DXF path could use it directly. Ask the client for it.

## Merged with main (2026-10-29)

`main` (31 commits, up to `88e17f3`) was pulled into `ujjan-v2` with this work still uncommitted. Ten files changed
on both sides; seven needed hand resolution.

**Kept from main:**

- the **Entire project** default view;
- labels drawn as review pins;
- the accessory-preserving model scale;
- the `active` flag in the projection engine;
- the "newer local copy only" persistence guard;
- the re-process journal and failed-import retention;
- the PDF asset-URL and text-content helpers;
- vector-symbol anchoring in the worker.

**Kept from this branch:**

- **OCR and roster:** OCR, the roster and recognition on plans.
- **Projection:** one projection pass at a time across page mounts.
- **Viewer:**
  - drawn-symbol placement, with the review-layout offset added in the entire-project view;
  - auto-safe isolation choosing E-4.
- **Re-parse:** the Phase 16 parser revision. The Spatial notice keeps both titles: "Legacy drawing frame" for a
  missing basemap, "Older drawing parse" for a revision refresh.

**Integration fixes:**

- **Represented labels have no pins.** Labels already drawn as part of an instance (the bare "PANEL" word in
  "ELEC. PANEL", lineup sections) get no review pin.
- **The gate checks represented labels first.** It applies that rule before main's nearest-shape anchor, which
  would otherwise make those words equipment again.
- **The roster matches on the printed label.** It uses the label's original position (`sourceLabelX/Y`), which
  the anchor preserves.

**Results:**

- **Checks:** all 92 CI QA scripts and typecheck pass.
- **Brynhurst browser e2e:** passes with 51 instances: 8 roster-backed, 25 unit load centres and 18 from main's
  legend matcher and anchor.
  - The 18 are 7 receptacles and 7 "SD" on the typical-unit plans E-7 to E-9, 3 "Solar" on the roof and 1
    "PANEL" on E-9.
  - The two earlier motor instances are gone.
  - The Phase 17 answer key will judge these.
- **Full browser suite:** 147 of 148 pass. The one failure ("saved drawing REPROCESS queues visibly behind an
  active worker parse") is a timing race that fails at the same rate on pure main (4 of 5 paired runs on each).

**Entire-project view is heavy.** On Brynhurst it keeps headless Chromium's software renderer about 98% busy:
it draws all nine sheets every frame. Projection then cannot settle, so the e2e switches to auto-safe isolation
first. A real GPU is likely lighter. Render-on-demand would fix it, and is a follow-up for that view.

**Follow-up fixes (2026-10-29), all three verified on a production build:**

1. **The viewer renders on demand.**
   - It redraws every frame while the view moves (orbit, damping, fit, selection, resize). Otherwise it redraws
     about twice a second, so async model loads still appear (`IDLE_RENDER_INTERVAL_MS`).
   - On the entire-project view: long tasks fell from 88 s to 25 s out of 90 s, and projection applies in under
     2 s (it did not settle before).
2. **Typical-unit details are labels, not instances.** A symbol on a frame that names a unit and has no floor
   (E-7 to E-9) stays a label, with `candidateRoleReason:'TYPICAL_UNIT_DETAIL'` (`lib/candidate-gating.ts`).
   - These frames describe every unit of a type, and the roster already skipped them.
   - Brynhurst drops from 51 to **36 instances**: 8 roster-backed, 25 unit load centres, and 3 anchored "Solar"
     roof labels for Phase 17 to judge.
3. **The flaky e2e is fixed.** "Saved drawing REPROCESS queues visibly…" now records every state the button
   shows, instead of polling for a QUEUED that can last milliseconds.
   - The full browser suite passes 148 of 148, and the Brynhurst e2e passes.
   - All 95 Node QA scripts and typecheck pass.

## Order and expected result

| Wave | Phases | Why this order |
|---|---|---|
| 1 | 17, 23.1, 18, 20a step 1 | Measure first. Fix the dead-end links now. Layers make every later step cheaper. OCR step 1 needs no new dependency. |
| 2 | 20, 20a steps 2–5, 19 | Labels, schedules and the roster are quick wins (panels appear). Symbols bring the devices. |
| 3 | 21, 22, 23.2–23.5 | Place, size and lift what is now detected, and let people correct it. |
| 4 | 24 | Prove it generalises. |

**Targets on E-4 (scored by Phase 17, set before work starts):** distribution equipment (switchboards and
panels) recall ≥ 95%; devices and fixtures recall ≥ 80% at ≥ 90% precision; every placed item has a library
model, a source-backed Z rule and a working review action.

## Decisions needed

1. **AI vision assist.** Recommended, but only as a **checked reader of pixels**: raster schedules, labels
   drawn as strokes, scanned sheets, and choosing a symbol class from a closed list. It never sets geometry,
   never fills blanks and never confirms anything. Customer drawings would leave the browser, so the owner must
   approve that. Full assessment below.
2. **Standard mounting defaults** (switch 48", fixtures at ceiling) when the drawing is silent. Recommended,
   labelled as "standard default" so they are never mistaken for drawing evidence.
3. **Apply the scale to all same-scale sheets in one confirm.** Recommended.
4. **Ask the client for the DWG.** Recommended. It is the highest-fidelity input available.

### Decision 1 in detail — AI vision assist (assessed 2026-10-29)

**Why a reader of pixels is needed at all.** Much of what is missing is not in the PDF as text, so no amount of
text rules can find it:

- **E-2:** pdf.js returns **33 text items**, mostly the title block. The top half is about ten pasted raster
  images: the HL, HP1, HP2, HP3 and HWH panel schedules, the MS1/MS2 load calculations and the LADWP notes.
  The one-line in the bottom half is vector (about 8,500 path operations), but its labels (`414 D 71A 155'`,
  `HP1 52A`, `30HP ELEV.`) are **drawn as strokes**, not stored as text.
- The worker queues a page for OCR only when it has **fewer than 3 text items**
  (`workers/pdf-native-parser.worker-v2.ts:70`), so E-2 is never OCR'd.
- E-7 to E-9 are scans.

Reading these needs OCR or a vision model either way. The rest of this plan (layers, phrases, roster, symbol
matching) is deterministic and does not need AI.

**The reader is not the risk; skipping verification is.** Tesseract.js, already a dependency, run on E-2 at
200 dpi read `MS1 = 574 AMPS` (the drawing says 374), read `PANEL HPL` for HP1, and mixed columns from
neighbouring schedules (mean confidence 62). The non-AI path already invents values. Every reader, AI or not,
must pass the same checks.

**The drawings carry their own checks.** The HP1 schedule, read from a 300 dpi crop:

| Check | Result |
|---|---|
| Line 1 circuit loads summed | 6,100 = printed subtotal |
| Line 2 circuit loads summed | 4,720 = printed subtotal |
| 10,820 VA ÷ 208 V | 52 A = printed total |
| One-line on the same sheet | `HP1 52A` |
| Service MS1 table | `PANEL HP1 6100 4720` |
| Total load box | MS1 374 + MS2 640 = 1,014 A |

One wrong digit fails at least two checks. Tesseract's 574 fails the last one. This was one crop read by one
model, not a benchmark. Whole sheets must be **tiled**: models shrink large images and small print becomes
unreadable.

**What AI does, and how each job is checked**

| AI reads or proposes | Where | Checked by |
|---|---|---|
| Raster schedules and load calcs → rows | E-2 top half, E-7 to E-9 | Column sums, printed totals, VA → amps, the same value on other sheets |
| Labels drawn as strokes | E-2 one-line, plan sheets | Box must sit on ink on the `ETEXT` layer; a second reader agrees on every digit; value matches the schedules or roster |
| Legend rows (symbol → description → mounting note) | E-1 | A person confirms once per project |
| Ambiguous symbol: pick a legend class or "none" | Plan sheets | Only for clusters the geometric matcher already found; answer comes from a closed list |

**What AI never does**

- Position, scale, rotation, size or Z. The vectors and `lib/scale-validation.ts` do this exactly.
- Electrical connections that are not traced in the vectors (`lib/sld-vector-topology.ts`).
- Fill blank cells or apply defaults.
- Mark anything confirmed. A person does.
- Anything the client's DWG provides directly (Decision 4).

**Rules that stop invention**

1. **Point to the source.** Every value comes with the box on the sheet it was read from. No box, no value.
2. **Closed lists.** Classes come from the legend and the component library. Tags must appear on the sheet or
   in the project roster.
3. **"Illegible" is a valid answer, and blanks stay blank.** A real trap on HP1: a 2-pole breaker is written
   once across two rows with a diagonal (circuits 7/9, 13/15). A model will tend to write 20 A on both rows,
   so the schema must model a breaker that spans rows.
4. **Two readers must agree on every digit** (the AI and Tesseract on the same crop, or two passes).
   Disagreement goes to the review queue.
5. **Only values that pass the sums and cross-sheet checks are accepted automatically.** They are tagged
   `AI_VISION_READ_VERIFIED`; the rest are `AI_VISION_READ_UNVERIFIED`. Both stay review candidates
   (`physicalTruth:false`), as with `ocrAuthority:'REVIEW_ONLY'` today.
6. **Keep every raw response**, keyed by source SHA-256, page, crop and model version, so any result can be
   replayed and audited.
7. **Measure before shipping** against the Phase 17 fixture (see below).

**Model and data**

- One provider-agnostic reader behind a server route under `app/api/`. The API key never reaches the browser.
- Choose the model by its score on the Phase 17 fixture, not by brand. Test Gemini and at least one other model.
- Today all parsing runs in the browser. This sends customer drawings to an outside provider, so it needs
  per-project opt-in and contract terms that rule out training on or keeping the data. Offline field use falls
  back to the deterministic parser.

**Where it fits in the waves**

- **Phase 17:** the answer key must include E-2's schedule cells, not only E-4's items, so reader precision can
  be measured.
- **Phase 20:** first fix the OCR trigger so raster image regions are read even when the page has some text.
  Then add the AI reader for raster schedules. This is the biggest win: it produces the clean panel roster that
  `docs/SPATIAL_RENDER_ACCURACY_REPORT.md` §4 #4 found blocking.
- **Phase 19:** stroked labels and ambiguous symbols come after that.
- **Release gate:** no unchecked value is ever accepted automatically, and per-field precision on the fixture
  meets a target set before work starts.

## Truth boundary (unchanged)

Detected items, labels, sizes and Z are review candidates with recorded authority. Nothing is deleted. Roles
stay reversible. Nothing becomes metric or physical truth without evidence and a person confirming it.
