# STRATUM Spatial Verified — Oct 10 electrical 3D modeling queue (review-only)

Source: Claude's 20-item attached 3D library audit (Oct 10 ~20:42 PT). This is a **modeling-only Tier-1** slice, never a source fact or installation/verification, geometry approval or Intake-Gate completion. Existing STRATUM app and registry reused. No OEM-derived geometry, no external geometry. No production deployment/merge.

## Validated audit decisions

- Original equipment-model directory contains **17 electrical files**; `end-suction-pump.glb` is mechanical (excluded). The new GLBs in this PR are additive.
- Existing E-10 `power-meter-representative.gltf` is a **standalone meter** (body/bezel/display/3 buttons; ~0.24×0.32×0.14 m), not a meter/CT cabinet. A new `meter-ct-cabinet.glb` is supplied and the legacy `power-meter` config remains its standalone original.
- Current `DEFAULT_ELECTRICAL_MODEL_REGISTRY` is keyed uniquely by `componentKey`, with **one default model URL per entry**; it **allows multiple different component entries/classes to reuse the same GLB URI**. No duplicate model binaries are needed. This PR also provides one explicit entry per A10 `E-xx` class via `lib/spatial-electrical-class-model-bindings.ts`; distinct classes can share exactly the same binary path.
- The older component library has `pv-array`, and `pv-array-representative.gltf` exists, but the **approved E-01–E-62 taxonomy has no PV module class**. **A10 backlog gap: PV-TAX-001** — human review whether to add a new dedicated type to a future taxonomy revision (without silently changing 62/100). Do not auto-classify PV modules as E-18 (inverter).

## Per-item queue disposition (priority-ordered)

| # | Classes | Disposition | New generic Tier-1 model(s) / note |
|---|---|---|---|
| 1 | E-05/E-06; E-42 shared envelope | MODELED / MAPPED | `panelboard-full.glb`; one shared binary, different class bindings; no circuit truth |
| 2 | E-03 | MODELED / MAPPED | `lv-switchgear-lineup.glb` distinct from E-04 |
| 3 | E-02 | MODELED / MAPPED | `mv-switchgear-lineup.glb` non-OEM cubicle visualization |
| 4 | E-11/E-12 | MODELED / MAPPED | `disconnect-breaker-generic.glb` shared binary, separate class entries |
| 5 | E-21–E-24 | MODELED / MAPPED | `cable-tray-straight.glb`, `cable-tray-elbow.glb`, `cable-tray-tee.glb`, `wire-basket-tray.glb`, `wireway.glb`. E-22 variants are design options, never an auto-placed takeoff. |
| 6 | E-19 | MODELED / MAPPED | `vfd-starter.glb`; generic electronics cabinet |
| 7 | E-10 | MODELED / MAPPED | `meter-ct-cabinet.glb` distinct from power meter |
| 8 | E-49/E-50/E-51 | MODELED / MAPPED | `recessed-luminaire.glb`, `troffer-luminaire.glb`, `linear-luminaire.glb` |
| 9 | E-08 | MODELED / MAPPED | `busway-tapoffs.glb` with generic tap boxes |
| 10 | E-34/35/36/38/39/44/48 | MODELED / MAPPED | `wall-device-plate.glb`, one URI for seven classes; generic visual, not device identity |
| 11 | E-40/41/46/47/59/60 | MODELED / MAPPED | `ceiling-device-puck.glb`, one URI for six classes; does not claim actual CCTV/WAP/detector topology |
| 12 | E-58 | MODELED / MAPPED | `fire-alarm-control-panel.glb` |
| 13 | E-20 EV charger | DEFERRED (cut line) | No new model in this PR. Avoid unlicensed OEM-like geometry. |
| 14 | E-56/57 exit/emergency | DEFERRED (cut line) | Small shared fixture later. |
| 15 | E-61/62/43 alarm wall device | DEFERRED (cut line) | Small shared fixture later. |
| 16 | E-18 inverter | DEFERRED (cut line) | Existing `inverter-representative.gltf` available. |
| 17 | E-45 network rack | DEFERRED (cut line) | Existing `data-rack-representative.gltf` available. |
| 18 | E-52–55 high-bay/pole/bollard | DEFERRED (cut line) | Site/warehouse later. |
| 19 | E-14/E-27 small boxes | DEFERRED (cut line) | Small shared fixtures later. |
| 20 | E-32 ground bar | DEFERRED (cut line) | Optional. |

## Constraints and remaining gates

- All new GLBs in this PR are in-house parametric creations, `T1`, Y-up, front +Z, real-unit metres with a named mount node. No branded OEM detail; one binary per silhouette may be reused by distinct class entries.
- **Binary parsability and bounds** are exercised by `qa:oem-cad-registry`, now running `qa-electrical-3d-model-queue.mjs` against every new model.
- This is *not* a seven-check Intake Gate signoff: original license/dimension evidence, optimizer/Draco/meshopt, full Khronos glTF Validator and binary SHA-256 registration still need independent review; entries remain **CANDIDATE_PENDING_SEVEN_CHECK_GATE** and must not automatically establish a RESOLVED/FALLBACK or authoritative placement.
- Device silhouettes are intentionally generic, including E-46/E-47; class identity and visual representation stay distinct. Exact source class and model licensing must pass the locked thresholds + gate before changing resolution_state.
- GLBs convey NO Z, asset location, scale authorization, commissioning state, quantity, clearance, measurement, or export authority.
