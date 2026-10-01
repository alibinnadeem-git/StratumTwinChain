# STRATUM Spatial Verified — Z Mounting Evidence Register

**Status:** Review evidence only  
**Updated:** 2026-09-30  
**Doctrine:** Nothing in this register establishes installed elevation, field verification, approval, certification, or PoVI/DIR physical truth.

This file records the evidence classes used by `lib/z-inference.ts`. A value may be used only to generate a review-required proposal. Absolute project Z exists only when a relative mounting value is composed with a source-grounded project support datum. Unknown support remains relative.

| Component class | Review prior | Reference point | Evidence status | Notes |
| --- | ---: | --- | --- | --- |
| Disconnect / safety switch | 1.22 m AFF | mounting point | trade-practice prior | Coordination prior only. Project drawings and applicable code govern. |
| Fused switch | 1.22 m AFF | mounting point | trade-practice prior | Coordination prior only. |
| Fire alarm control panel | 1.60 m AFF | centerline | jurisdiction-sensitive guidance | FDNY bulletin is a jurisdictional reference, not a universal project rule. |
| Duplex receptacle | 0.46 m AFF | centerline | common design-practice prior | Project details and accessibility conditions govern. |
| GFCI receptacle | 0.46 m AFF | centerline | common design-practice prior | Project details govern. |
| Isolated-ground outlet | 0.46 m AFF | centerline | common design-practice prior | Project details govern. |
| Industrial receptacle | 0.46 m AFF | centerline | common design-practice prior | Special-purpose outlet details can differ. |
| Exit sign | 2.10 m AFF | base | STRATUM visualization prior | Low-confidence visualization only; life-safety drawings govern. |
| Emergency wall light | 2.30 m AFF | centerline | STRATUM visualization prior | Low-confidence visualization only. |
| Access-control reader | 1.20 m AFF | centerline | STRATUM coordination prior | Architectural/security details govern. |
| Security panel | 1.40 m AFF | centerline | STRATUM coordination prior | Project details govern. |
| Intercom station | 1.40 m AFF | centerline | STRATUM coordination prior | Architectural elevations govern. |
| Pad-mounted transformer | 0.12 m above grade | base | exact-document review reference | Used as a midpoint review prior only; utility/civil details govern. |

## Exact-document references currently encoded

- **FDNY Bulletin 08-02-12 — Mounting Height for Fire Equipment:** https://www.nyc.gov/assets/fdny/downloads/pdf/codes/bulleltin-no-08-02-12-mounting-height-for-fire-equipment.pdf
- **UFGS 26 13 02 — Underground Electrical Distribution:** https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2026%2013%2002.pdf
- **Tesla V3 Supercharger cabinet datasheet mirror used for cabinet/floor-standing context:** https://caltrans.brightidea.com/ct/getfile.php?a=OD7374&f=8B23F7F3-E63D-11EF-BC3A-0AFFDC36765F

## Evidence-boundary rules

1. A mounting height without a resolved support datum is **relative-only** and cannot create an absolute Z.
2. Reference points remain explicit: base, centerline, mounting point, grade, floor datum, or unspecified.
3. A centerline/mounting-point proposal is not silently converted to model-base Z unless the required equipment geometry/reference offset is known.
4. Historical placements are project- and organization-scoped H2 review evidence, not global truth.
5. Multiple aligned proposal paths do not receive a confidence boost unless evidence independence is established.
6. A source-grounded Z-chain conflict blocks inferred preview/acceptance until the conflict is resolved or superseded.
