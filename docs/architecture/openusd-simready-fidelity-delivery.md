# STRATUM Spatial Verified — OpenUSD/SimReady full-composition delivery contract

Issue: [#246](https://github.com/alibinnadeem-git/StratumTwinChain/issues/246) · Initial investigation: PR #243 (draft, superseded) · Released geometry-only baseline: PR #245

## Provenance and truth boundaries

A source USD stage can include authored geometry dimensions, coordinate transforms, `metersPerUnit`, `upAxis`, material bindings, shader networks, variants, and rigid-body physics attributes. **It cannot independently verify the location/height/identity of equipment installed at a construction site**. STRATUM must keep those independent.

Do not silently apply unverified scale factors or source model Z to the project twin. Separate:

- `SOURCE_AUTHORED_UNITS`: explicitly authored stage metadata + source hash and audit evidence.
- `MODEL_TRANSFORM_COMPOSED`: hierarchy and stage up axis proven for the rendered model, not the project.
- `PROJECT_ALIGNMENT_UNRESOLVED`: site placement/registration/Z still requires independent reviewed evidence.
- `MATERIAL_USDPREVIEW_VERIFIED`: authored USD Preview Surface shading network can be rendered and has passed screenshots/material binding checks.
- `MATERIAL_MDL_UNSUPPORTED` or `MATERIAL_MTLX_UNSUPPORTED`: metadata preserved but actual shader evaluation not performed. Neither counts as textured-fidelity success.
- `PHYSICS_METADATA_READ_ONLY`: physics schema, mass, colliders and joint parameters preserved with source provenance; **not** a verified simulation.
- `PARTIAL_GEOMETRY_ONLY`: PR #245 legacy fallback remains visible, selectable, review-only, with no physical authority.

## Renderer work

**Recommended approach:** a fully composed OpenUSD WebAssembly engine rather than trying to patch every USD feature into Three.js's limited parser. Babylon.js's new OpenUSD plugin supports composition arcs, materials and stage unit transforms via a worker. Prototype a *source-derived in-memory render bridge* into STRATUM's existing Three.js viewer. This is a render representation of the original native USD, **not** a user-requested manual GLB conversion and never a replacement of its source/asset record.

1. Pin compatible Babylon OpenUSD loader/core versions and **self-host** the matching worker/wasm/glue/data files. No production dependency on a mutable public CDN or mixed protocol versions.
2. Feed root layer and all referenced material/texture/payload files under **original virtual paths**; reject missing dependencies. Never fetch arbitrary remote URLs from an uploaded USD or accept path traversal.
3. Extract composed mesh position/index/UV/normal data and source node transforms into Three.js-compatible runtime buffers; preserve ordered scene hierarchy and instance prototypes. Check world matrices and source-authored meter normalization independently.
4. Translate only known `UsdPreviewSurface` PBR values and `UsdUVTexture` mappings (diffuse, normal, roughness, metallic, opacity, emissive), with correct sRGB vs linear color spaces. Treat unsupported MDL/MaterialX explicitly as unsupported, **not** as visually verified.
5. Collect feature telemetry `scene.meshes`, `scene.textures`, `materials.bound`, `variants.selected`, `physics.metadata`, `missingReferences`, `stage.units`, `source.sha256`, `warnings`. UI shows a fidelity-specific label, not a single blanket `Verified`.
6. Keep viewport bounds for **display only**. Do not use model bounds as project measurement until independent stage-meter and project registration witness are verified. Z defaults UNRESOLVED regardless of authored local model coordinate.
7. Preserve raw USD package as immutable source. Permit asset record to reference original archive and derived render buffers separately, including resource cleanup and reload.

## Independent correctness proof

Pin the original NVIDIA CC BY 4.0 dataset revision and independently compose with Pixar `usd-core==26.8`. The resulting JSON stage audit is a *QA witness*, not a trusted client record:

- Actual original root `metersPerUnit` and `upAxis` **with authored-vs-default distinction**.
- Complete composed prim and visible-mesh counts, including **Usd instance proxies**.
- Material API context, shader IDs, authored texture references, and bound material paths.
- Default and available variants, selected physics runtime, presence of authored metadata.
- Source and package SHA; layer/resolved dependency inventory.

Passing CI requires:
- A real NVIDIA hammer with identical source hash, at least the correct independent mesh count, imported material mapping report, interactive mesh selection, browser reload persistence.
- A second industrial SimReady asset with independent geometry and material checks.
- A missing dependency that **must fail closed** and a malformed USDZ that must not crash/allocate uncontrolled memory.
- Screenshots for geometry/material review on desktop/tablet/mobile, with attribution and no invented site placement.
- No new claims of MDL fidelity or simulation merely because those schemas were enumerated.

## Simulation milestone (separate from visualization)

Simulation fidelity is not just having USD physics metadata. It needs an appropriate runtime (e.g., tested PhysX/other solver), physics units, collider fidelity, rigid-body/articulation semantics, deterministic test harness, and domain-specific behavior checks. This must be implemented and accepted separately. Until then expose **metadata only; simulation unavailable**.

## Current status

PR #245 resolves the real hammer's empty scene by a source-authored single-geometry fallback; one mesh is selectable/persistent and **zero texture slots** are mapped. This PR provides independent scene-composition QA to guide the next implementation. It does not claim to implement the full renderer or simulation.
