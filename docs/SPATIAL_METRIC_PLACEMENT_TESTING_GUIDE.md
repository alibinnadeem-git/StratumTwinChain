# Testing the Spatial metric placement changes

How to check, by hand, the changes in `docs/SPATIAL_METRIC_PLACEMENT_PLAN.md` (phases 10–15) on the Brynhurst
drawing set. Every step and expected value below was walked through on a local dev server on 2026-10-27.

## Before you start

The **Apply drawing scale** button only appears when all of these are true. Most "I can't find it" cases
are one of them.

1. **You are running this branch's code locally.** The changes are on `ujjan-v2` and are not deployed, so a
   hosted site will not have them. Run `npm run dev` and open the address it prints (normally
   `http://localhost:3000`; if that port is busy, Next.js picks another one and prints it).
2. **You open it as `localhost`, not `127.0.0.1`.** The dev server blocks its scripts for `127.0.0.1`, so the
   page never becomes interactive (for example, **Render Spatial Environment** stays greyed out).
3. **The drawing was parsed by the current code.** Scale evidence and equipment roles are worked out when a
   PDF is parsed. If this browser imported the file with older code, see
   [If you imported this file before](#if-you-imported-this-file-before); refreshing takes about 30 seconds.
   For a clean test, a private/incognito window is simplest.
4. **You are signed out, for a clean test.** A signed-in session can restore an older import of the project
   from the server.
5. **You have the PDF:** `tests/fixtures/spatial/5749 Brynhurst - Electrical - Bid Set 2025.04.17.pdf`. It is
   customer data, so it is gitignored; ask for a copy if you don't have it.

## Steps

1. **Import.** In the left menu, click **Import** (page title "Add project sources."). Drop the PDF on
   **Drag files here or choose files**. Parsing takes about a minute; the file then appears in the list under
   the drop area.
2. **Open Spatial.** Click **Render Spatial Environment** once it turns green. You land on the Spatial page
   with the **Model** tab selected.
3. **Pick the sheet (Phase 13).** Since main's 2026-10-29 update the viewer opens on **Entire project** (every
   sheet laid out side by side). In the sheet dropdown in the filter row, choose **Auto-safe sheet isolation**: it
   opens on the first floor plan (E-4), not the one-line diagram. Two switchboard icons sit in the electrical
   room, near the right of the plan. The drawing-scale notice in the next step belongs to a single sheet, so it
   only appears once a sheet is isolated.
4. **Find the button (Phase 12).** Above the **Model / Electrical / Review** tabs there are two notices:
   - **NOMINAL LIBRARY SIZE · NOT CALIBRATED TO SHEET SCALE** — "16 identified equipment instances…" (since
     Phase 20: MS1, MS2, HL, HP1, HP3 and 11 unit load centres; before Phase 20 it said 2).
   - **DRAWING SCALE AVAILABLE · NOT APPLIED** — "This sheet's printed scale is 5.121 m per sheet unit; this
     sheet has no dimensions of its own; 14 dimensions on page 3 of the same set confirm the same printed
     scale…". The green **Apply drawing scale** button is at the right end of this notice.
5. **Note the distance before applying.** In the right-hand panel, open the **Imported object** dropdown
   and choose **MS1 · L1**. Expand **Placement & source confidence** and read **Plan X / Y**. Do the same
   for **MS2 · L1**. (The list can show each name twice: the instance and its review copy share a position,
   so either works.)
6. **Apply.** Click **Apply drawing scale**. The button shows **Applying…** with the note "this waits for
   background processing to finish". On the dev server right after an import this can take about a minute;
   a production build is faster.
7. **Check the result.** The notice changes to **DRAWING SCALE APPLIED · REVIEWED** with an **Undo drawing
   scale** button, and the first notice changes to **SIZED FROM DRAWN SYMBOLS · DRAWING SCALE APPLIED** (Phase
   21: recognised equipment takes its plan size from its drawn symbol; MS1 becomes the 102" × 20" lineup).
   Before Phase 21 it read **NOMINAL LIBRARY SIZE · DRAWING SCALE APPLIED**. The plan
   is now about 5× larger; click **Fit model** if it is out of frame. Re-read MS1 and MS2 as in step 5.
8. **Undo.** Click **Undo drawing scale**. Positions return to the step 5 values.

### Expected values

| | MS1 Plan X / Y | MS2 Plan X / Y | MS1↔MS2 |
|---|---|---|---|
| Before **Apply drawing scale** | 2.35 / -1.30 | 1.76 / -0.91 | 0.71 (sheet units) |
| After | 12.04 / -6.63 | 9.00 / -4.67 | **3.62 m** |

Distance = √(ΔX² + ΔY²). The real distance on the E-4 plan is about 3.6 m between the two switchboard labels.

## Other things to check

| Phase | Where | Expected |
|---|---|---|
| 13, one-line note | Sheet dropdown → the `p2 · Sld` option | The first notice starts "One-line diagram: positions show drawing layout, not real distances." No **Apply drawing scale** (a one-line has no scale). |
| 14, phantom switchboard | E-4 view | Two switchboards drawn, not three. "MS1 #1" is still in **Imported object**, but it is a label and is not drawn. |
| 15, 6-ft lift | Select **MS1 · L1** on E-4 | MS1 sits on the floor; there is no **Support base offset** row under **Placement & source confidence**. |
| 11, scale check | Sheet dropdown → `p3 · SITE PLAN` | **DRAWING SCALE AVAILABLE** confirmed by 14 dimensions on this sheet. |
| 12, other sheets | `p5` and `p6` floor and roof plans | Same as E-4: the scale is offered, confirmed by page 3. |
| 12, no printed scale | `p7`–`p9` unit plans | No **Apply drawing scale** (these sheets print no scale). |
| 12, Import-page panel | **Import** page → expand **Review exceptions** (below the import area) → panel "Put reviewed PDF X/Y into the same meter world as Z" | **4 ELIGIBLE**: pages 3–6; pages 4–6 explain they borrow page 3's corroboration. **Apply reviewed metric frame** there does the same thing as the Spatial button. |

## If you imported this file before

Every PDF parse now records the parser revision that produced it (`PDF_PARSE_REVISION` in
`lib/spatial-source-reprocess.ts`). A drawing parsed by older code is flagged instead of kept silently:

- The **Import** page shows **REPROCESS SAVED DRAWING** ("1 saved drawing source needs re-parsing with the
  current drawing parser"), and the file's row shows **REPROCESS** (or **REUPLOAD** if this browser kept no
  local copy of the file).
- **Spatial** shows a collapsed **Older drawing parse · 1 source can be refreshed** section with the reason.

To refresh, click **Reprocess archived drawing** on the Import page, or upload the same PDF again (that now
re-parses it instead of skipping it as a duplicate). Checked on 2026-10-27 with a browser that imported
Brynhurst on the code before these changes:

| | Before refresh | After refresh (about 30 s, either way) |
|---|---|---|
| Parser revision on the source | none | `2026-10-27.metric-placement` |
| Equipment instances | 7, "MS1 #1" drawn as equipment | 6, "MS1 #1" is a label |
| E-3 scale check | MISMATCH, 0.826 | CORROBORATED, 5.121 |
| **Apply drawing scale** on E-4 | not offered | offered |

## If something doesn't match

| You see | Likely cause | Fix |
|---|---|---|
| No **Apply drawing scale** anywhere | The drawing was parsed by older code, or you're on a deployed site | Look for **REPROCESS SAVED DRAWING** on the Import page and refresh the drawing; otherwise use your local `npm run dev` |
| **SCALE MISMATCH** on page 3, or three switchboards on E-4 | The file was parsed by older code | Click **Reprocess archived drawing**, or upload the same file again |
| **REPROCESS SAVED DRAWING** keeps coming back | The re-parse failed, so the previous result was kept | Read the error on the Import page; a private window with a fresh import rules out old browser data |
| Spatial opens on the one-line diagram | Old code running, or the **Electrical** tab is selected (it shows the one-line on purpose) | Restart `npm run dev`, hard-reload, and use the **Model** tab |
| The button is there but you're on another sheet | The notice belongs to the sheet that is showing | Pick a sheet with a printed scale (p3–p6) |
| **Render Spatial Environment** never turns green | Opened as `127.0.0.1` on the dev server | Use `localhost` |
| "Applying…" for a long time | It waits for background processing after an import | Wait; on dev, about a minute |
| Plan out of view after applying | The sheet is about 5× larger | Click **Fit model** |

## Automated checks

- Fast Node checks: `npm run qa:scale-validation`, `qa:metric-frame`, `qa:candidate-gating`,
  `qa:support-base-offset`, `qa:sheet-frame-choice`, `qa:sheet-scale`, `qa:spatial-parse-audit`,
  `qa:brynhurst-golden`, and `npm run typecheck`.
- Full pipeline on the real file (walks steps 1–8 including apply and undo):
  `STRATUM_DIST_DIR=.next-prod-baseline npx next build`, then
  `STRATUM_DIST_DIR=.next-prod-baseline npx next start -p 3100`, then
  `STRATUM_UAT_BASE_URL=http://127.0.0.1:3100 STRATUM_BRYNHURST_E2E=1 npx playwright test spatial-diagnostics --project=desktop-chromium`.
  The build rewrites `next-env.d.ts` and `tsconfig.json`; restore them with
  `git checkout -- next-env.d.ts tsconfig.json`. `npx next build` skips npm's prebuild step, so in a fresh
  checkout run `node scripts/prepare-pdf-assets.mjs` first, or every import fails with "Setting up fake
  worker failed" (`npm run dev` does this for you).
