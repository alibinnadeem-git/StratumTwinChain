# A10 Electrical Tier-1 3D Model Spec Sheet Implementation — 2026-10-10

**Source:** `claude-3d-model-spec-sheets-2026-10-10.md` (Ali). This is a visualization candidate update to existing PR #221. **Never production or an Intake-Gate endorsement.**

## Source-aligned global rules

- Everything is STRATUM in-house procedural **generic Tier 1**. No OEM-derived shapes, logos, baked text, texture maps, device identifiers or customer/installation coordinates.
- All models use metres, glTF +Y-up, visible front +Z; floor origin at footprint centre/floor, wall origin at rear-face centre/host plane, ceiling origin at host ceiling plane with body beneath it.
- Named `mount_face` for all; hero models additionally carry `power_in`, `ground_lug`, `conduit_entry` as empty named nodes.
- Flat PBR materials, maximum four (sRGB palette matching #9AA3A6, #A9ADB0, #C41E1E, #1B1D1F, #E8EAEA, #2FBF4A, etc), no textures.
- Model families store separate `variant:E-xx` named parent nodes. **Selection MUST hide other variants**, otherwise multiple physical shapes render simultaneously. `selectTier1ModelVariant` is a presentation-only helper and fails closed for an unrecognized variant.
- No binary candidate automatically changes an active `DEFAULT_ELECTRICAL_MODEL_REGISTRY` mapping, exact model identity, source geometry, XY/Z, takeoffs, measurements, commissioning or lifecycle state.

## Priority order and disposition

| # | Class IDs | Disposition | Family GLB and variants |
|---|---|---|---|
| 1 | E-05/E-06/E-42 | Built candidate | `panelboard-full.glb`, three sizes without internal breakers |
| 2 | E-03 | Built candidate | `lv-switchgear-lineup.glb`, 3 sections, breaker-cell fronts and dark base |
| 3 | E-02 | Built candidate | `mv-switchgear-lineup.glb`, deeper 3-section/three-tier lineup |
| 4 | E-11/E-12 | Built candidate | `disconnect-breaker-generic.glb`, side/flush handle variant groups |
| 5 | E-21–E-24 | Built candidate | `cable-tray-family.glb`, ladder/elbow/tee/basket/wireway variants |
| 6 | E-19 | Built candidate | `vfd-starter.glb`, wall-mounted keypad, lights and vents |
| 7 | E-10/E-27 | Built candidate | `meter-ct-cabinet.glb`, CT enclosure beside a round meter; junction-box alternate |
| 8 | E-49/E-50/E-51 | Built candidate | `luminaire-family.glb`, downlight/troffer/linear |
| 9 | E-08 | Built candidate | `busway-tapoffs.glb`, joint/tap-off/hanger visuals |
| 10 | E-34/35/36/38/39/44/48 | Built candidate | `wall-device-plate.glb`, 7 variants, instanced <=5 KB |
| 11 | E-40/41/46/47/59/60 | Built candidate | `ceiling-device-puck.glb`, 6 variants, instanced <=5 KB |
| 12 | E-58 | Built candidate | `fire-alarm-control-panel.glb`, small generic red panel |
| 13 | E-20 pedestal charger | Deferred under approved cut line | No OEM shape |
| 14 | E-56/57 exit/emergency | Deferred | |
| 15 | E-61/62/43 wall alarms | Deferred | |
| 16 | E-18 inverter | Deferred | Existing geometry left unchanged |
| 17 | E-45 network rack | Deferred | Existing geometry left unchanged |
| 18 | E-52–55 high-bay/site | Deferred | |
| 19 | E-14/27/42 box variants | Partial: E-27/E-42 variants above | Others deferred |
| 20 | E-32 ground bar | Deferred, last in queue | |

### Remaining deviations and exceptions (must not mark done)

- Panelboard, LV and MV heroes meet 22–90 KB, ≤3,000 triangles, four-material ceiling. VFD, meter/CT and full tray family also meet the target.
- Smaller heroes/functional models below the nominal **22 KB hero floor**: disconnect/breaker 21.8 KB, luminaires 16.2 KB, busway 15.0 KB, FACP 17.1 KB. These are below the target file-size range (smaller rather than too large); no inert padding has been introduced to meet an artificial minimum.
- E-03/E-04 shared-shell direction follows a common generic section design but **E-04 is an existing model under QA-only**, so this PR does not rebuild or combine it.
- UPS/BESS E-16/E-17 are existing QA-only; E-13 ATS is existing QA-only. Physical reauthoring or shared-shell consolidation on those is held rather than modifying eight protected reference GLBs.
- The ceiling camera is a low-poly dark smoked cylindrical dome proxy; it is **not** a fully hemispherical lens yet. Luminaire optional pendant leads and tray adjustable width families are represented as named variants but not fully parameterized in the browser. These require additional visual authoring before any Intake signoff.
- **E-10 meter cabinet** physically includes a separate side-by-side small meter box and circular meter face; the previous `power-meter-representative.gltf` was only the meter and remains separately present.
- The current class registry supports only **one default model config per componentKey**, but **many distinct class entries may point to the same GLB path**, with a distinct `variantId`. No copies are required. An E-22 elbow/tee alternate is represented by separate variants in the same binary.
- PV module class remains missing from 62-class taxonomy; tracked as **PV-TAX-001** for later Ali-approved taxonomy revision, never mapped to inverter by guess.
- **Seven-check Intake Gate NOT COMPLETED**: standard Khronos glTF zero-error validation, immutable SHA-256 binary evidence, geometry QA and signoff are still required; local Three.js parse and finite bounds are automated, not a substitute for independent certification.

## Existing eight-model reference QA

The 8 reference GLBs remain **byte-for-byte unchanged** in this PR. The new `qa-electrical-reference-eight.mjs` reads their actual binary geometry in CI, reports mesh-space W/H/D size, deviation against Claude's source specs, detected surface-color tokens and available named feature hints. Structural silhouette and finish matching require manual image/render inspection, **not** just file dimensions. Treat every color/style assessment as provisional until that review.

The existing registry's representative envelopes already show mismatches against Claude's new references (these figures are registry metadata, not yet measured mesh bounds):

| Class | Existing registry envelope (m) | New reference (m) | Preliminary mismatch |
|---|---|---|---|
| E-01 | 1.45×1.54×1.391 | 1.80×1.60×1.70 | Compare exact mesh report in CI logs |
| E-04 | 2.40×2.12×0.72 | 2.70×2.30×0.90 | Compare exact mesh report in CI logs |
| E-07 | 2.08×2.10×0.64 | 1.70×2.30×0.50 | Compare exact mesh report in CI logs |
| E-09 | 1.35×1.485×0.882 | 0.75×1.10×0.65 | Compare exact mesh report in CI logs |
| E-13 | 0.82×1.42×0.425 | 0.60×1.20×0.35 | Compare exact mesh report in CI logs |
| E-15 | 3.02×1.99×1.20 | 3.60×2.00×1.30 | Compare exact mesh report in CI logs |
| E-16 | 0.96×1.84×0.793 | 0.80×1.80×0.80 | Compare exact mesh report in CI logs |
| E-17 | 1.00×1.86×0.936 | 1.20×2.20×1.10 | Compare exact mesh report in CI logs |
