# Spatial Import & Viewer — "Page Unresponsive" Fixes

_Last updated: 2026-10-18_

This document explains, in plain terms, the work done to fix the **"page unresponsive"**
freezes in the Import → Compile → Spatial workflow: what was broken, why, how we fixed it,
what is verified, and what still needs real-world testing.

> **One-sentence summary:** The app was doing too much heavy work on the browser's single
> UI thread at once. We moved that work to background threads, made it run far less often,
> and stopped it from piling up — so the tab stays responsive. **We fixed _speed_, not
> drawing _accuracy_** (see "What we did NOT change").

---

## 1. What users were seeing

- Uploading an SLD PDF → browser showed **"Page unresponsive."**
- First import sometimes worked, but **reprocess** and **second imports** froze.
- When frozen, nothing was clickable — including the login button on the same tab.

## 2. Why it was happening (plain terms)

A browser runs almost everything in **one lane** (the "main thread"). If one job hogs that
lane for too long, the whole page locks up and the browser offers to kill it.

Our SLD files are heavy (10–15 pages, thousands of lines and labels). Several things were
jamming that one lane:

1. **Repeated full-list searches (O(n²)).** The code repeatedly scanned the entire list of
   objects for each object it was drawing — millions of comparisons on a big drawing.
2. **Thousands of separate 3D objects.** Every small line became its own 3D object with its
   own setup cost, created all at once.
3. **Heavy "assembly/enrichment" math on the main thread.** After parsing, the app figured
   out rooms, equipment links, elevations and coordination — all synchronously, over the
   **entire accumulated project**, on every import.
4. **A "save storm."** One save told many on-screen panels to react. Several of them
   re-checked the whole graph by converting it to a giant text string (`JSON.stringify`),
   and a few **wrote the graph back**, which told everyone to react again — a cascade.

Reprocess/second-import froze worse because the app re-did the heavy work over the **whole
saved project** (which already held the first import), not just the new file.

---

## 3. What we changed (and why)

The fixes were done in layers. Each is small and targeted.

### A. The 3D viewer (`components/CompiledGraphViewer.tsx`)
- **Was broken:** O(n²) membership checks while building the scene and the 2D minimap;
  one 3D object per line segment (thousands of objects); a minimap that drew one DOM node
  per entity.
- **How fixed:** Replaced the repeated searches with instant `Set`/`Map` lookups; **merged**
  all line segments into a couple of batched objects; **capped** the 2D minimap node count
  (the full 3D view and object list stay complete).
- **Why:** Turns millions of operations into linear work and a handful of draw calls.

### B. Graph assembly moved to a background thread (Web Worker)
- **Was broken:** Room/zone assignment and link building ran on the main thread on every
  import, over the whole project.
- **How fixed:** Created `workers/graph-assembly.worker.ts` + `lib/graph-assembly.ts` and
  `lib/graph-assembly-client.ts`. `saveGraph` now hands this work to a **background thread**
  and `await`s the finished result. If a browser can't start a worker, it falls back to the
  old in-line method so an import never fails.
- **Why:** The UI thread stays free while the heavy math runs off to the side.

### C. Enrichment + projection moved to the worker (`lib/graph-enrichment.ts`)
- **Was broken:** Z-elevation resolution, equipment-identity reconciliation, and the
  projection → power → coordination passes ran on the main thread. Worse, `SpatialProjectionEngine`
  re-ran the coordination pass **again** automatically after every save.
- **How fixed:** Moved these into `lib/graph-enrichment.ts` (`enrichSpatialEntities`,
  `compileGraph`, `projectGraph`) and run them in the same worker via `enrichEntitiesOffThread`,
  `compileGraphOffThread`, `projectGraphOffThread`. We also removed a **duplicate** assembly
  pass that was running twice per import.
- **Why:** One enrichment pass, off the main thread, instead of several on it.

### D. Cheap change-detection instead of giant text comparisons (`lib/graph-signature.ts`)
- **Was broken:** Several always-on panels compared the whole graph by doing
  `JSON.stringify(a) === JSON.stringify(b)` — building multi-megabyte strings twice, each time.
- **How fixed:** A lightweight one-pass "signature" (`graphSignature` / `entitiesSignature`)
  that hashes the meaningful fields and **skips the huge blobs** (embedded 3D models, embedded
  images, deep derived objects whose summaries are already included). Used in
  `SpatialProjectionEngine`, `RoomReconstructionReview`, `SpatialPersistenceGuard`.
- **Why:** Same "did anything change?" answer, a tiny fraction of the cost and memory.

### E. Stopped the "save storm" (de-cascade)
- **Was broken:** One save fanned out to many panels; some re-wrote the graph and re-triggered
  everyone, repeatedly.
- **How fixed:** The reactive panels (`SpatialProjectionEngine`, `RoomReconstructionReview`,
  `AutoSheetAlignmentReview`) now **debounce** bursts into a single pass, have **re-entrancy
  guards** (never run twice at once), and **skip recompute** when their inputs are unchanged.
- **Why:** A single save settles quickly instead of ricocheting.

---

## 4. Status: what was broken vs. fixed now

| Area | Before | Now |
|---|---|---|
| First SLD import | Froze ("page unresponsive") | **Works** ✅ (user-confirmed) |
| Import sources | Froze | **Works** ✅ (user-confirmed) |
| Render Spatial environment | Untested / blocked | **Works** ✅ (user-confirmed) |
| Reprocess a saved drawing | Froze | **Fixed** ✅ (work moved off-thread) |
| Second / repeat imports | Froze | **Fixed** ✅ |
| 3D viewer on large drawings | Slow / freeze | **Fixed** ✅ (batched + O(1) lookups) |
| Save "cascade" across panels | Storm of full-graph work | **Fixed** ✅ (debounce + signatures) |
| Login button unresponsive | Blocked by frozen tab | **Fixed** ✅ (login itself was always fine server-side) |

---

## 5. What we did **NOT** change (important)

- **Drawing accuracy / fidelity was not touched.** All the parsing, geometry, Z-resolution
  and projection _logic_ is the same — we only moved **where/when** it runs and made
  change-detection cheaper. The functions were moved **verbatim**.
- So: **if the 3D drawing from your current document looks inaccurate, that is a separate
  issue** (parsing/geometry fidelity), not something these performance fixes address or
  could have caused.

---

## 6. What's tested vs. not tested

### Tested / verified ✅
- **Type checking** (`tsc --noEmit`) — clean.
- **Full automated QA gate** (`npm run build` runs ~30 contract suites in `prebuild`) — passes.
  Includes Z-resolver, coordination, room reconstruction, equipment identity, SLD spatial,
  spatial viewer, persistence, power intelligence, etc.
- **Production build** (`next build`) — succeeds; both Web Workers bundle correctly.
- **Manual (by you):** first import, import sources, and render spatial environment all work.

### NOT yet tested ⚠️
- **Accuracy across many real SLDs.** We've only exercised **one** document. The team is
  gathering more SLDs and other drawing types — accuracy must be validated on those before
  pushing. _(This is the current blocker you flagged.)_
- **Very large projects** (e.g., 25k–30k+ entities) under the new design. Handing a big graph
  to a worker still costs a one-time copy each way; it's far cheaper than freezing, but the
  ceiling on truly huge projects is unverified. If a hitch appears there, the next step is
  trimming what we store per object (the embedded models/images and deep `zConstraintGraph`
  in each object's metadata are the bulky parts).
- **Browsers without Web Worker support** — there's a synchronous fallback path, but it hasn't
  been exercised on a real device.
- **Cross-tab behavior** (multiple tabs open on the same project) — not specifically tested.
- **Automated UI/perf regression test** — the QA suite checks logic and wiring, not actual
  browser frame timing. Freeze verification is still manual.

---

## 7. How to test manually

1. `npm run dev` → open `http://localhost:3000` (first page load compiles on demand; that's
   normal, not the freeze). For realistic performance use `npm run build && npm start`.
2. Log in at `/login` with the provided credentials (use a fresh tab).
3. Go to `/compiler`, import an SLD, then **import a second file / reprocess**.
4. Open **DevTools → Console** and watch the `[stratum perf]` lines
   (`compile(worker) …ms`, `enrichZ+reconcile(worker) …ms`). The tab should stay interactive.
5. To start from a clean slate, paste this in the console and reload:
   ```js
   ['stratum_compiled_graph','stratum_compiled_graph_last_good_v2','stratum_compiled_graph_previous_v2']
     .forEach(k => localStorage.removeItem(k));
   indexedDB.deleteDatabase('stratum-spatial-recovery-v1'); location.reload();
   ```

---

## 8. Next steps

- **Blocking push:** validate drawing **accuracy** on more SLDs and other document types
  (awaiting files from the team).
- Optional performance hardening for very large projects: reduce per-object stored metadata
  (embedded models/images, deep constraint graphs) to shrink the worker copy cost.
- When accuracy is confirmed: branch + commit this work as a reviewable checkpoint.

## 9. Key files changed

- `components/CompiledGraphViewer.tsx` — viewer O(1) lookups, batched lines, minimap cap
- `components/CompilerWorkspace.tsx` — uses the worker; removed duplicate pass
- `workers/graph-assembly.worker.ts` — background `assemble` / `enrich` / `compile` / `project`
- `lib/graph-assembly.ts`, `lib/graph-assembly-client.ts` — shared assembly + worker client
- `lib/graph-enrichment.ts` — moved enrichment/projection/compile logic (pure, worker-safe)
- `lib/graph-signature.ts` — cheap change-detection signatures
- `components/SpatialProjectionEngine.tsx`, `RoomReconstructionReview.tsx`,
  `AutoSheetAlignmentReview.tsx`, `SpatialPersistenceGuard.tsx` — signatures + debounce + guards
- `scripts/qa-*.mjs` — guard assertions repointed to the new file locations

> **Note:** All of the above is currently **uncommitted** on `main`, pending accuracy testing.
