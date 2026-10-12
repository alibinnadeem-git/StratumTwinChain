# Intake Gate — independent 7-check verifier for GLB/glTF 2.0 models

`intake_gate.py` implements the **Intake Gate** from the STRATUM Spatial
Verified build specs (Deliverable 1, finalized Oct 9, 2026).

This is an **independent verifier**: it checks 3D component models that other
people or agents produce. It is strict and honest — it reports what it can
prove from the bytes and says plainly what it cannot (e.g. true orientation
cannot be proven from bytes alone).

Standard library only — no `pip install`, no network needed (except the
optional external `gltf-validator`, which is allowed to be absent).

## Usage

```bash
python intake_gate.py MODEL.glb --meta META.json [--equipment|--device]
python intake_gate.py --self-test
```

- `--equipment` (default): 50,000-triangle budget.
- `--device`: 5,000-triangle budget (receptacles, detectors, small devices).
- Exit code `0` if no check failed (skips allowed), `1` if any check failed.
- Output is JSON on stdout:

```json
{
  "model": "panelboard.glb",
  "sha256": "7b8ba0f2...",
  "budget": "equipment/50000",
  "checks": [
    {"id": 1, "name": "licence", "result": "pass", "detail": "..."},
    ...
  ],
  "overall": "pass"
}
```

## META.json

```json
{
  "type_id": "E-06",
  "licence_tier": "T1",
  "permission_ref": "vendor/permissions/eaton-2026-10-09.pdf",
  "expected_anchors": ["mount_face", "power_in"],
  "declared_up": "+Y",
  "declared_origin": "floor",
  "declared_front": "+Z"
}
```

| Field | Required | Notes |
|---|---|---|
| `type_id` | yes | Taxonomy id, e.g. `E-06` |
| `licence_tier` | yes | `T1` (CC0/in-house, ships), `T2` (OEM-permitted, ships only with permission), `T3` (link-out only) |
| `permission_ref` | when tier is `T2` | Non-empty string path to the permission file |
| `expected_anchors` | no (default `[]`) | Node names that must exist in the glTF |
| `declared_up` | yes | Must be `"+Y"` (glTF convention) |
| `declared_origin` | yes | e.g. `floor`, `ceiling`, `wall` |
| `declared_front` | yes | e.g. `+Z` |

## The 7 checks

Each check reports `pass` | `fail` | `skip` with a detail string.

| # | Name | What it does |
|---|---|---|
| 1 | `licence` | Tier must be T1/T2/T3. T2 requires a non-empty `permission_ref`. |
| 2 | `glb_parse` | First 4 bytes `b'glTF'`, uint32-LE version `2`, declared length matches file, first chunk is JSON (`0x4E4F534A`) and parses. |
| 3 | `normalization` | `extras.normalization {up, origin, front}` present; `declared_up == "+Y"` and matches extras; bbox diagonal from POSITION accessor min/max across all meshes must be within [0.0001 m, 1000 m]. Detail states the diagonal and notes orientation can't be proven from bytes. |
| 4 | `anchors` | Every name in `expected_anchors` exists as a glTF node name; missing names are listed. |
| 5 | `triangle_budget` | Sums triangles over all mesh primitives (`indices` count/3, else POSITION count/3). Fails over budget. Detail also reports whether `KHR_draco_mesh_compression` / `EXT_meshopt_compression` is declared. |
| 6 | `validator` | Runs external `gltf-validator` (or `npx -y gltf-validator`) with a JSON report; fails on any reported error. **Skips** (never fails) when the tool isn't installed or can't launch — a missing tool is not a model defect. |
| 7 | `registration` | `extras` must contain `type_id`, `ifc_class`, `source`, `licence_tier`, `sha256`, `bounding_dimensions`, `scale_rule`. The embedded `extras.sha256` must match the file hash. |

### A note on check 7 (sha256)

A file cannot contain its own whole-file hash, so the comparison hash is
computed with the embedded `extras.sha256` value itself zeroed out
(detached-signature pattern). The detail string says so explicitly. To make a
model pass check 7, write the GLB with a 64-character placeholder in
`extras.sha256`, compute the masked hash, and patch the real digest back in
(same length — the file length must not change). `--self-test` demonstrates
exactly this.

## Self-test

```bash
python intake_gate.py --self-test
```

Builds a minimal valid GLB in `/tmp` (glTF magic, JSON chunk, one anchor node
`mount_face`, one 1-triangle mesh, full `extras`), injects its real masked
sha256, runs the gate and expects overall `pass`; then runs a bad-magic file
and expects overall `fail`. Prints PASS/FAIL per case.

## Worked example

```bash
$ python intake_gate.py panelboard.glb --meta panelboard.meta.json --equipment
{
  "model": "panelboard.glb",
  "sha256": "7b8ba0f2c3e6e90e...",
  "budget": "equipment/50000",
  "checks": [
    {"id": 1, "name": "licence", "result": "pass",
     "detail": "tier T1 (CC0 or in-house) -- ships by default"},
    {"id": 2, "name": "glb_parse", "result": "pass",
     "detail": "valid GLB: magic b'glTF', version 2, JSON chunk parses, declared length matches file"},
    {"id": 3, "name": "normalization", "result": "pass",
     "detail": "bbox diagonal 1.7321 m (bounds [0.0001, 1000.0]); declared_up=+Y matches; note: true orientation cannot be proven from bytes alone -- pass is on declared values + sane bounds"},
    {"id": 4, "name": "anchors", "result": "pass",
     "detail": "all 2 expected anchor(s) present: mount_face, power_in"},
    {"id": 5, "name": "triangle_budget", "result": "pass",
     "detail": "12480 triangles total (budget 50000); no KHR_draco_mesh_compression / EXT_meshopt_compression extension declared"},
    {"id": 6, "name": "validator", "result": "skip",
     "detail": "gltf-validator not installed or could not be launched"},
    {"id": 7, "name": "registration", "result": "pass",
     "detail": "extras.sha256 matches masked file hash 7b8ba0f2c3e6e90e...; all registration fields present; sha256 field itself excluded from the hash (detached-signature pattern)"}
  ],
  "overall": "pass"
}
$ echo $?
0
```

## Limitations (stated, not hidden)

- Orientation (`+Y` up etc.) is taken on declaration plus sane-bounds evidence;
  the tool cannot prove it from bytes and says so in check 3's detail.
- `gltf-validator` is optional: when absent the check skips rather than
  failing. Install the Khronos validator for full rigor.
- The sha256 span finder locates the first `"sha256"` key after `"extras"` in
  the JSON chunk — files with exotic layouts may need manual review.
- Triangle counting trusts accessor `count` fields; it does not decode the
  BIN chunk.
