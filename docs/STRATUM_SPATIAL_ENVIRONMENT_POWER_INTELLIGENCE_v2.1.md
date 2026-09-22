# STRATUM Spatial Verified — Spatial Environment & Power Intelligence Requirements Extension
Version 2.1 — 2026-09-21

Status: Approved product/engineering extension for implementation.
Normative parent set: STRATUM Redbook v1.0 Final Consolidated & Audited Edition; BRD v2.0; PRD v2.0; TRD v2.0.

## 1. Executive requirement
STRATUM Spatial Verified shall convert a multi-discipline project document package into a governed, layered spatial environment while preserving source provenance, uncertainty, engineering authority and revision history.

Accepted source families include PDF, CAD/DXF/DWG, BIM/IFC/RVT, images/scans, SLDs, architectural, structural, civil, mechanical, plumbing, fire-protection, low-voltage/security/IT drawings, equipment matrices, schedules, elevations, sections, specifications, OEM submittals, O&M data, site/zoning/fire documents and approved project records.

After source ingest/review the primary action shall be **Render Spatial Environment**.

The rendering workflow shall:
1. classify each source by site, discipline, sheet type, revision, scale, coordinate context and confidence;
2. extract spaces, geometry, systems, assets, tags, ratings, schedules, ports and logical relationships;
3. resolve cross-document identities without silently merging conflicts;
4. construct a multi-discipline spatial graph and layer stack;
5. map identified assets to the STRATUM asset/model library;
6. normalize dimensions and XYZ using the authority hierarchy in Section 6;
7. generate explicit review findings for uncertainty, mismatches and missing information;
8. persist a versioned Spatial revision;
9. expose a clickable asset inspector with identity, source lineage, DIR, lifecycle, maintenance, warranty, evidence and issue context.

## 2. BRD extension
### BR-ENV-001 — Unified project-set compilation
A user shall be able to upload heterogeneous project sources for one site and receive one coordinated spatial working environment rather than isolated document viewers.

### BR-ENV-002 — Discipline layers
Architectural, electrical-physical, electrical-logical, mechanical, plumbing, fire protection, structural, civil/site, controls/BMS, low-voltage/IT/security, source evidence, inferred objects and findings shall be independently visible/toggleable where data exists.

### BR-ENV-003 — Asset-centered operations
Any spatial asset shall open the same canonical identity used for lifecycle, maintenance, work, evidence, QR identity and DIR/proof workflows.

### BR-ENV-004 — Coordination intelligence
The platform shall identify cross-document discrepancies, duplicated or missing equipment, inconsistent tags/ratings/dimensions, revision conflicts, spatial clashes, clearance/access concerns and unresolved dependencies.

### BR-ENV-005 — Expected electrical demand from non-electrical sources
The platform shall identify equipment and systems that reasonably require electrical power even when the electrical drawings do not show them. It shall create reviewable ExpectedPowerRequirement records from mechanical/plumbing/fire/life-safety/vertical-transport/process/IT/security/architectural/specification/OEM evidence and compare them to the canonical electrical graph.

### BR-ENV-006 — Evidence and authority
AI, standards, historical data and OEM references are advisory inputs. They shall never silently become approved engineering truth. Qualified human review remains required for engineering approval, code interpretation, final load calculations, energization or safety-critical decisions.

### BR-ENV-007 — Standards applicability
Rules shall be resolved by site jurisdiction, AHJ, project contract/specifications, occupancy/use, system type, project phase and effective code date. “Newest published” is not automatically “adopted by the project.”

### Business outcomes
- reduce manual cross-discipline coordination effort;
- expose missing electrical scope before procurement/installation;
- improve spatial turnover and maintenance readiness;
- make design-vs-procured-vs-installed-vs-as-built discrepancies explicit;
- connect spatial findings to RFIs/NCRs/work/approvals;
- preserve a defensible evidence trail for every inference.

## 3. PRD extension
### Primary journey
1. User creates/selects project + site.
2. User uploads the project set.
3. STRATUM fingerprints and classifies each source.
4. User reviews unresolved sheet/site/scale/revision metadata.
5. CTA becomes **Render Spatial Environment** when minimum render prerequisites exist.
6. Rendering compiles cross-discipline geometry, asset candidates, topology, layer stack and findings.
7. User opens the spatial environment with simple default controls: Layers, Search, Findings, Asset details.
8. User resolves high-impact findings and optionally accepts a review baseline.
9. A governed Spatial revision is persisted; stronger verification requires the appropriate evidence/HITL path.

### Functional requirements
- PR-ENV-001: Render CTA is unavailable until at least one usable source/object exists and clearly explains missing prerequisites.
- PR-ENV-002: Render progress shows classify → extract → reconcile → model-map → coordinate → analyze → publish.
- PR-ENV-003: User can toggle discipline, source, floor, system, review/inference and findings layers.
- PR-ENV-004: Layer state never changes source authority.
- PR-ENV-005: Selecting an object highlights the same canonical entity in Spatial/SLD/source/finding context.
- PR-ENV-006: Asset inspector shows identity, source sheet(s), XYZ and authority, model/dimension authority, lifecycle state, DIR state, maintenance plan/cycle, warranty, OEM refs, evidence, findings and related work.
- PR-ENV-007: Unlinked geometry must not borrow identity/lifecycle/DIR from a similar asset.
- PR-ENV-008: Multi-source conflicts remain visible until resolved.
- PR-ENV-009: Review labels distinguish SOURCE_BACKED, FIELD_VERIFIED, OEM_DERIVED, DRAWING_DERIVED, CONSTRAINT_SOLVED, AI_INFERRED, UNKNOWN and CONFLICTED.
- PR-ENV-010: Revision compare identifies added/removed/moved/changed objects, ratings, feeds, dimensions and findings.

### Expected Power / Missing Power requirements
- PR-PWR-001: Detect power-consuming candidates from non-electrical disciplines and schedules.
- PR-PWR-002: Prefer explicit manufacturer/project electrical data: voltage, phase, frequency, input kW/kVA, FLA/RLA/LRA, MCA, MOCP, heater kW, motor hp/kW, VFD, disconnect and control-power requirements.
- PR-PWR-003: If model/part number is known, retrieve governed OEM reference data and preserve document/version/source.
- PR-PWR-004: If only partial data exists, derive a bounded engineering estimate and label the basis/assumptions.
- PR-PWR-005: Never use MCA or MOCP as “actual demand” without an explicit proxy label. Prefer nameplate input power or component operating data.
- PR-PWR-006: Match expected loads to electrical assets/feeders/panels using canonical identity, tag, location, system and source lineage.
- PR-PWR-007: Create MISSING_FEED when a credible load has no electrical supply representation.
- PR-PWR-008: Create RATING_MISMATCH for voltage/phase/kW-kVA/ampacity/protection discrepancies.
- PR-PWR-009: Create CAPACITY_RISK when expected/known downstream demand conflicts with panel/transformer/generator/UPS capacity assumptions.
- PR-PWR-010: Create EMERGENCY_POWER_REVIEW when a life-safety/mission-critical function appears to require emergency/standby treatment but drawings do not reconcile.
- PR-PWR-011: Create DUPLICATE_OR_ORPHAN for double-fed, duplicate-tag or electrical-only assets lacking a corresponding source/system.
- PR-PWR-012: Demand/diversity/continuous/noncoincident assumptions are versioned, jurisdiction/project specific and human-reviewable.
- PR-PWR-013: Findings expose connected-load estimate, demand estimate, confidence, source authority and calculation version separately.
- PR-PWR-014: Power findings are advisory until qualified engineering review.
- PR-PWR-015: Findings can create an RFI, engineering review, change item, estimate delta or work item without re-entering context.

### Required non-electrical load families
HVAC/R: chillers, RTUs, AHUs, MAUs, heat pumps, condensers, compressors, cooling towers, fans, fan coils, VAV/terminal units with electric heat, electric duct heaters, humidifiers, pumps, condensate pumps, crankcase heaters, control transformers/panels, smoke-control and pressurization fans.

Plumbing/fire: domestic/booster pumps, sump/sewage/ejector pumps, water heaters, heat trace, fire pump, jockey pump, controllers, fire alarm/NAC/power supplies and monitored ancillary equipment.

Vertical transport: elevators, escalators, lifts and associated machine/control/lighting/communication power.

Controls/IT/security/AV: BMS/DDC panels, gateways, control transformers, PoE switches, network/AV racks, access control, cameras, intercom and security power supplies.

Special/process: kitchen, laboratory, medical, manufacturing/process equipment, EVSE, PV/inverters, storage/BESS, chargers and owner-furnished equipment.

## 4. TRD extension
### 4.1 Pipeline
Project set → source registry → classification → extraction → semantic normalization → cross-document entity resolution → geometry/coordinate reconstruction → asset/OEM model mapping → expected-load inference → coordination/standards checks → human review → governed SpatialRevision.

### 4.2 New canonical objects
**ExpectedPowerRequirement**
- id, projectId, siteId, candidateAssetId/assetId
- sourceRefs[]
- equipmentClass, manufacturer, model, partNumber
- voltage, phase, frequency
- inputKw, inputKva, fla, rla, lra, mca, mocp, motorHp
- controlPower, electricHeatKw, vfdRequired, localDisconnectExpected
- criticality, emergencyClass, redundancyRole
- connectedLoadEstimate, demandLoadEstimate
- calculationMethod, calculationVersion, assumptions[]
- authorityClass, confidence
- applicableRuleSetRefs[]
- status: EXPECTED | MATCHED | MISSING | CONFLICTED | REVIEWED | DISMISSED

**PowerGapFinding**
- findingType
- expectedPowerRequirementId
- electricalEntityRefs[]
- severity/risk class
- evidenceRefs[]
- comparison values
- recommendedNextAction
- humanControlLevel
- disposition/history

**CoordinationFinding**
- type: identity, revision, geometry, clearance, routing, rating, missing-object, duplicate, source-conflict, standards-review
- involved entity/source refs
- location/bounding region
- evidence and confidence
- status/disposition

**StandardsApplicability**
- jurisdiction/AHJ
- project address/site
- occupancy/use
- adopted code/edition/effective dates
- contract/spec rule
- referenced standard/OEM document
- applicability rationale
- reviewer/approval state

### 4.3 Evidence hierarchy for geometry and dimensions
1. verified scan/LiDAR or surveyed field measurement;
2. verified as-built BIM/IFC;
3. approved project BIM/CAD/architectural/MEP;
4. elevations/sections/risers/schedules;
5. approved submittals/OEM dimensions and mounting;
6. verified field photos/capture;
7. operational mappings;
8. logical SLD/topology;
9. historical/standards-based nominal data;
10. AI/geometric inference.

Stronger evidence may supersede a weaker derived projection only through a new versioned revision; history is never silently rewritten.

### 4.4 XYZ model
Each object maintains coordinate frame, X/Y/Z, rotation, dimensions, bounding volume, source scale/units, origin, floor/level/room/zone, and independent confidence/authority for X, Y, Z, geometry, identity and topology.

Required vertical fields: zFloor, zBase, zCenter, zTop, mountingElevation, connection elevations and clearance/service volumes.

### 4.5 Expected-load inference algorithm
1. discover power-consuming candidate from non-electrical evidence;
2. establish identity and source version;
3. gather explicit project/nameplate/OEM electrical characteristics;
4. infer only missing fields from governed rules;
5. calculate bounded electrical requirement;
6. match against the electrical graph;
7. evaluate rating/feed/capacity/emergency relationships;
8. issue findings with source, assumptions and confidence;
9. require qualified review for A3 engineering conclusions.

For three-phase apparent-power reference: kVA = sqrt(3) × V_LL × I / 1000.
For single-phase apparent-power reference: kVA = V × I / 1000.
These formulas are calculation primitives only; current/demand selection must be based on the appropriate nameplate/OEM/code/project basis.

### 4.6 Coordination checks
- equipment schedule vs plan vs SLD vs specification quantity;
- tag/name/model conflicts;
- voltage/phase/frequency mismatch;
- electrical rating/protection mismatch;
- missing branch/feeder/disconnect/control power;
- source/destination topology mismatch;
- duplicated or orphaned assets;
- panel/transformer/generator/UPS capacity risk;
- floor/room/XYZ disagreement;
- geometry overlap and route conflict;
- working/service clearance review;
- fire-rated penetration/firestopping review;
- egress/access/maintenance-zone review;
- revision mismatch/stale source;
- expected emergency/standby function not reconciled.

### 4.7 Asset/model library
The library shall expand from electrical-only toward multi-discipline physical asset classes. Each model entry carries class, manufacturer/model applicability, source/license, dimensions, connector/port geometry, installation envelope, service/clearance envelope, confidence and replacement rules. Representative geometry shall never be presented as OEM/as-built geometry.

### 4.8 Standards resolver
The engine stores standards as licensed/public metadata and interpreted rules with version/effective-date provenance. It shall resolve project-applicable rules rather than assuming the newest edition is legally adopted.

Reference families as of 2026-09-21 include:
- NFPA 70 NEC, current published 2026 edition, subject to AHJ adoption;
- NFPA 70E 2024 electrical safety;
- NFPA 70B 2026 electrical equipment maintenance;
- NFPA 72 2025 fire alarm/signaling and NFPA 20 2025 fire pumps, where applicable;
- ICC 2024 IBC/IFC model codes, subject to local adoption/amendment;
- ASHRAE/IES 90.1-2022 energy; ASHRAE 62.1-2025 ventilation/IAQ; ASHRAE 15-2024 refrigeration safety;
- NECA NEIS including NECA 1-2023 workmanship, NECA 90-2024 commissioning, NECA 91-2023 maintenance, NECA 100-2024 symbols and equipment-specific standards;
- ISO 16739-1:2024 IFC;
- ISO 19650-1:2018 and ISO 19650-2:2018 remain current published editions while second-edition drafts progress in 2026;
- ISO 55001:2024 asset management;
- ISO/IEC 27001:2022 information security;
- ISO/IEC 42001:2023 AI management;
- NIST CSF 2.0;
- AICPA SOC 2 Trust Services Criteria as an assurance target where contractually required.

### 4.9 Security and audit
All source ingestion, render jobs, model revisions, findings, rule evaluations, human dispositions and asset bindings shall be tenant-scoped and audited. External standards/OEM content must respect licensing. AI outputs retain model/tool/source provenance.

## 5. Acceptance criteria for “Render Spatial Environment”
A release candidate passes only when:
- heterogeneous project sources can be uploaded without showing a fake/demo spatial environment;
- at least PDF and DXF source extraction persists; native adapters truthfully report unsupported/unresolved formats;
- render produces a versioned spatial graph with source lineage;
- discipline/source/floor layers can be toggled;
- identified assets resolve to library geometry or clearly labeled representative fallback;
- dimensions/XYZ expose authority/confidence;
- clicking an asset opens the governed inspector;
- expected-load engine produces traceable findings from at least representative HVAC, plumbing/fire and controls schedules;
- missing-feed/rating/capacity findings link both non-electrical and electrical evidence;
- conflicts remain explicit;
- authenticated persistence survives reload/new browser;
- accessibility, tenant isolation, security and desktop/tablet/mobile UAT pass;
- no inferred result is labeled Field Verified, Engineering Reviewed, As-Built, code compliant or PoVI Verified without its required evidence/authority.
