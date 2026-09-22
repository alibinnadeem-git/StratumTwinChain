# STRATUM Spatial Verified — v2.1 Implementation Backlog & Admin Provisioning
Date: 2026-09-21

## E0 — Identity and production access (P0)
Owner: Platform/Security
Agents: Security Agent, QA Agent

Stories:
- E0.1 Provision first real SUPER_ADMIN under STRATUM Power.
- E0.2 Use native one-time password setup; never store plaintext passwords.
- E0.3 Verify login/session/tenant scoping and invalidate bootstrap credentials.
- E0.4 Run authenticated Spatial persistence UAT.

Acceptance:
- user role SUPER_ADMIN is visible in DB;
- password stored only as salted hash;
- session cookie is secure/httpOnly;
- unauthorized persistence remains 401;
- authenticated save/load/reload succeeds.

Note: the requested email is ali@stratumelectric.com. The supplied chat password must not be committed to source, logs or documentation. Direct connector injection of plaintext credentials is intentionally blocked; use the existing one-time setup flow.

## E1 — Project-set ingestion (P0)
Owner: Spatial Platform
Agents: Document Intelligence Agent, Spatial Agent, QA Agent

- native IFC reader and source GUID preservation;
- DWG adapter/service and richer DXF blocks/attributes;
- RVT via governed export/adapter;
- OCR/vision path for scanned/image plans;
- schedule/table/equipment-matrix extraction;
- mechanical/plumbing/fire/structural/civil/controls classification;
- site/project/sheet/revision grouping;
- title block, scale, datum and coordinate extraction.

## E2 — Render Spatial Environment workflow (P0)
Owner: Product + Spatial
Agents: Product Agent, UI/UX Agent, Spatial Agent

- replace ambiguous “Open Spatial” primary action with Render Spatial Environment;
- explicit render job state and progress;
- prerequisite/review gate;
- no viewer/demo model before usable data;
- discipline/source/floor/system/inference/finding layer controls;
- simple default UI; advanced controls progressively disclosed.

## E3 — Cross-discipline spatial compiler (P0)
Owner: Spatial
Agents: Spatial Agent, BIM/CAD Agent

- canonical spaces/rooms/levels/site datum;
- cross-sheet registration/alignment;
- source-specific coordinate transforms;
- asset identity reconciliation;
- physical and logical topology separation;
- model library mapping;
- OEM port-aware placement/constraint solver;
- versioned SpatialRevision persistence.

## E4 — Expected Power / Missing Load Intelligence (P0)
Owner: Electrical Engineering Intelligence
Agents: Power Systems Agent, Mechanical Agent, Standards Agent, OEM Knowledge Agent

### E4.1 Candidate discovery
Discover every likely powered asset from non-electrical sources.

### E4.2 Electrical-property extraction
Extract/project electrical characteristics from schedules/specs/submittals/OEM docs.

### E4.3 Requirement calculation
Produce connected/demand requirement objects with authority/confidence and explicit assumptions.

### E4.4 Graph reconciliation
Match expected loads to panel/feeder/branch/electrical-asset graph.

### E4.5 Findings
MISSING_FEED, RATING_MISMATCH, VOLTAGE_PHASE_MISMATCH, CAPACITY_RISK, EMERGENCY_POWER_REVIEW, DUPLICATE_OR_ORPHAN, CONTROL_POWER_MISSING, DISCONNECT_REVIEW.

### E4.6 Engineering services
Versioned calculation service adapters for load aggregation, voltage drop, short circuit, coordination, grounding, transformer loading, generator/UPS autonomy and power quality. High-consequence outputs require appropriate HITL.

## E5 — Coordination / gap engine (P0)
Owner: Spatial + Engineering
Agents: Coordination Agent, Standards Agent

- source/revision conflicts;
- quantity/tag/rating conflicts;
- physical clashes;
- working/service clearance envelopes;
- route/penetration/firestopping review;
- egress/access/maintenance zones;
- design-vs-procured-vs-installed-vs-as-built comparison;
- findings → RFI/NCR/work/change/estimate links.

## E6 — Asset inspector / lifecycle (P0)
Owner: Asset Intelligence
Agents: Asset Agent, Maintenance Agent, UI/UX Agent

Add to current inspector:
- source sheet/source region;
- manufacturer/model/spec/OEM reference;
- dimension and XYZ authority;
- maintenance plan, cycle, next due and condition triggers;
- warranty;
- dependencies/feeders/loads;
- open findings/RFIs/NCRs;
- lifecycle/DIR timeline;
- related work and evidence.

## E7 — Standards, OEM and jurisdiction resolver (P0)
Owner: Knowledge/Governance
Agents: Standards Agent, OEM Knowledge Agent, Security/Legal Review

- site jurisdiction + AHJ + adopted edition + effective date;
- project specifications/owner standards precedence;
- OEM document version registry;
- licensed/public-content handling;
- rule citations and applicability rationale;
- standards interpretation never self-approves engineering compliance.

## E8 — Persistence, governance and audit (P0/P1)
- persist render jobs, revisions, findings, rule evaluations and dispositions;
- append-only revision history;
- typed events;
- portable recovery;
- evidence/DIR link where policy requires;
- RBAC/ABAC + tenant isolation.

## E9 — QA, performance and release (P0/P1)
Representative UAT packages:
1. electrical SLD + architectural plan;
2. architectural + mechanical HVAC schedule + electrical set with one intentionally missing HVAC feed;
3. fire pump/fire alarm package + emergency power drawings;
4. civil/site + EV charging;
5. large multi-floor package.

Release gates:
- unit/type/build;
- schema compatibility;
- security;
- accessibility;
- desktop/tablet/mobile;
- persistence reload;
- tenant isolation;
- large-model performance;
- truth-label conformance;
- expected-load inference precision/recall with a human-reviewed gold set.

## Agent responsibility matrix
- JARVIS: orchestration, source/evidence retrieval, dissent/escalation.
- Spatial Agent: geometry, coordinate frames, layer/revision synthesis.
- Document Intelligence Agent: extraction/classification/tables/schedules.
- Power Systems Agent: expected-load graph, calculations, capacity/coordination findings.
- Mechanical Agent: HVAC/process semantics and schedule interpretation.
- Standards Agent: AHJ/code/standard applicability with source versioning.
- OEM Knowledge Agent: manufacturer/model documentation and dimensional/electrical characteristics.
- Maintenance Agent: OEM/condition/standard-informed plans and cycles.
- Coordination Agent: cross-discipline mismatch/clash findings.
- Security Agent: tenant/auth/provenance/licensing/security controls.
- QA Agent: automated gates, benchmark corpus and regression tests.

## Two-week expedited sequence
Day 1–2: admin access + render CTA + server-backed save/reload UAT.
Day 2–4: discipline/source layer model + mechanical/equipment schedule extraction.
Day 4–6: ExpectedPowerRequirement schema/engine + HVAC proof case.
Day 6–8: electrical graph reconciliation + missing/rating/capacity findings.
Day 8–10: standards/OEM resolver MVP + richer asset inspector.
Day 10–12: coordination engine + RFI/work linkage.
Day 12–14: multi-discipline UAT corpus, performance/security/accessibility regression, production promotion.

Scope rule: if an item cannot meet truth, persistence, security and acceptance gates in the expedited window, ship it as explicit REVIEW/INFERRED functionality rather than falsely labeling it complete or verified.
