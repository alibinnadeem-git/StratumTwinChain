**STRATUM Power**

**STRATUM Spatial Verified**

Business Requirements Document

| Document | BRD |
| :---- | :---- |
| **Version** | 2.0 |
| **Date** | 13 September 2026 |
| **Normative baseline** | STRATUM Redbook v1.0 — Final Consolidated & Audited Edition |

Canonical naming: STRATUM Spatial Verified • STRATUM Chain • Proof of Verified Infrastructure (PoVI) • Digital Immutable Record (DIR)

# **Document Control and Governing Rules**

This BRD defines the business outcomes, scope, operating model, governance, stakeholder requirements, success measures and commercial release gates for the complete STRATUM Spatial Verified ecosystem. It consolidates the Redbook, earlier STRATUM Verified BRDs and later product decisions into one authoritative business baseline.

| Status discipline: Implemented \= directly verified working capability. Partial \= meaningful but incomplete capability. Planned \= specified but not verified as built. Conceptually Locked \= approved target architecture, not an implementation claim. |
| :---- |

| Supersession rule: The September 2026 Redbook and later Spatial Verified decisions supersede earlier user-facing “digital twin”, “Verified Twin”, public-chain-first, or generic blockchain terminology. Legacy internal names may remain temporarily for compatibility but must not drive the product experience. |
| :---- |

| Release rule: No capability is “done” only because code exists. A feature is release-complete only when product flow, persisted data, integration, security, accessibility, observability, and acceptance tests all pass in the target environment. |
| :---- |

# **1\. Executive Business Definition**

STRATUM Spatial Verified is an evidence-backed spatial infrastructure intelligence platform for reconstructing, understanding, operating, maintaining and cryptographically verifying physical infrastructure across its lifecycle. It is the operational product surface of a broader STRATUM ecosystem that includes STRATUM Chain, STRATUM Data Room, STRATUM AI Costing, JARVIS and governed integration/edge services.

* Spatial, not “digital twin”: STRATUM Spatial Verified is the canonical product and “spatial model” is the canonical noun.  
* One canonical infrastructure history: current state is derived from append-only, governed events; history is not silently rewritten.  
* Cryptography is necessary but insufficient for physical truth; evidence, qualified people, instrument state, provenance and governed finality remain explicit.  
* AI never equals authority. JARVIS and specialist agents may recommend, reason and orchestrate, but cannot downgrade required human or governance authority.  
* Storage is not authority. Database rows, files, indexes, spatial scenes and AI outputs carry provenance and trust classifications rather than becoming authoritative by location.  
* Provider neutrality: STRATUM Chain is an independent permissioned trust network and production operation does not depend on a public chain, token, mining or gas.  
* Safety before convenience: unsafe, ambiguous, conflicted or stale states must be surfaced rather than hidden by optimistic UX.  
* Typed boundaries: STRATUM modules exchange canonical objects/events and do not directly mutate one another’s databases.

| Business positioning: The platform must first solve real infrastructure work — project delivery, turnover, maintenance, reliability, commissioning, safety, commercial reconciliation and audit — while trust/finality operates as an evidence layer beneath those workflows. “Blockchain” is never the primary user proposition. |
| :---- |

# **2\. Business Problems to Solve**

* Project and facility information is fragmented across drawings, spreadsheets, PDFs, emails, field photos, OEM portals, CMMS/EAM systems and individual knowledge.  
* The spatial location, logical topology, configuration, evidence and operating state of an asset are rarely available in one coherent context.  
* Closeout and turnover packages are difficult to prove complete and become stale after operations begin.  
* Maintenance organizations need condition-aware, evidence-backed workflows rather than isolated recurring work orders.  
* Commissioning, safety and operational procedures require high-assurance approvals and traceable execution evidence.  
* Estimating, procurement and project controls lose context when quantities, design revisions and installed conditions diverge.  
* Clients, auditors, insurers and operators need trustworthy evidence of what was installed, changed, tested and approved without exposing unrelated confidential data.  
* Existing 3D/digital-twin experiences often visualize geometry without proving provenance, authority, configuration or trust state.  
* Complex technical platforms fail adoption when protocol, data-model and tool complexity is exposed directly to ordinary users.

# **3\. Business Objectives**

1. Create one usable STRATUM operating environment for the complete infrastructure lifecycle from source documentation through operations and retirement.  
2. Reduce time required to find asset, drawing, procedure, maintenance, commissioning and proof context from hours/days to seconds/minutes.  
3. Generate recurring service and lifecycle revenue beyond installation through maintenance, reliability, verified closeout and operational intelligence.  
4. Increase STRATUM Power proposal differentiation by offering verified spatial turnover, predictive maintenance and evidence-backed operations.  
5. Make client-facing trust demonstrable without forcing clients to understand PoVI, validators, cryptographic primitives or internal infrastructure.  
6. Create reusable canonical schemas, APIs and evidence models that support multiple project types, OEMs, jurisdictions and deployment profiles.  
7. Enable AI-assisted infrastructure work while preserving explicit human, engineering, safety and governance authority.  
8. Support provider-neutral, sovereign and air-gapped deployments where required by mission-critical customers.

# **4\. Stakeholders and Personas**

| Persona | Primary business need | Default experience |
| :---- | :---- | :---- |
| Executive / Owner | Portfolio risk, reliability, cost, compliance and value | Command Center, reports, exceptions, approvals |
| Project Manager | Project progress, changes, RFIs, procurement and turnover | Project workspace, work, approvals, reports |
| Engineer | Design intent, topology, calculations, substitutions and review | SLD/Spatial hybrid, calculations, evidence, approvals |
| Estimator | Quantities, scope, pricing and assumptions | AI Costing \+ spatial quantities \+ Data Room |
| Procurement | Submittals, OEMs, lead times, authenticity and substitution | Procurement workspace, Data Room, asset/OEM intelligence |
| Field Technician | Do assigned work quickly and safely with minimal typing | My Work, QR/NFC/camera, stepper, offline capture |
| Commissioning Agent | Execute tests, capture results, exceptions and acceptance | Commissioning plans/scripts, evidence, approvals |
| Operator / Facility Manager | Live condition, alarms, maintenance and reliability | Operations dashboard, asset drawer, maintenance, incidents |
| Safety / EHS | PTW/LOTO, hazards, high-consequence approvals | Safety workspace, approvals, incidents, audit |
| Auditor / Client | Read-only proof, provenance, closeout, trust history | Reports, provenance explorer, proof packages |
| Platform Administrator | Tenancy, users, integrations, policies and system health | Admin console without engineering/safety/PoVI authority |
| Validator / Governance Operator | PoVI network participation and governed activation | Validator console, health, certificates, governance |

# **5\. Business Capability Map**

| Capability | Business purpose |
| :---- | :---- |
| Command Center | Role-based entry point for exceptions, work, risk, approvals, system health and JARVIS. |
| Sites & Spatial | Site/building/level/room/system/asset hierarchy with 2D, SLD, Spatial 3D, Hybrid and XR representations. |
| Asset Intelligence | Persistent asset identity, configuration, health, lifecycle, maintenance, warranty, incidents and provenance. |
| Work Execution | Tasks, inspections, maintenance, QA/QC, commissioning, safety, service requests and field work. |
| Evidence & Data Room | Artifacts, documents, photos, measurements, approvals, retention, provenance and proof packages. |
| Operations | Live/near-real-time signals, alarms, procedures, reliability, predictive intelligence and incident context. |
| Trust & Verification | NDIR/MDIR/DIR, approvals, PoVI status, provenance explorer, certificates and proof verification. |
| AI Costing | Spatial quantities, estimates, scope, RFIs/RFQs, suppliers, procurement and commercial reconciliation. |
| JARVIS | Contextual AI orchestration across modules with permissions, dissent/evidence seeking and HITL escalation. |
| Studio / SIR | Governed intermediate representation for rules, workflows, contracts, OPC UA bindings and deployable logic. |
| Integrations | OPC UA, BIM/IFC/CAD/GIS, AAS, BMS/SCADA, CMMS/EAM, ERP, OEM, Data Room and external APIs. |
| Admin & Governance | Organizations, RBAC/ABAC, credentials, policy, validator governance, schemas, releases and audit. |

# **6\. Scope**

## **6.1 In scope**

* Command Center: Role-based entry point for exceptions, work, risk, approvals, system health and JARVIS.  
* Sites & Spatial: Site/building/level/room/system/asset hierarchy with 2D, SLD, Spatial 3D, Hybrid and XR representations.  
* Asset Intelligence: Persistent asset identity, configuration, health, lifecycle, maintenance, warranty, incidents and provenance.  
* Work Execution: Tasks, inspections, maintenance, QA/QC, commissioning, safety, service requests and field work.  
* Evidence & Data Room: Artifacts, documents, photos, measurements, approvals, retention, provenance and proof packages.  
* Operations: Live/near-real-time signals, alarms, procedures, reliability, predictive intelligence and incident context.  
* Trust & Verification: NDIR/MDIR/DIR, approvals, PoVI status, provenance explorer, certificates and proof verification.  
* AI Costing: Spatial quantities, estimates, scope, RFIs/RFQs, suppliers, procurement and commercial reconciliation.  
* JARVIS: Contextual AI orchestration across modules with permissions, dissent/evidence seeking and HITL escalation.  
* Studio / SIR: Governed intermediate representation for rules, workflows, contracts, OPC UA bindings and deployable logic.  
* Integrations: OPC UA, BIM/IFC/CAD/GIS, AAS, BMS/SCADA, CMMS/EAM, ERP, OEM, Data Room and external APIs.  
* Admin & Governance: Organizations, RBAC/ABAC, credentials, policy, validator governance, schemas, releases and audit.

## **6.2 Explicit business boundaries**

* The product does not represent AI output as engineering approval, field verification, code compliance, legal certification or PoVI finality unless the corresponding authority has actually been satisfied.  
* NFPA LiNK and other licensed standards are referenced through licensed/authorized access, metadata, citations, user entitlements or derived rule mappings; the product must not unlawfully copy restricted standards content.  
* The Spatial model is a governed infrastructure representation, not an unquestioned source of truth; geometry and semantics carry provenance and confidence.  
* Machine-control capabilities are governed separately from visualization and analytics and require site policy, interlocks, HITL level and authorization.  
* Public blockchains are not production dependencies. Optional compatibility/export/anchoring may exist only when policy permits and does not redefine STRATUM Chain authority.

# **7\. Business Requirements**

| ID | Business requirement | Normative statement |
| :---- | :---- | :---- |
| BR-001 | Single product identity | The entire customer-facing experience MUST use STRATUM Spatial Verified and spatial model terminology. |
| BR-002 | Lifecycle value | The platform MUST support design/procurement/installation/commissioning/operations/maintenance/change/retirement continuity. |
| BR-003 | Trust transparency | Every important state MUST expose what is known, source/provenance, trust class, approvals and finality status without presenting false certainty. |
| BR-004 | Simple adoption | A new role-appropriate user MUST be able to complete common work without learning PoVI, NDIR/MDIR/DIR internals or navigating unrelated modules. |
| BR-005 | Field usability | Field work MUST be mobile-first, task-first, offline-capable where possible, camera/QR/NFC/voice friendly and low-typing. |
| BR-006 | Commercial continuity | Spatial, costing, procurement, project-controls and installed-state changes MUST reconcile rather than becoming disconnected records. |
| BR-007 | Evidence continuity | All consequential work MUST preserve required evidence, approval and provenance through turnover and operations. |
| BR-008 | Maintenance revenue | The platform MUST convert installed asset context into maintenance plans, service work, predictive opportunities and lifecycle history. |
| BR-009 | Mission critical | Data-center/mission-critical use MUST support topology, redundancy, commissioning, procedures, capacity and high-assurance operations. |
| BR-010 | Interoperability | The platform MUST interoperate through governed connectors rather than requiring customers to replace existing BIM, BMS/SCADA, CMMS/EAM, ERP or OEM systems. |
| BR-011 | Tenant isolation | Organizations/projects/sites MUST maintain least-privilege separation while allowing governed cross-tenant shared assets where explicitly configured. |
| BR-012 | Sovereignty | Deployment options MUST include customer-controlled/private and air-gapped profiles where commercially required. |
| BR-013 | Auditability | Material changes MUST be reconstructable as who/what/when/why/evidence/approval/trust state. |
| BR-014 | Safety | Safety-critical workflows MUST declare HITL level and cannot be silently downgraded by automation. |
| BR-015 | Accessibility | The product MUST meet measurable keyboard, screen-reader, contrast, reduced-motion, touch-target and error-prevention acceptance criteria. |
| BR-016 | Proof portability | Auditors/clients MUST be able to receive bounded proof packages without broad platform access. |
| BR-017 | No silent data loss | Once work/evidence is durably accepted, overload, sync or validator catch-up MUST not silently discard it. |
| BR-018 | Role-specific value | Executive, project, engineering, field, commissioning, operations, safety, audit and admin roles MUST each receive a relevant default home surface. |
| BR-019 | Evidence-based status | Product and implementation status MUST use Implemented/Partial/Planned/Conceptually Locked and must not market planned architecture as delivered. |
| BR-020 | Continuous improvement | Requirements, schemas, event registry, test evidence and implementation status MUST remain traceable per release. |

# **8\. Business Process Model**

### **8.1 Infrastructure lifecycle**

**Source / Design  →**  Procure  **→**  Receive  **→**  Install  **→**  Inspect  **→**  Test  **→**  Commission  **→**  Energize  **→**  Operate  **→**  Maintain  **→**  Modify  **→**  Retire

### **8.2 Trust lifecycle**

**Observation / Source  →**  Nano DIR  **→**  Micro DIR  **→**  Governed validation  **→**  PoVI consensus  **→**  DIR / PFC  **→**  Canonical state

### **8.3 Commercial lifecycle**

**Scope  →**  Quantity  **→**  Estimate  **→**  Procure  **→**  Install  **→**  Change  **→**  Cost reconciliation  **→**  Closeout  **→**  Service lifecycle

# **9\. Success Measures and KPIs**

| Dimension | KPI | Target / rule |
| :---- | :---- | :---- |
| Adoption | % invited users completing core flow without support | ≥80% after onboarding iteration |
| Findability | Median time to find asset \+ evidence \+ current status | \<30 seconds for indexed/known asset |
| Field efficiency | Median taps/steps for routine assigned task | ≤5 primary steps excluding required evidence |
| Evidence completeness | Required artifacts/approvals present at closeout | ≥98% before turnover gate |
| Maintenance conversion | Installed client sites with active maintenance program | Tracked as commercial KPI by cohort |
| Data quality | Unresolved identity/topology/spatial conflicts | Trend downward; zero unresolved critical conflicts at release gate |
| Reliability | P1/P0 incidents caused by platform data loss | 0 |
| Trust clarity | States shown without trust qualifier where required | 0 critical UX defects |
| Accessibility | Critical WCAG-style acceptance failures in primary flows | 0 at release |
| Release evidence | Requirements with linked tests/evidence | 100% release-gating requirements |

# **10\. Governance and Authority**

| Level | Meaning | Business control |
| :---- | :---- | :---- |
| H0 | Automated observation / deterministic processing | No human approval required; output remains classified by source/trust. |
| H1 | AI / automation recommendation | Advisory only; cannot create high-consequence authority. |
| H2 | Human confirmation | Routine acknowledgement or low-risk evidence confirmation by authenticated user. |
| H3 | Qualified approval | Inspection, engineering review, commissioning acceptance or substitution by credentialed role. |
| H4 | Multi-party approval | Energization, high-risk commissioning/safety/commercial/engineering actions; separation of duties. |
| H5 | Safety / governance high assurance | Protocol governance, exceptional safety-critical control, catastrophic recovery or equivalent highest-assurance action. |

* Business administrators configure templates and policy but do not inherit engineering/safety/PoVI authority merely because they are administrators.  
* Corrections to authoritative records create superseding events; original evidence remains traceable.  
* Role \+ credential \+ scope \+ policy \+ evidence determine authority; UI location does not.  
* High-consequence actions require explicit separation of duties where specified.

# **11\. Commercial and Deployment Model**

| Profile | Business characteristics |
| :---- | :---- |
| Pilot | Small project, three validators, basic Data Room/Spatial, controlled scope; no unsupported PoVI claims. |
| Project | 3–6 validators, at least two failure domains, project policies, Data Room, Spatial, Costing, JARVIS. |
| Facility | 5–9 validators, site edge/OPC UA, higher availability, maintenance/commissioning/safety workflows. |
| Mission-Critical | 7+ validators across independent failure domains, strong key custody, high-assurance commissioning/safety and recovery drills. |
| Enterprise | Multi-site/multi-org, centralized governance, project-specific sub-authorities, archives/analytics/connectors. |
| Sovereign / Customer Cloud | Customer-controlled data/key residency, private cloud/on-prem, signed packages and provider-neutral recovery. |
| Air-Gapped | Independent chainId/Genesis/trust roots and offline package/proof verification with no public-internet dependency. |

# **12\. Risks and Business Controls**

| Risk | Impact | Control |
| :---- | :---- | :---- |
| Product complexity | Low adoption / user error | Enforce five-item primary navigation, role-based home, progressive disclosure and core-flow usability tests. |
| False authority | Unsafe or legally misleading output | Qualified trust labels, HITL matrix, no AI-to-authority shortcut, proof/provenance explorer. |
| Incomplete Spatial reconstruction | Bad decisions from guessed geometry | Evidence hierarchy, confidence by dimension, review queue, no inferred-as-verified rendering. |
| Standards licensing | IP/compliance risk | Licensed connectors/citations/derived mappings; do not bulk-copy restricted content. |
| Integration drift | Disconnected systems and duplicated truth | Canonical IDs/events, connectors, versioned schemas, reconciliation rules. |
| Chain overengineering | Delays core product value | Parallel UX/platform convergence while protocol work follows Redbook P0 order and evidence-based release gates. |
| CI/deployment instability | Newest code not safely promotable | Release branch gates, build/test evidence, rollback and environment health before production promotion. |
| Security/OT control | Unsafe machine action or credential compromise | Zero-trust identity, device/application certs, scoped control plane, interlocks, HITL, audit and incident response. |

# **13\. Current Business/Implementation Baseline**

| Capability | Status | Business interpretation |
| :---- | :---- | :---- |
| Validators A/B/C services | Implemented foundation | Three validator services/repositories previously deployed. |
| Canonical hashing and signed peer votes | Implemented | Canonicalization, hashing, asymmetric signatures and peer verification exist. |
| Hash-linked ledger persistence | Implemented foundation | Persistence exists for height/previous hash/proposer/votes/finalization state. |
| Current 2-of-3 serverless quorum | Implemented but non-conforming | Useful precursor only; Redbook PoVI finality requires mathematically BFT-safe supermajority. |
| Asset/project/organization access | Implemented foundation / partial | Core domain and access foundation exists; convergence and UX remain. |
| Lifecycle/evidence/provenance | Partial | Meaningful foundation exists but not complete Redbook conformance. |
| Cryptographic approvals/passkeys/separation of duties | Implemented foundation / partial | Approval safeguards exist; complete policy/HITL coverage required. |
| Lifecycle-to-ledger anchoring | Partial | Current approved lifecycle events can be anchored to precursor ledger. |
| AI Costing core | Implemented / partial | App foundation exists; canonical Spatial/Data Room/DIR integration incomplete. |
| JARVIS / MyJarvis | Implemented standalone / partial convergence | Agent infrastructure exists; unified context/authority/integration incomplete. |
| Data Room | Partial | Projects exist; canonical Artifact/Evidence Service and proof integration incomplete. |
| Spatial ingestion/reconstruction | Partial | PDF text/asset candidate extraction exists; rooms, alignment, classification and geometry remain incomplete. |
| Spatial 3D/WebGL experience | Partial / requires production verification | Viewer work exists; full end-to-end target workflows not yet proven. |
| Operational Intelligence v1 | Implemented foundation / partial expansion | Initial operational-intelligence database/platform increment previously deployed. |
| Activities / persistence / delete-restore flows | Requires verification/completion | Must be server-backed and pass full persistence tests. |
| Canonical naming migration | Partial | User-facing target is Spatial; legacy “Twin” strings may remain internally. |
| Full PoVI PROPOSE/VERIFY/LOCK/COMMIT/FINALIZE | Planned / under active development | Redbook-conformant state machine not yet production-verified. |
| PLC/PFC formal certificates | Planned / partial precursor | Signatures exist; formal lock/finality certificate semantics remain. |
| VRF/concealed proposer selection | Planned | Target architecture accepted; production implementation not verified. |
| Dynamic validator registry and governed activation | Planned / active branch work | Activation readiness and peer state work underway but latest CI failures block confidence. |
| Portable validator / Raspberry Pi | Planned / active branch work | Packaging, durable state and portable runtime not yet production-verified. |
| OPC UA Bridge / Edge Runtime | Planned | Architecture specified; implementation not verified. |
| SIR / Studio / WASM | Planned | Architecture specified; implementation not verified. |
| Formal conformance / Byzantine harness / proof verifier | Partial / planned | Some CI exists; full adversarial and independent verification suite remains. |
| Latest September 13 CI | Blocked / failing | Recent Spatial Verified / Peer Sync / Peer State Durability / Portable Validator workflows were failing; production promotion must not be assumed. |

# **14\. Release Roadmap**

| Phase | Outcome |
| :---- | :---- |
| P0 — Stabilize and simplify | Fix CI/deployment, canonical terminology, unified information architecture, user flows, design system, server-backed persistence and core Spatial correctness. |
| P1 — Spatial Verified convergence | Complete ingestion/reconstruction, evidence/provenance, Data Room integration, Asset Drawer, work/approvals, AI Costing and JARVIS shared context. |
| P2 — Trust foundation | Canonical schemas/event registry; full PoVI state machine; NDIR/MDIR/DIR; PLC/PFC; governed validator activation; proof verifier; portable validator. |
| P3 — Field / OT / engineering | OPC UA/edge, operations intelligence, commissioning, safety, QA/QC, engineering calculations, mission-critical power services. |
| P4 — Ecosystem / scale | SIR/Studio/WASM, connector suite, enterprise/sovereign deployment, XR expansion, conformance certification and scale optimization. |

# **15\. Redbook Incorporation Matrix**

| Source ID | Redbook domain | Treatment |
| :---- | :---- | :---- |
| RB-H.01 | Asset lifecycle / configuration / change / decommissioning | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.02 | Scale / performance / lossless load absorption | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.03 | Security threat model | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.04 | Time / ordering / chronology | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.05 | OPC UA / machine interaction | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.06 | STRATUM Studio / SIR | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.07 | Developer ecosystem / SDK / package registry | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.08 | BIM / CAD / SLD / document intelligence | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.09 | Compliance / audit / certification / turnover | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.10 | Energy / power systems / grid & load intelligence | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.11 | Data center / mission critical | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.12 | Field execution / QA-QC | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.13 | Safety / EHS / Permit-to-Work / LOTO | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.14 | Project controls / cost / change | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.15 | Commissioning / startup / FPT / IST | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.16 | Data architecture / storage / sync / retention / recovery | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.17 | Infrastructure / deployment / edge-cloud runtime | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.18 | Identity / organizations / multi-tenancy / RBAC-ABAC / credentials | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.19 | Interoperability / API / integration fabric | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.20 | UX / Universal Command Center / Design System | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.21 | Protocol verification / testing / conformance / benchmarking | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.22 | Governance / legal / policy / IP / commercialization | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.23 | Cryptography / PKI / key management / trust roots | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.24 | Privacy / data sovereignty / confidential computing | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.25 | Canonical schemas / ontology / event registry / API contracts | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.26 | Resource accounting / capacity / economics without tokens | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.27 | Formal PoVI protocol | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |
| RB-H.28 | Genesis / bootstrap / reference deployment | Mandatory source domain; requirements are decomposed across BRD/PRD/TRD and the agile backlog. |

# **16\. References**

| Reference | Use in STRATUM |
| :---- | :---- |
| STRATUM Redbook v1.0 | Final Consolidated & Audited Edition, 10 September 2026\. Normative internal architecture baseline. |
| NFPA 70B (2026) | Standard for Electrical Equipment Maintenance. NFPA LiNK preview confirms 2026 edition. |
| NFPA 70 / NEC (2026) | National Electrical Code. Use through licensed/authorized references and jurisdiction resolution; do not replicate restricted code text. |
| NFPA 70E (2024/current cycle) | Electrical Safety in the Workplace; complements installation and maintenance safety programs. |
| buildingSMART IFC / ISO 16739-1:2024 | Vendor-neutral digital description of built assets; IFC 4.3.2.0 is final published buildingSMART schema release while 4.4 is in development. |
| OPC UA / OPC 10000 series | Platform-independent secure interoperability and information-model architecture for industrial systems. |
| Brick Schema | Open semantic ontology for building assets, points, systems, spaces and relationships. |
| ASHRAE Standard 223P work | Semantic data model for analytics and automation applications in buildings; graph-based semantic interoperability. |

External references are used as interoperability and engineering context. Applicable code/standard obligations remain jurisdiction-, edition-, license- and project-specific and require qualified review.

INTEGRATED REVISION v2.1 — EPC LIFECYCLE, REALITY VALIDATION AND AS-BUILT CONTINUITY

Revision date: 23 September 2026

Status: Normative. This section supersedes earlier wording where a conflict exists and extends the v2.0 business baseline without removing prior requirements.

A. Revised Business Definition

STRATUM Spatial Verified is not merely a drawing-to-3D viewer. It is a governed infrastructure project and lifecycle intelligence platform that converts multi-discipline project sources into a traceable spatial model, validates designed intent against physical construction, manages discrepancies and engineering decisions, preserves approved revisions, produces evidence-backed as-built deliverables, and continues the same canonical asset identities into operations and maintenance.

The principal business lifecycle is:

Opportunity / RFP / RFQ / proposal / scope → project setup → source ingestion → engineering comprehension → spatial compilation → design validation → governed design spatial model → construction → field reality capture → reality validation → discrepancy / RFI / change / incident management → engineering decision → governed revision → commissioning → as-built compilation → audit / closeout → handover → operations / maintenance → continuous lifecycle revision.

B. Expanded Business Scope

The platform MUST support the following as first-class business capabilities:

BR-201 Multi-discipline source intelligence.

The platform shall ingest and preserve architectural, electrical, mechanical, structural, civil, SLD, equipment schedule, specification, OEM, scan, image, field-markup and other authorized project sources with provenance.

BR-202 Engineering comprehension before visualization.

The product shall evaluate source information before presenting a governed project model. Classification, extraction, cross-reference, conflict identification, scale/coordinate evidence, equipment recognition, topology candidates, specification interpretation, OEM context and confidence shall remain visible and reviewable.

BR-203 Cross-discipline power-requirement intelligence.

STRATUM shall identify powered equipment represented outside electrical drawings, including HVAC, pumps, controls, lighting, roof equipment, mechanical-room equipment and other loads; determine known or expected power requirements from source/OEM/rule context; search for corresponding electrical provisions; and surface missing, conflicting or ambiguous feeds for engineering review. Such results remain explicitly inferred until approved.

BR-204 Component mapping and learning library.

The platform shall map recognized equipment to a governed component/OEM library. When an item is not present, authorized users may research, validate and register a new component profile and, where appropriate, representative 3D geometry. New library entries require provenance, versioning and human validation before reuse.

BR-205 Governed spatial compilation.

Spatial reconstruction shall combine architectural context, physical equipment, electrical/logical topology, canonical assets, scale, X/Y/Z evidence and confidence. Absence of spatial evidence MUST NOT cause invented coordinates. Non-spatial schedule assets may exist canonically without a falsely precise position.

BR-206 Construction reality loop.

During construction, field users shall be able to capture observations, photos, video, scans, measurements, annotations and QR-linked evidence. STRATUM shall compare Designed, Observed and Verified states, identify discrepancies and create governed work, RFI, change, incident or escalation workflows.

BR-207 RFI and engineering-decision lifecycle.

A discrepancy may generate impact analysis, recommended alternatives and an RFI or change request. A returned engineering/client decision shall not overwrite prior state. Approved direction creates a new governed revision with linked source, decision, evidence and affected assets.

BR-208 Field application.

A mobile-first field/reality experience shall prioritize My Work, Scan, Capture, Report and Verify. It may operate as a focused application connected to STRATUM Spatial Verified through governed APIs/events while sharing canonical identities and evidence.

BR-209 Field-marked drawing and revision ingestion.

Redlines, field-marked drawings, revised specifications, approved submittals, RFI responses and change documents shall be re-ingestable as governed source revisions that may update the spatial model only through review and approval.

BR-210 As-built compilation.

At project closeout, STRATUM shall compile the accepted installed condition into an evidence-backed as-built state rather than treating handover as a static document dump.

BR-211 Handover package.

The target handover package includes, as applicable: final 2D documentation; final spatial model; asset registry and Asset Passports; SLD/logical topology; installation and revision history; approved RFIs and changes; inspection and field evidence; testing/commissioning results; OEM records; maintenance baseline; QR identifiers; proof/provenance package; and audit/closeout report.

BR-212 Lifecycle identity continuity.

The same canonical asset identity shall persist across design, procurement, installation, verification, commissioning, turnover, operation, maintenance, incident, repair, replacement and retirement. A lifecycle transition shall not require creating a disconnected duplicate asset.

C. Business Workflow Control Points

The following business gates are mandatory:

1\. Source provenance gate before extracted information can be treated as authoritative.

2\. Confidence/conflict gate before uncertain extraction becomes governed project state.

3\. Human-in-the-loop gate for high-consequence engineering, safety, approval and truth claims.

4\. Governed revision gate before approved changes alter canonical project state.

5\. Commissioning acceptance gate before turnover where commissioning applies.

6\. Closeout completeness gate before a project is represented as handed over.

7\. Trust qualification gate before terms such as FIELD\_VERIFIED, OEM\_VERIFIED or POVI\_VERIFIED are displayed.

D. Designed / Observed / Verified Business Semantics

Designed means approved intent represented by governed project sources.

Observed means a field condition captured by a person, device, image, scan or measurement with provenance.

Verified means a qualified approval/trust state supported by the evidence and authority required by policy.

These states MUST remain distinguishable. Visualization, AI inference, QR presence, telemetry, blockchain anchoring or document storage alone does not upgrade an observation to verified physical truth.

E. Commercial and Operational Value

The revised lifecycle supports faster design comprehension, earlier detection of cross-discipline omissions and missing power requirements, reduced field rework, more traceable RFI/change cycles, better Spatial-to-Costing reconciliation, higher-quality commissioning and turnover, an owner-ready as-built package, lifecycle continuity into operations, and defensible provenance for audit, warranty, claims and dispute review.

F. Updated Success Measures

In addition to existing measures, releases shall track source-provenance completeness, discipline classification/extraction accuracy, percentage of spatial placements with explicit scale/coordinate evidence, cross-discipline missing-power findings and resolution, component mappings with OEM/source provenance, discrepancy-to-RFI/change cycle time, approved changes represented by governed revisions, commissioning exception closure completeness, closeout package completeness, and continuity of canonical asset identity from design through operations.

G. Business Boundary

STRATUM may recommend, classify, infer, compare, calculate and orchestrate. It does not silently replace the authority of licensed design professionals, qualified field personnel, AHJs, owners or other accountable decision makers. Codes, standards, OEM documents and historical data may inform recommendations but their applicability, edition, jurisdiction and approval state MUST be explicit.

