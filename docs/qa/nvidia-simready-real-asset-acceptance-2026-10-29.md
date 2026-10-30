# NVIDIA SimReady real-asset acceptance — 29 Oct 2026 PT

## Verdict: **FAIL / BLOCKED** — no release from PR #243

This is a real deployed-production browser test, **not** only a unit test of a synthetic cube.

**Prior production run under test:** `https://stratumspatialverified.vercel.app/compiler`; the test operated signed out and altered browser-local state only. This was the 2026-10-29 pre-fix baseline; the current main branch has advanced.

**Source:** NVIDIA SimReady Assets (CC BY 4.0),
https://huggingface.co/datasets/nvidia/simready-assets
Dataset pinned commit `4763fbfaa4f8e97658e68b57d01b4c86659e08b5`.
Selected asset `tool_hammer_a03`. Root layer
`tool_hammer_a03/simready_usd/sm_tool_hammer_a03_01.usd`,
original root SHA-256 `6c3ac1aa7565f54185c3f547cc61d9681975b5fd57d1aea022984b842bd498fe`.

### Test input and provenance

- NVIDIA package: 46 files including root, thumbnails and metadata, about 41.21 MB.
- Original render-package contents: 24 files, 36,007,598 bytes, 14 payloads (USD/USDA geometry and physics layer references), 6 texture files.
- Bounded **automated CI-only** ZIP_STORED USDZ archive of original layers (no GLB conversion): 36,011,482 bytes.
- Root is binary USDC despite the `.usd` extension. Its full composition and `metersPerUnit` cannot be inferred by regex-inspecting its bytes. Do **not** mark metric scale as verified.
- The downloaded source, textures and source provenance were retained intact in the CI fixture; original production browser upload was SHA-fingerprinted and archived.

### Observed production failure

The production Compiler accepted `.usdz` and archived its source but failed during the native Three.js USD parser:

```
Cannot set properties of undefined (setting 'custom bool pbr_needs_sync')
```

Layer-level diagnosis found the relevant authored metadata at
`tool_hammer_a03/simready_usd/payloads/materials.usda`, near
`custom bool pbr_needs_sync = 1`. This points to a limitation in the current
Three.js r183 USDA parser/composition for a real NVIDIA material layer.

The failure was visible to the user as **Import finished with 1 review exception**,
and no false Spatial instance was created. The source stayed locally archived.

### Acceptance matrix

| Criterion | Evidence/status |
|---|---|
| Reproducibly discover real licensed NVIDIA asset | **PASS** — pinned package, counted files and textures |
| Download and preserve original USD/payload/texture data | **PASS** — CI fixture/manifest; no source edits |
| Browser archive retains upload after parser failure | **PASS** — source archived locally |
| Native standalone USDA sample in prior PR #242 | **PASS** — synthetic cube only; not evidence of SimReady |
| Native layered USDZ parse | **FAIL** — `materials.usda` custom metadata parser exception |
| Actual rendered geometry and clickable selection | **BLOCKED** — no Spatial instance created |
| Applied PBR/MDL texture maps | **BLOCKED** — rendering never reached material evaluation; files present is insufficient |
| Nested references and variant composition | **BLOCKED** — full dependency graph not parsed |
| Reload and Spatial source/model persistence | **PARTIAL** — source retained, model not created |
| Stage meters-per-unit and geometry-scale fidelity | **UNVERIFIED** — root binary metadata requires real parsing; don't default to nominal dimensions |
| Physical installation/asset truth | **UNRESOLVED** — review only; not a field verification |
| Production deployment | **UNCHANGED** — this test does not merge or deploy anything |

### Engineering priorities

1. Repair or replace the limited browser OpenUSD parser for layered SimReady/MDL materials, with explicit compatibility reporting. Do not hide errors by fabricating a simple primitive.
2. Preserve original raw USD and all referenced layers and textures, and distinguish browser render derivatives from the authoritative source.
3. Verify stage units and axis against original USD metadata; do not silently normalize real scenes to STRATUM nominal equipment dimensions.
4. Verify model mesh/texture counts, visual screenshot, selection and persistence after import. Add an independent negative fixture with missing referenced payload.
5. Re-run the real-asset production test and a second relevant industrial asset (e.g., `rack_long_empty_a01`), followed by desktop/tablet/mobile UAT. Only then permit merge of the compatibility change.

**Do not merge PR #243 while this acceptance test is red.** The user’s existing production v1 native-USD support remains intact for supported standalone inputs. The test demonstrates a *specific unhandled advanced asset*, not loss of all USD capability.
