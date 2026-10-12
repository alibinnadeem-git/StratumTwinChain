# Human Developer Handoff Brief — Parametric Component Generators
**For:** Ujjan (AI-assisted workflow welcome)
**From:** Ali Bin Nadeem, via Jarvis
**Date:** 2026-10-09
**How to use this document:** paste it into your AI tools as project context. It is self-contained — everything you need to deliver is in here.

---

## 1. The situation (60 seconds)

STRATUM Spatial Verified is an existing, live platform (repo `alibinnadeem-git/StratumTwinChain`, production on Vercel). It ingests construction drawing sets (PDF) and builds interactive 3D digital twins where every asset is clickable and carries a digital record. Main focus: **electrical contracting**.

A 32-agent team (orchestrated by "Jarvis"/A00) is executing a 48-hour mission on the existing codebase. You are the human in the mix. Your lane is deliberately chosen: work the agents are weak at, with a clean integration seam so your output drops in by copy-paste.

## 2. Your work package: parametric generator — enclosure family

**What:** a Python generator that produces 3D enclosure models (panelboards, switchgear line-ups, MCC buckets, disconnect enclosures) as GLB files, parameterized by dimensions and configuration.

**Why you:** this needs 3D judgment + engineering sense (proportions, mounting, door swings, realistic detail level). Agents produce plausible-looking but wrong geometry here. You won't.

**Why this package:** the component library needs ~62 electrical components, most built in-house (CC0 libraries don't cover switchgear). One enclosure generator covers E-02 through E-07, E-11, E-12 and variants — the highest-value family. Output is files, not framework: copy-paste integrable.

### Input: parameters (you define the schema; example shape)
```json
{
  "family": "enclosure",
  "variant": "panelboard",
  "width_m": 0.6, "height_m": 1.8, "depth_m": 0.25,
  "doors": 1, "mounting": "wall",
  "finish": "ansi-61-grey",
  "detail": "standard"
}
```

### Output (per component)
1. `E-06_panelboard_600x1800.glb` — the model
2. `E-06_panelboard_600x1800.meta.json` — registration metadata (schema in §4)
3. A gate report (see §3)

### Priority order (do them in this order; stop anywhere and hand off)
1. Enclosures (panelboards, switchgear, MCC, disconnects) ← start here
2. Boxes (junction/pull boxes, conduit bodies)
3. Luminaires (troffer, downlight, wall pack — simple geometry, high count)
4. Wiring devices (receptacles, switches — small, standardized)
5. Tray and fittings (segments + elbows/tees — parametric along a path)

## 3. Acceptance: the Intake Gate (your definition of done)

Every model you deliver must pass all 7 checks. The verifier tool is included in this pack (`intake_gate.py` — run it yourself before handing off):

```
python intake_gate.py YOUR_MODEL.glb --meta YOUR_MODEL.meta.json --equipment
```

The 7 checks:
1. **Licence** — tier recorded: T1 (CC0/in-house, ships by default), T2 (OEM-permitted, needs permission file ref), T3 (link-out only, never shipped). Your generators produce T1.
2. **Valid GLB** — glTF 2.0, parses cleanly.
3. **Normalized** — real-world metres, +Y up, origin at the host contact (floor for floor-standing, wall face for wall-mounted), front along +Z. Bounding-box diagonal must be plausible (0.1 mm – 1000 m).
4. **Anchored** — named empty nodes for connections: at minimum `mount_face`; add `power_in`, `conduit_entry`, `ground_lug` where the component has them.
5. **Optimized** — ≤ 50,000 triangles for equipment, ≤ 5,000 for small devices. Compressed (meshopt/Draco) preferred.
6. **Validated** — zero errors from the Khronos glTF-Validator.
7. **Registered** — `extras` carries: type_id (e.g. "E-06"), ifc_class, source ("in-house-parametric"), licence_tier, sha256 (of the file), bounding_dimensions, scale_rule.

**Your handoff is done when:** generator script + sample outputs + a gate report showing 7/7 pass on every delivered model.

## 4. Integration contract (the copy-paste seam)

**Design goal: integration is one unzip. No path translation, no code changes, no merging.**

- **Delivery format:** a zip file whose internal paths mirror the repo's library paths exactly. A10 unzips it into the repo root and the files land where they belong:
  ```
  stratum-48h-delivery-v1.zip
  └── assets/library/models/E-06/panelboard_600x1800.glb
  └── assets/library/models/E-06/panelboard_600x1800.meta.json
  └── assets/library/models/manifest.json
  └── tools/generators/enclosure_family.py
  └── gate-reports/enclosure_family.json
  ```
- **manifest.json** (at `assets/library/models/manifest.json`) — one entry per model, so ingest is a single loop with no directory guessing:
  ```json
  {
    "delivery": "v1",
    "models": [
      {"type_id": "E-06", "path": "assets/library/models/E-06/panelboard_600x1800.glb",
       "sha256": "<hex>", "licence_tier": "T1", "gate": "7/7 pass"}
    ]
  }
  ```
- **Re-delivery rule:** every delivery is complete and self-contained (v1, v2, …). Integration is always overwrite, never merge. If a model changes, ship the whole tree again with a new version.
- **Naming:** `models/<TYPE_ID>/<variant>.glb` + matching `.meta.json`. TYPE_IDs come from the taxonomy: E-01…E-62, A-01…A-14, M-01…M-12, P-01…P-06, FP-01…FP-06.
- **meta.json schema:**
  ```json
  {
    "type_id": "E-06",
    "licence_tier": "T1",
    "permission_ref": null,
    "expected_anchors": ["mount_face", "power_in", "conduit_entry"],
    "declared_up": "+Y",
    "declared_origin": "wall face",
    "declared_front": "+Z",
    "generator": "enclosure_family.py v0.1",
    "params": { "...": "..." }
  }
  ```
- **How it lands:** A10 (Component Intelligence agent) unzips, reads `manifest.json`, re-runs the Intake Gate on every model as an independent check, and registers the passes. Your generator script goes under `tools/generators/` for reproducibility. Nothing else moves.
- **Stack:** Python, any libs you like for authoring (trimesh, pygltflib, Blender scripting — your call). Deliverable is the GLB + script; keep dependencies documented.

## 5. Hard rules (non-negotiable)

1. **No OEM geometry, ever.** Do not trace, convert, or re-mesh manufacturer CAD/BIM into your models. In-house models may follow manufacturer-*published dimensions* (from datasheets) — dimensions are facts, geometry is theirs.
2. **Licence default is T1.** If you ever need an OEM model with permission, that permission is a separate conversation — don't go get it yourself.
3. **No guessed dimensions.** Every dimension comes from a datasheet or an explicit parameter. If a dimension is unknown, expose it as a parameter with a stated default and document the source.
4. **Z-up, metres, right-handed** for the canonical frame; the GLB itself is +Y up per glTF convention (the viewer converts once at its root).
5. **Don't touch:** PRs #205, #209, #206, #21 (frozen — paused work lines). The PASS/Impact Intelligence track (also paused). Anything already assigned to agents — if you're unsure, ask before starting.

## 6. Working agreement

- **AI-assisted is fine** — use your tools however you work best. This brief is written to be pasted into them.
- **Coordinate through Ali.** The agent team is orchestrated by A00; you don't need to talk to agents directly. Hand your work to Ali; A10 integrates it.
- **Hand back format:** the file tree in §4 + a one-page note: what you built, what you didn't, any judgment calls, what's next.
- **Cadence:** this is a 48-hour mission (Oct 9–11). Even a partial family delivered inside the window is a win — the enclosure family alone unblocks the electrical core.

## 7. Definition of done (your package)

- [ ] Generator script produces the enclosure family across its parameter range
- [ ] Every delivered GLB passes 7/7 Intake Gate checks (attach the gate report)
- [ ] meta.json present and correct for every model
- [ ] manifest.json lists every model with sha256 and gate result
- [ ] Delivered as a versioned zip with repo-mirrored paths (v1, v2, …)
- [ ] One-page handoff note written
- [ ] Nothing in §5 violated

---

*Alternate packages if Ali reassigns you: (B) UNRESOLVED review-queue UI — standalone page rendering asset-record JSON with detection crops, candidates, reason codes, approve/reject actions; (C) closeout booklet generator — asset records JSON → PDF submittal booklet. Both are equally copy-paste integrable. Ask Ali which lane before starting.*
