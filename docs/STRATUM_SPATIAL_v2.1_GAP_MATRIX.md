# STRATUM Spatial Verified — v2.1 Current-State Gap Matrix
Date: 2026-09-21

Legend: LIVE = verified in production/runtime; PARTIAL = meaningful capability exists but requirement is incomplete; PLANNED = not yet implemented/proven.

| Capability | Current state | Gap to v2.1 | Priority |
|---|---|---|---|
| Production database/runtime | LIVE | Continue hardening/monitoring | P0 |
| Session-signing runtime | LIVE | First real admin/user provisioning still required | P0 |
| Validator A/B/C connectivity | LIVE | Full PoVI Redbook conformance remains separate from app readiness | P1 |
| PDF parsing | PARTIAL | Broaden symbol/schedule/table/image extraction and discipline semantics | P0 |
| DXF parsing / unit preservation | PARTIAL | More entity types, blocks/attributes, coordinate transforms | P0 |
| DWG/RVT/IFC | PARTIAL | Currently adapter/fingerprint path; native extraction/import pipeline required | P0 |
| Image/scanned drawings | PARTIAL | Current images are inspected but automatic recognition is not yet available | P0 |
| SLD recognition → Spatial | LIVE/PARTIAL | Content recognition and logical projection live; stronger cross-document physical reconciliation remains | P0 |
| “Render Spatial Environment” CTA | GAP | Current flow says Open Spatial; implement explicit render job/state/progress | P0 |
| Multi-discipline layer stack | PARTIAL | L0–L4 and system/floor filtering exist; add discipline/source/inference/findings toggles | P0 |
| Electrical model registry | LIVE/PARTIAL | Electrical representative models exist; expand OEM + multi-discipline library | P1 |
| Uniform physical scale | PARTIAL | Metric normalization/review gates exist; improve per-source coordinate alignment and OEM port constraints | P0 |
| XYZ provenance | PARTIAL | X/Y/Z authority/review fields exist; full cross-sheet/site datum solver remains | P0 |
| Asset click inspector | LIVE/PARTIAL | Identity, source, DIR, lifecycle/activity are present; add maintenance plan/cycle, warranty/spec/OEM/finding summary | P0 |
| DIR/lifecycle workflow | LIVE/PARTIAL | Activity/evidence/approval/finality path exists; more maintenance/commissioning policy integration required | P1 |
| Spatial server persistence | PARTIAL | Schema/API ready; real authenticated user flow and end-to-end persistence UAT pending | P0 |
| Cross-document conflict engine | PARTIAL | Review queue flags source/Z/candidates; full semantic/geometry/rating/revision conflict engine required | P0 |
| Expected/Missing Power engine | PLANNED | New v2.1 requirement | P0 |
| HVAC/mechanical load discovery | PLANNED | Extract schedules/OEM/nameplate electrical data and reconcile with electrical graph | P0 |
| Fire/life-safety power reconciliation | PLANNED | Fire pump/alarm/smoke-control/emergency power expectation engine | P0 |
| Capacity/load-flow services | PLANNED/PARTIAL ARCHITECTURE | Redbook locks the service model; deterministic production services need implementation | P1 |
| Standards/AHJ resolver | PLANNED | Build effective-date/jurisdiction/project-spec resolver and licensed knowledge boundary | P0 |
| OEM knowledge service | PARTIAL | Dimension/model references exist; generalized governed OEM retrieval/versioning required | P0 |
| Maintenance intelligence | PARTIAL | Lifecycle recording exists; OEM/condition/standard-based plan generation and due-cycle engine required | P1 |
| Revision compare | PLANNED/PARTIAL | Required by PRD/Redbook; needs full UI and source/spatial diff | P1 |
| Large-project performance | PARTIAL | Viewer/LOD direction exists; representative large-package benchmarks required | P1 |
| Security/ISO/SOC evidence | PARTIAL | Architecture aligns; certification/audit evidence is separate work and must not be claimed prematurely | P1 |

## Baseline assessment
**Redbook:** The new requirement is strongly aligned with locked Spatial, document-intelligence, power/load-intelligence, asset-taxonomy, engineering-calculation, HITL and standards concepts. The main gap is implementation depth, not architectural direction.

**BRD v2.0:** Business alignment is strong. v2.1 adds an explicit business outcome for finding power scope omitted from electrical drawings and makes cross-discipline rendering a first-class product journey.

**PRD v2.0:** Existing PR-SPAT requirements already cover sheet review, space/asset extraction, SLD-to-Spatial, independent X/Y/Z confidence and synchronized views. v2.1 adds an explicit Render CTA, discipline layer management, richer asset inspector and ExpectedPowerRequirement workflow.

**TRD v2.0:** Existing target flow already specifies PDF/CAD/BIM/scan/SLD → extraction/classification → semantic graph → geometry reconstruction → conflict review → governed revision. v2.1 adds expected-load inference, standards applicability, OEM knowledge resolution and canonical power/coordination finding objects.

## Immediate release gap
The highest-value missing end-to-end proof is:
upload a representative multi-discipline site package → Render Spatial Environment → discipline layers → resolve assets/models/XYZ → infer expected HVAC/plumbing/fire/control loads → compare to electrical drawings → flag missing/mismatched scope → click asset → show source/DIR/lifecycle/maintenance/findings → persist revision → reload and recover.
