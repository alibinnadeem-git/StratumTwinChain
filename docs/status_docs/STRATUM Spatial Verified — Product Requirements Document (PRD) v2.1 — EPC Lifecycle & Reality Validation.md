**STRATUM Power**

**STRATUM Spatial Verified**

Product Requirements Document

| Document | PRD |
| :---- | :---- |
| **Version** | 2.0 |
| **Date** | 13 September 2026 |
| **Normative baseline** | STRATUM Redbook v1.0 — Final Consolidated & Audited Edition |

Canonical naming: STRATUM Spatial Verified • STRATUM Chain • Proof of Verified Infrastructure (PoVI) • Digital Immutable Record (DIR)

# **Document Control and Governing Rules**

This PRD defines the complete product experience, information architecture, user journeys, functional requirements, interaction model, accessibility, states and release acceptance criteria. The overriding product goal is to make a technically sophisticated infrastructure platform feel simple, contextual and safe to use.

| Status discipline: Implemented \= directly verified working capability. Partial \= meaningful but incomplete capability. Planned \= specified but not verified as built. Conceptually Locked \= approved target architecture, not an implementation claim. |
| :---- |

| Supersession rule: The September 2026 Redbook and later Spatial Verified decisions supersede earlier user-facing “digital twin”, “Verified Twin”, public-chain-first, or generic blockchain terminology. Legacy internal names may remain temporarily for compatibility but must not drive the product experience. |
| :---- |

| Release rule: No capability is “done” only because code exists. A feature is release-complete only when product flow, persisted data, integration, security, accessibility, observability, and acceptance tests all pass in the target environment. |
| :---- |

# **1\. Product North Star**

| North-star experience: A user should be able to answer “Where is it? What is it? What state is it in? What happened? What do I need to do? Why should I trust this?” from one coherent context without hunting across modules. |
| :---- |

STRATUM Spatial Verified must feel like one infrastructure operating system. The product should reveal complexity only when a role or task requires it. The default user should never need to understand database boundaries, service boundaries, validator topology or cryptographic protocol mechanics to complete ordinary work.

# **2\. Product Principles**

* Spatial, not “digital twin”: STRATUM Spatial Verified is the canonical product and “spatial model” is the canonical noun.  
* One canonical infrastructure history: current state is derived from append-only, governed events; history is not silently rewritten.  
* Cryptography is necessary but insufficient for physical truth; evidence, qualified people, instrument state, provenance and governed finality remain explicit.  
* AI never equals authority. JARVIS and specialist agents may recommend, reason and orchestrate, but cannot downgrade required human or governance authority.  
* Storage is not authority. Database rows, files, indexes, spatial scenes and AI outputs carry provenance and trust classifications rather than becoming authoritative by location.  
* Provider neutrality: STRATUM Chain is an independent permissioned trust network and production operation does not depend on a public chain, token, mining or gas.  
* Safety before convenience: unsafe, ambiguous, conflicted or stale states must be surfaced rather than hidden by optimistic UX.  
* Typed boundaries: STRATUM modules exchange canonical objects/events and do not directly mutate one another’s databases.  
* Context before navigation: opening an asset, task, incident or approval preserves the current site/system/spatial context.  
* One action model: common verbs such as View, Add Evidence, Create Work, Request Approval, Compare Revision, Verify and Export behave consistently everywhere.  
* No dead ends: every entity has a universal drawer and every alert links to the underlying context and safe next action.  
* Progressive disclosure: trust/protocol detail is available but hidden until requested or required by role/risk.  
* Task-first mobile: field users land on assigned work, not a desktop dashboard squeezed onto a phone.  
* State is always visible: online/offline/sync/finality/conflict/uncertainty conditions cannot be hidden behind generic success UI.

# **3\. Simplified Information Architecture**

| Primary navigation rule: The desktop/web shell MUST expose only five primary navigation destinations plus a global Create action and contextual JARVIS/search. Everything else lives inside those destinations or entity drawers. |
| :---- |

| Primary destination | Purpose |
| :---- | :---- |
| Home | Role-based Command Center. Only exceptions and actionable information. |
| Sites | Everything physical: site → building → level → room/zone → system → asset. |
| Work | Everything to do: tasks, inspections, maintenance, commissioning, incidents, safety. |
| Verify | Everything requiring trust/approval: evidence, approvals, provenance, finality, proof. |
| Library | Data Room, drawings, procedures, standards/OEM references, reports and exports. |

## **3.1 Persistent global controls**

* Global Search / Command Palette: asset, site, room, drawing, procedure, task, incident, estimate, supplier, DIR, standard reference and action search.  
* Contextual JARVIS: always aware of current project/site/entity/role and permitted data; suggestions cite evidence and trust state.  
* Create: context-sensitive menu for Project, Asset, Work, Evidence, Incident, Change, Annotation and permitted admin objects.  
* Notifications: grouped by INFO, ACTION, APPROVAL, WARNING, CRITICAL, SAFETY, GOVERNANCE.  
* Profile/tenant/project switcher: explicit scope and environment; no silent cross-tenant context.

## **3.2 Site workspace**

| Tab | What the user sees |
| :---- | :---- |
| Overview | Critical site state, open work, risk, alerts, project/operations summary. |
| Spatial | 2D/SLD/3D/Hybrid/XR representations with synchronized selection. |
| Systems | Logical system/topology view and dependencies. |
| Assets | Filterable asset registry with status, health, trust and location. |
| Work | Tasks, maintenance, inspections, commissioning, incidents and safety work. |
| Evidence | Relevant Data Room/evidence/provenance objects in context. |
| Operations | Live and historical signals, procedures, alarms and reliability context. |
| History | Lifecycle, changes, approvals, MDIR/DIR/finality and revision timeline. |

On mobile, these tabs collapse into task-specific entry points; the field user is not forced through the full site navigation tree.

# **4\. Role-Based Home Experiences**

| Persona | Default home | Top actions |
| :---- | :---- | :---- |
| Executive / Owner | Portfolio Command Center | Review risk, approvals, KPIs, major incidents, service/reliability trends |
| PM | Project Command Center | Open issues, changes, procurement, turnover, approvals, schedule/cost exceptions |
| Engineer | Engineering workspace | Review design/spatial/topology conflicts, calculations, substitutions, approvals |
| Estimator | Costing workspace | Open estimate, spatial quantity takeoff, RFQ/RFI, supplier comparison |
| Field Technician | My Work | Start next task, scan asset, capture evidence, report issue |
| Commissioning | Commissioning queue | Execute test, capture result, manage exception, request acceptance |
| Operator | Operations center | Alarms, health, maintenance due, incidents, procedures, live systems |
| Safety | Safety queue | Permits, LOTO, critical approvals, hazards, incidents |
| Auditor / Client | Evidence & reports | Proof packages, lifecycle history, closeout and compliance evidence |
| Admin | Administration | Users, tenants, policies, integrations, system health; no inherited engineering authority |

# **5\. Core User Journeys — Release-Gating**

### **Project setup and model creation**

**Create/select project  →**  Import drawings/BIM/Data Room source  **→**  Review extracted spaces/systems/assets  **→**  Resolve uncertainty/conflicts  **→**  Publish governed spatial revision

### **Find and understand an asset**

**Search/scan QR/NFC  →**  Open Universal Asset Drawer  **→**  See spatial \+ SLD \+ state \+ work \+ evidence  **→**  Take allowed action  **→**  Return without losing context

### **Field work**

**Open My Work  →**  Select task  **→**  Follow Work Stepper  **→**  Capture readings/evidence  **→**  Submit / escalate / request approval

### **Approve or verify**

**Open Approval Inbox  →**  Review context \+ evidence \+ impact  **→**  Approve/reject/request change  **→**  Create signed event  **→**  Track finality / proof status

### **Incident response**

**Open incident  →**  See affected assets and location  **→**  Review live data/evidence/procedure  **→**  Assign/execute actions  **→**  Close with evidence and post-incident record

### **Maintenance**

**Maintenance due  →**  Plan/assign  **→**  Execute guided procedure  **→**  Record findings/parts/readings  **→**  Verify/close and update asset state

### **Commissioning**

**Select system/test  →**  Execute governed script  **→**  Capture instrument results  **→**  Resolve exceptions  **→**  Acceptance / finality / turnover

### **Operational analysis**

**Alert/anomaly/search  →**  Open affected system  **→**  View live \+ history \+ dependencies  **→**  Ask JARVIS for evidence-backed explanation  **→**  Create work/incident/change

### **Costing from Spatial**

**Open project/site scope  →**  Select spatial/system/asset scope  **→**  Generate quantities/assumptions  **→**  Review estimate and sourcing  **→**  Reconcile approved change back to project controls

### **Audit / closeout**

**Select project/system/asset  →**  Choose proof/report package  **→**  System collects evidence \+ approvals \+ DIR history  **→**  Validate completeness  **→**  Export/share controlled package

| Usability gate: Each core journey must be tested with role-appropriate users. The primary path should fit in approximately five meaningful steps; additional safety/evidence steps are allowed when required by policy and must be clearly explained. |
| :---- |

# **6\. Universal Entity Interaction Model**

## **6.1 Universal Asset Drawer**

* Identity: assetId, canonical name, OEM/model/serial, lifecycle state, operational state and trust badges.  
* Location: site/building/level/room/system, map/spatial focus and logical topology position.  
* State: live values, last-good observation, health, alarms, restrictions and uncertainty/conflict.  
* Work: maintenance, inspections, commissioning, incidents, open findings and service history.  
* Evidence: photos, documents, measurements, approvals, Data Room links and source provenance.  
* Commercial: estimate/procurement/warranty/parts/cost context where permitted.  
* Trust: NDIR/MDIR/DIR lineage, PFC/finality status, provenance graph and proof package.  
* Actions: context- and role-filtered commands only; dangerous/unavailable actions are not merely grayed without explanation.

## **6.2 Universal work item**

* Purpose and acceptance criteria  
* Affected assets/locations/systems  
* Prerequisites / permit / safety conditions  
* Step-by-step procedure  
* Required evidence/readings  
* Exception path  
* Approval/HITL requirement  
* Completion and resulting state change  
* Trust/finality state

# **7\. Spatial Experience Requirements**

| ID | Capability | Requirement |
| :---- | :---- | :---- |
| PR-SPAT-001 | Import | Users can upload/link PDF, CAD, BIM/IFC, scans, images and Data Room sources with clear processing state and recoverable errors. |
| PR-SPAT-002 | Sheet review | Each sheet has extracted title block, discipline, scale, revision, classification and confidence; user can correct before publish. |
| PR-SPAT-003 | Space extraction | Rooms/areas/levels are reconstructed as explicit geometry, not only text labels; unresolved geometry is queued for review. |
| PR-SPAT-004 | Asset extraction | Detected equipment candidates link to source evidence and confidence; duplicates/collisions are resolved through review. |
| PR-SPAT-005 | SLD-to-Spatial | Logical topology and physical coordinates remain distinct but cross-highlight; inferred physical position is labeled as inferred. |
| PR-SPAT-006 | Evidence hierarchy | Geometry confidence is tracked separately for X, Y, Z, geometry, topology and identity. |
| PR-SPAT-007 | View synchronization | Selecting an object in table, 2D, SLD, 3D, timeline or dependency graph highlights the same canonical entity. |
| PR-SPAT-008 | Revision compare | Users can compare spatial revisions and understand added/removed/moved/changed objects with source lineage. |
| PR-SPAT-009 | Quality states | Spatial revisions expose DRAFT, IMPORTED, MAPPED, VALIDATED, ENGINEERING\_REVIEWED, VERIFIED and CONFLICTED as distinct states. |
| PR-SPAT-010 | Performance | Large scenes use progressive loading/LOD and preserve usable interaction on supported devices. |
| PR-SPAT-011 | XR | XR overlays never silently overwrite canonical geometry; captured evidence includes registration/calibration provenance. |
| PR-SPAT-012 | Safe edit | Delete/restore/move/reclassify operations are server-persisted, auditable and reversible where policy allows. |

# **8\. Work, Maintenance, QA/QC, Safety and Commissioning**

| ID | Requirement |
| :---- | :---- |
| PR-WRK-001 | My Work queue is the default field surface and supports assignment, priority, site and due-state filtering. |
| PR-WRK-002 | Work Stepper shows one clear current step, required evidence, prerequisites and next safe action. |
| PR-WRK-003 | Routine evidence capture supports photo/video/voice/measurement/file/QR/NFC without navigating away from the task. |
| PR-WRK-004 | Offline work clearly distinguishes locally captured, syncing, conflict, submitted, pending approval, pending finality and finalized states. |
| PR-WRK-005 | Maintenance plans can be OEM-, condition-, standard-, site- and policy-informed without claiming automatic code compliance. |
| PR-WRK-006 | Findings can create corrective work, incidents, engineering review or procurement without re-entering asset context. |
| PR-WRK-007 | Commissioning scripts support prerequisites, instrument calibration, steps, readings, witness/approval, exception and retest. |
| PR-WRK-008 | PTW/LOTO workflows preserve physical lock/tag identity and cannot be satisfied by a generic digital checkbox. |
| PR-WRK-009 | High-consequence actions present plain-language impact and approval requirements before commitment. |
| PR-WRK-010 | All consequential completions produce append-only history and, where policy requires, MDIR/DIR finality progression. |

# **9\. Evidence, Provenance and Verification UX**

* Evidence cards show source, author/device, capture time, related entity, integrity/hash state, trust classification and retention/confidentiality where relevant.  
* Provenance Explorer answers “why is this believed?” by traversing source → evidence → approval → MDIR → DIR → PFC without requiring the user to understand protocol internals first.  
* Generic “Verified” badges are prohibited; use qualified labels such as Field Verified, OEM Verified, Source Verified, PoVI Verified, Inferred, Predicted, Unverified, Stale or Conflicted.  
* PENDING\_FINALITY and FINALIZED are visible for users whose workflow depends on them; protocol details appear in an advanced panel.  
* Proof Package export bundles bounded evidence, metadata, signatures/certificates and verification instructions appropriate to the recipient.

# **10\. JARVIS Product Requirements**

| ID | Requirement |
| :---- | :---- |
| PR-AI-001 | JARVIS is contextual in every major surface; it is not a disconnected chat page. |
| PR-AI-002 | Every answer/recommendation identifies relevant project/site/entity context and cites underlying evidence or explicitly states uncertainty. |
| PR-AI-003 | JARVIS can propose actions but only invokes tools/actions allowed by user role, policy, HITL and environment. |
| PR-AI-004 | Specialist agents may disagree; JARVIS should surface material dissent/evidence gaps rather than collapsing uncertainty into one confident answer. |
| PR-AI-005 | AI-generated/inferred/predicted outputs keep their trust label until stronger evidence changes the classification. |
| PR-AI-006 | High-consequence workflows require explicit confirmation/approval and cannot be completed solely through conversational ambiguity. |
| PR-AI-007 | JARVIS can create structured drafts: work orders, investigation plans, inspection steps, change analyses, reports and queries, subject to governed review. |
| PR-AI-008 | AI provenance records model/provider/version/prompt-context/tool calls/output hash where policy requires auditability. |

# **11\. AI Costing and Commercial UX**

* AI Costing consumes canonical project/site/system/asset/spatial quantities rather than maintaining a separate competing asset truth.  
* Users can select scope directly in Spatial/SLD and send it to estimate with assumptions and source revision preserved.  
* Costing surfaces distinguish measured/extracted/inferred quantities and show unresolved scope assumptions.  
* Approved commercial changes reconcile back to project controls and affected spatial/configuration scope.  
* Supplier/OEM alternatives include technical/evidence compatibility and PESTEL/commercial reasoning without silently overriding engineering approval.

# **12\. Search, Notifications and Approvals**

* Universal Search spans structured entities and Data Room artifacts, with trust-aware result snippets and scope filters.  
* Command Palette supports direct actions such as “scan asset”, “create incident”, “open room ER-101”, “show pending approvals”, and “compare revision”.  
* Notification center groups by severity/class, supports acknowledgement/assignment/escalation/resolve, and deep-links to context.  
* Unified Approval Inbox spans engineering, RFI/change, procurement, estimate, commissioning, safety, machine action, validator governance and SIR/contract deployment.  
* Approval cards show impact, evidence completeness, conflict/uncertainty, approver role requirement and what canonical state will change.

# **13\. Interaction and State Design System**

| Component | Required behavior |
| :---- | :---- |
| Asset Card | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Trust Badge | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Status Chip | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| DIR Badge | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Approval Card | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Incident Card | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Evidence Card | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Spatial Panel | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| SLD Viewer | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Timeline | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Dependency Graph | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Notification | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Data Table | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Command Palette | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| JARVIS Panel | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Risk Indicator | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Provenance Drawer | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |
| Work Stepper | Uses shared semantic tokens, keyboard/focus states, loading/empty/error/offline states and consistent action placement. |

| Semantic token family | Examples |
| :---- | :---- |
| Trust/finality | Observed, source verified, field verified, PoVI verified, pending finality, finalized |
| Uncertainty | Inferred, predicted, stale, uncertain, conflicted, unverified |
| Hazard | Informational through safety-critical severity with explicit text/icon, not color alone |
| Operational | Normal, degraded, alarm, out-of-service, restricted, maintenance |
| Approval | Not required, required, pending, approved, rejected, expired/superseded |
| Connectivity | Online, offline, syncing, conflict, server unavailable |
| Privacy | Public/client-visible/internal/confidential/restricted |

# **14\. Accessibility and Responsive Requirements**

* All primary flows must be keyboard operable with visible focus and logical order.  
* Screen-reader labels and landmarks must communicate entity, state, trust and action context.  
* Status may not rely on color alone; icon \+ text/label are required for consequential states.  
* Respect reduced-motion preference; 3D transitions and animated topology must have low-motion modes.  
* Touch targets and field controls must support gloved/one-hand use where practical; critical buttons are not tightly clustered.  
* Error prevention: destructive or high-consequence actions require contextual confirmation, impact explanation and safe undo/recovery where possible.  
* Responsive behavior is designed, not merely wrapped: mobile prioritizes My Work/scan/capture; tablet supports field spatial/SLD; desktop supports multi-pane analysis.

# **15\. Product Integrations**

| Integration | Product behavior |
| :---- | :---- |
| STRATUM Data Room | Artifacts/evidence/source control; linked rather than copied where policy permits; canonical IDs preserved. |
| STRATUM AI Costing | Spatial quantities, scope and revision context; approved commercial outcomes reconcile back. |
| STRATUM Chain | Finality/proof; protocol detail progressively disclosed; no public-chain dependency. |
| OPC UA / edge | Live/historical industrial data, alarms/events and governed control; source quality preserved. |
| BIM/IFC/CAD/GIS | Geometry, semantics, topology and revision sources with provenance/confidence. |
| BMS/SCADA/CMMS/EAM/ERP | Operational and enterprise interoperability through versioned connectors. |
| OEM / standards knowledge | Licensed/reference knowledge mapped to asset types, procedures and jurisdiction context. |
| XR / reality capture | Field registration, evidence and deviation capture; no silent canonical overwrite. |

# **16\. Analytics and Product Telemetry**

* Track flow completion, abandonment, time-to-task, error rate, search success, number of context switches and support/escalation triggers.  
* Track confusion indicators: repeated back navigation, duplicate action attempts, dead-end views, generic error dialogs and unresolved conflicts.  
* Do not log confidential infrastructure content into analytics systems unless explicitly approved and appropriately protected.  
* Every release candidate includes a UX regression suite for the ten core user journeys and the most important role-specific flows.

# **17\. Product Acceptance / Definition of Done**

| Gate | Required condition |
| :---- | :---- |
| Flow | Primary journey is coherent, role-appropriate and no known dead end remains. |
| Data | All mutations persist server-side and reload correctly; offline conflicts are explicit. |
| Integration | Upstream/downstream integrations preserve IDs, revisions, provenance and error handling. |
| Trust | Trust/authority/finality labels are accurate; generic “verified” is not used where ambiguous. |
| Security | Authorization and tenant boundaries are tested; high-consequence actions respect HITL. |
| Accessibility | Keyboard/screen-reader/contrast/touch/reduced-motion acceptance tests pass. |
| Responsive | Phone/tablet/desktop layouts are tested for supported flows. |
| Performance | Loading and interaction budgets pass on representative project data. |
| Observability | Action, error, integration and background-job failures are diagnosable. |
| Evidence | Requirement → code/module → test → release evidence is linked. |
| Production | Build/CI/deployment health is green and rollback is proven before status becomes Implemented. |

# **18\. Current Product Gap Summary**

| Capability | Status | Product consequence |
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

# **19\. Prioritized Product Roadmap**

| Release | Product outcome |
| :---- | :---- |
| Now / Release 0 | Unified shell, five primary nav destinations, role homes, persistent entity drawer, server-backed state, terminology cleanup, CI stabilization, accessibility foundations. |
| Release 1 | Complete PDF/BIM spatial review flow, rooms/sheet metadata/alignment, view synchronization, revision compare, evidence/provenance, Data Room convergence. |
| Release 2 | Work/maintenance/commissioning/safety end-to-end flows, Operational Intelligence expansion, JARVIS context, AI Costing round-trip. |
| Release 3 | PoVI-compliant trust flow, proof explorer/export, validator/governance UX, portable verification. |
| Release 4 | OPC UA/edge, live operations, XR/field spatial, SIR/Studio and enterprise connector expansion. |

# **20\. References**

| Reference | Use in product |
| :---- | :---- |
| STRATUM Redbook v1.0 | Final Consolidated & Audited Edition, 10 September 2026\. Normative internal architecture baseline. |
| NFPA 70B (2026) | Standard for Electrical Equipment Maintenance. NFPA LiNK preview confirms 2026 edition. |
| NFPA 70 / NEC (2026) | National Electrical Code. Use through licensed/authorized references and jurisdiction resolution; do not replicate restricted code text. |
| NFPA 70E (2024/current cycle) | Electrical Safety in the Workplace; complements installation and maintenance safety programs. |
| buildingSMART IFC / ISO 16739-1:2024 | Vendor-neutral digital description of built assets; IFC 4.3.2.0 is final published buildingSMART schema release while 4.4 is in development. |
| OPC UA / OPC 10000 series | Platform-independent secure interoperability and information-model architecture for industrial systems. |
| Brick Schema | Open semantic ontology for building assets, points, systems, spaces and relationships. |
| ASHRAE Standard 223P work | Semantic data model for analytics and automation applications in buildings; graph-based semantic interoperability INTEGRATED REVISION v2.1 — CANONICAL CUSTOMER PROJECT WORKFLOW Revision date: 23 September 2026 Status: Normative. This section extends the PRD v2.0 and supersedes conflicting product-flow wording. A. Product Experience Model The primary application remains intentionally simple: Home → Sites → Work → Verify → Library Global/contextual capabilities remain Search / Command Palette \+ JARVIS. The customer-facing lifecycle is now explicitly defined as a construction/EPC and asset-lifecycle workflow, not merely a software feature flow. The Spatial Viewer MUST remain hidden or clearly empty until project sources have been ingested, parsed and compiled into project entities. Demo/reference geometry MUST remain visibly separate from project data. B. Canonical Product Workflow The product MUST support the following end-to-end phases: Phase 0 — Opportunity / Preconstruction RFP, RFQ, proposal, scope, schedule, budget and preconstruction context may be linked as project sources and commercial context. Phase 1 — Project Setup Authenticate → resolve tenant/organization/role → select or create site/project → configure participants, disciplines, permissions and project phase. Phase 2 — Engineering Source Ingestion Upload/link architectural, electrical, mechanical, structural, civil, SLD, schedules, specifications, OEM records, scans, photos, field markups and authorized project documents. Preserve originals and provenance. Phase 3 — AI Engineering Comprehension Classify files/sheets → extract title blocks/text/symbols/schedules → identify asset candidates → cross-reference disciplines → identify topology candidates → interpret scale/coordinate evidence → apply authorized OEM/code/standards/historical context → score confidence → surface conflicts. Phase 4 — Spatial Compilation Create L1 architectural context, L2 physical infrastructure, L3 logical/electrical relationships and L4 canonical assets. Match components to the governed library. Build 2D/SLD/3D/table/timeline/dependency representations of the same canonical entities. Phase 5 — Design Validation Present extraction review, confidence, conflicts, missing information, cross-discipline discrepancies and expected-power findings. High-consequence decisions invoke the appropriate H0–H5 human-review level. Phase 6 — Governed Design Spatial Model Publish a governed revision only after required review. Users can navigate synchronized 2D, SLD, 3D Spatial, table, timeline and dependency views. Phase 7 — Construction Create/consume work packages, installation activities, task assignments, field progress and asset lifecycle updates against the governed design revision. Phase 8 — Field Reality Capture Mobile experience prioritizes My Work, Scan, Capture, Report and Verify. Capture photo, video, measurement, annotation, scan, QR-linked observation, redline and field note with provenance. Phase 9 — Reality Validation Compare Designed ↔ Observed ↔ Verified. Show discrepancies without silently changing truth state. Highlight expected-vs-actual equipment, position, rating, connection, route and power provision. Phase 10 — Discrepancy Management Create issue, impact analysis, suggested alternatives and, where appropriate, RFI, change request, incident, NCR/CAR or work item. Preserve the affected drawing/model/asset context. Phase 11 — Engineering Decision Route to responsible reviewer/engineer/client/authority. Record response, approval/rejection/request-for-information, sign-off and applicable trust state. Phase 12 — Governed Revision Approved direction creates a new revision; prior revision remains preserved. Updated drawings, specifications, RFI responses, change documents and field-marked drawings may be re-ingested as new sources. Phase 13 — Commissioning Test → script/procedure → results → exceptions → corrective action → acceptance/turnover. Link results to canonical assets and evidence. Phase 14 — As-Built Compilation Compile accepted installed condition from approved changes, field evidence, redlines, commissioning results and validated asset state into final 2D/as-built spatial deliverables. Phase 15 — Audit / Closeout / Handover Check completeness → generate proof/report package → export/share final 2D, spatial model, asset registry/Passports, topology, RFI/change history, evidence, commissioning, OEM, maintenance baseline, QR and trust records. Phase 16 — Operations Continue the same asset identities into live/history/dependency context, telemetry, maintenance, incidents, reliability, JARVIS analysis and work creation. Phase 17 — Continuous Lifecycle Maintenance, repair, replacement, renovation and operational change create new governed events/revisions rather than disconnected copies. C. New / Expanded Product Requirements PR-201 Cross-discipline powered-equipment discovery. The user shall be able to see equipment that requires power even when it appears only on architectural/mechanical/civil/other source material. The system shall display expected load/feed reasoning, source provenance and confidence and search for matching electrical provision. PR-202 Missing-power review. When the expected electrical provision cannot be confidently found, the product shall create a reviewable finding with affected equipment, basis, expected requirement, search scope, confidence and recommended next action. It MUST NOT present the finding as verified fact until approved. PR-203 Component-library feedback loop. Asset recognition shall search the governed component/OEM library. If no suitable component exists, an authorized workflow shall allow source research, OEM data attachment, dimensional/spec validation, representative 3D creation/acquisition and library registration. New entries shall be versioned and reviewable. PR-204 Spatial placement truth. The UI shall differentiate known, inferred, approximate and unknown position/scale. Schedule-only assets may be visible in lists/topology without invented XYZ. PR-205 Construction comparison workspace. Users shall be able to compare governed design content against field evidence and spatial context and inspect changes by object, location, specification, topology and source. PR-206 RFI generation from context. From a discrepancy, users shall be able to generate an RFI draft containing project/site, affected asset/location, source references, annotated evidence, problem statement, impact, suggested alternatives and requested decision. JARVIS may assist but approval/issuance follows role policy. PR-207 Response-to-revision workflow. An RFI or change response shall be attachable to the affected issue and, if approved, create a governed change set and new project/spatial revision. No silent overwrite is permitted. PR-208 Focused Field / Reality application. A field-focused app or surface may be deployed separately from the desktop product while using the same identity, asset, work, evidence, annotation, incident, RFI and HITL services through authenticated typed APIs/events. PR-209 Field-marked drawings. Users shall be able to upload revised/marked drawings and specifications, associate them to project revision/change context, compare them to prior sources and update the spatial model only through governed review. PR-210 As-Built Mode. At closeout the product shall provide an explicit As-Built state/view representing accepted installed condition and distinguish it from historical design revisions. PR-211 Handover completeness. The Audit/Closeout journey shall show required vs present deliverables and evidence classes, unresolved exceptions and export/share readiness. PR-212 Canonical identity across all views. The same asset ID shall resolve across Search, QR, Asset Drawer/Passport, 2D, SLD, 3D, tables, work, maintenance, incidents, commissioning, costing and audit. D. Updated Release-Gating Journeys UX-01 Project/model: Project → Import → Parse/Comprehend → Review extraction → Resolve conflicts → Spatial compile → Publish governed revision. UX-02 Asset: Search/scan/model click → Asset Drawer/Passport → identity/spec/topology/lifecycle/evidence/trust → contextual action → return in context. UX-03 Field: My Work → Task/asset → Work Stepper → Scan/Capture → Submit/escalate. UX-04 Verify: Approval Inbox → evidence/source/impact → decision → signed event → trust/finality status. UX-05 Incident/discrepancy: detect/capture → affected context → compare designed/observed → actions/RFI/change → evidence-backed close. UX-06 Maintenance: due/condition finding → plan/assign → procedure → readings/findings → verify/close. UX-07 Commissioning: test → script → results → exceptions → corrective work → acceptance/turnover. UX-08 Operations: alert/search → asset context → live/history/dependencies → JARVIS → work/incident/change. UX-09 Costing: governed spatial scope → quantities → estimate/sourcing → approved-change reconciliation. UX-10 Audit: closeout scope → required artifacts/evidence → completeness → proof/report package → export/share/handover. E. Interaction and Truth Rules 1\. One clearly sourced project viewer at a time. 2\. Project geometry appears only after source processing/compilation. 3\. Demo/reference content is visually distinct from project content. 4\. Asset click always resolves to meaningful canonical context. 5\. Designed, Observed and Verified are separate UI states. 6\. Trust outcome is shown before protocol detail; PoVI internals use progressive disclosure. 7\. AI-generated/inferred recommendations carry provenance and confidence. 8\. Approved changes create a new governed revision. 9\. Mobile defaults to task completion, scanning and evidence capture rather than desktop complexity. 10\. No workflow ends in a dead end; each exception exposes a next governed action. F. As-Built / Handover Product Package The target closeout experience shall support final 2D drawings, final spatial model, Asset Passports, logical/SLD topology, installation history, approved RFIs/changes, field/inspection evidence, test and commissioning records, OEM documentation, maintenance baseline, QR identifiers, proof/provenance package and audit report. . |

