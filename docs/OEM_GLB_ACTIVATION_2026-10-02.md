# Four licensed GLB activations

Upstream: `adafruit/Adafruit_CAD_Parts`, commit `c128bceb1f96b6ea8b68f250bda986ba85da24ea`.
The MIT notice is shipped at `/models/oem/adafruit-cad-LICENSE.txt`.
The adjacent JSON manifest records source paths, SHA-256 digests, geometry bounds,
triangle counts, and revision limitations for each model.

Reproduction uses Python, NumPy 2.3.5 and CadQuery 2.7.0. Check out the pinned
upstream commit and verify each source digest before conversion. For the three
boards, pass the manufacturer's binary STL directly to:

```sh
python scripts/convert-binary-stl-to-glb.py SOURCE.stl public/models/oem/COMPONENT_KEY.glb
```

For enclosure 2230, import the STEP with `cadquery.importers.importStep(path).val()`,
require `shape.isValid()` and three solids, then export the intermediate STL using
`shape.exportStl(path, tolerance=0.1, angularTolerance=0.25, ascii=False, relative=False)`.
Pass that STL through the same converter. The converter centers the CAD envelope,
converts millimeters to meters, and supplies a neutral material; it adds no geometry.
For each board the corresponding STEP was also checked for valid solids and matching
bounds. Tessellation byte identity may depend on the OpenCascade version.

Run `npm run qa:oem-cad-registry` to verify shipped hashes, parse the GLBs with
Three.js, measure their bounds, and check component resolution and default registry
hydration. The spatial-viewer browser suite checks the active registry state and
public GLB responses at desktop, tablet and mobile sizes.

These approvals cover visualization of the pinned CAD revisions. They do not verify
physical installations or rated clearances. INA219 is the bare-board CAD revision
without the later terminal block; the enclosure omits screws. A NEMA-17 motor
candidate was excluded because its STEP failed the CAD integrity check.
