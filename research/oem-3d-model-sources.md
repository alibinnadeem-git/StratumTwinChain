# STRATUM Spatial Verified — OEM 3D Model Source Register

**Status:** Discovery register only  
**Updated:** 2026-09-30

## Headline

**ZERO model sources in this register are currently approved as no-login, redistribution-safe, bundle-ready STRATUM assets.**

Every entry below is link-out/discovery metadata until format, model applicability, license, redistribution rights, malware/content safety, dimensional QA, and provenance checks are completed. STRATUM must continue to use procedural/review geometry unless a model passes that gate.

| Component | Source lead | Access/status | STRATUM action |
| --- | --- | --- | --- |
| NOTIFIER NFS-320 FACP | https://www.bimobject.com/pt/notifier-by-honeywell-us/product/nst42533 | login / license review required | Link out only; do not bundle |
| NOTIFIER NFS2-3030 | https://www.bimobject.com/en-us/notifier-by-honeywell-us/product/nst42535 | login / license review required | Link out only; do not bundle |
| Schneider panelboards / safety switches / switchboards | https://www.se.com/us/en/work/support/resources-and-tools/cad-drawings/ | OEM portal; model-specific terms unresolved | Link out only |
| ABB electrical BIM discovery | https://www.bimobject.com | discovery portal; exact family/terms unresolved | Link out only |
| Transformer DWG lead | https://www.cadblocksfree.com/en/free-3d-cad-models/transformer-3d-dwg-model.html | convertible candidate; redistribution unclear | Do not bundle until license + conversion QA |
| Pad-mount transformer DWG lead | https://www.bibliocad.com/en/library/transformer_132190/ | login/license/applicability unresolved | Link out only |

## Bundle-admission gate

A model may move from discovery into the component registry only after all of the following are recorded:

1. Exact manufacturer / family / model applicability.
2. Source URL and acquisition timestamp.
3. File SHA-256.
4. File format and self-contained dependency check.
5. Explicit license/redistribution basis permitting the intended STRATUM use.
6. Malware/content safety screening.
7. Native-unit and bounding-box validation.
8. Dimension comparison against a trusted OEM specification.
9. Orientation/origin review.
10. Human approval for registry activation.

A successful download is **not** evidence of redistribution permission or engineering correctness.
