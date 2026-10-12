# enclosure_family.py — STRATUM parametric enclosure generator

Generates in-house GLB models for the enclosure family (taxonomy rows **E-02,
E-03, E-04, E-05, E-06, E-07, E-11, E-12**) plus their `.meta.json` sidecars and
a `manifest.json`. Every model is authored to pass the STRATUM Intake Gate 7/7.

## Dependencies

- Python 3.8+
- `numpy` (only third-party dep; geometry math)
- Standard library otherwise. No network.

```bash
pip install numpy
```

## Run

```bash
# Curated family (one representative model per covered row) + manifest
python enclosure_family.py --all --out <delivery-root>

# One model, fully parameterised
python enclosure_family.py --type-id E-06 --variant panelboard \
    --name branch_panelboard_500x1000 \
    --width 0.5 --height 1.0 --depth 0.15 --out <delivery-root>
```

Variants: `panelboard`, `switchgear`, `switchboard`, `mcc`, `disconnect`,
`enclosed_breaker`. Switchgear/MCC take `--sections` (and MCC
`--buckets-per-section`).

## Frame and conventions

- `+Y` up, metres, front `+Z` (glTF convention; viewer applies the single Y-up
  conversion from the canonical Z-up frame at its root).
- X = width (centred), Y = height (origin at floor/bottom plane), Z = depth
  (back face at z=0 against the wall).
- Origin: **wall face** for wall-mounted (panelboard, disconnect, enclosed
  breaker); **floor** for floor-standing (switchgear, switchboard, MCC).

## Dimensions

No dimension is guessed. Every dimension is an explicit parameter with a
documented default following published *envelope* standards (NEMA PB 1 / UL 67
panelboards, ANSI/IEEE C37.20.1 LV switchgear, C37.20.2 MV switchgear, UL 891
switchboards, NEMA ICS 18 / UL 845 MCCs, NEMA 250 / UL 50 enclosures). These
are published envelope figures, not any single SKU drawing, and no OEM geometry
is traced, converted or re-meshed. See the module docstring for the full list.

## Validation

Models were validated with the **Khronos glTF-Validator** (npm `gltf-validator`
2.0.0-dev.3.10): **zero errors, zero warnings** on every model. The only
informational notes are `NODE_EMPTY` for the named anchor locators, which is
expected and correct.

Re-run the Intake Gate yourself:

```bash
python intake_gate.py <model>.glb --meta <model>.meta.json --equipment
```

Check 6 (validator) **skips** gracefully if no `gltf-validator` CLI is on PATH
(a missing tool is not a model defect); it runs and passes when the Khronos
validator is installed.
