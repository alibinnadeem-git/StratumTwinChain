**STRATUM Power**

**STRATUM Spatial Verified**

Technical Requirements Document

| Document | TRD |
| :---- | :---- |
| **Version** | 2.0 |
| **Date** | 13 September 2026 |
| **Normative baseline** | STRATUM Redbook v1.0 — Final Consolidated & Audited Edition |

Canonical naming: STRATUM Spatial Verified • STRATUM Chain • Proof of Verified Infrastructure (PoVI) • Digital Immutable Record (DIR)

# **Document Control and Governing Rules**

This TRD defines the target technical architecture, canonical data and event boundaries, trust protocol integration, spatial reconstruction, AI orchestration, security, deployment, observability, testing and release engineering for STRATUM Spatial Verified and its surrounding STRATUM ecosystem.

| Status discipline: Implemented \= directly verified working capability. Partial \= meaningful but incomplete capability. Planned \= specified but not verified as built. Conceptually Locked \= approved target architecture, not an implementation claim. |
| :---- |

| Supersession rule: The September 2026 Redbook and later Spatial Verified decisions supersede earlier user-facing “digital twin”, “Verified Twin”, public-chain-first, or generic blockchain terminology. Legacy internal names may remain temporarily for compatibility but must not drive the product experience. |
| :---- |

| Release rule: No capability is “done” only because code exists. A feature is release-complete only when product flow, persisted data, integration, security, accessibility, observability, and acceptance tests all pass in the target environment. |
| :---- |

# **1\. Target Architecture**

The system is a modular infrastructure operating and trust ecosystem. STRATUM Spatial Verified is the main product surface; STRATUM Chain supplies governed canonical finality; Data Room supplies artifact/evidence services; AI Costing supplies estimating/commercial intelligence; JARVIS supplies governed AI orchestration; SIR/Studio and OPC UA/edge provide deterministic workflow and industrial integration.

### **Logical data/trust flow**

**Sources / Sensors / Human actions  →**  Canonical entities \+ evidence  **→**  Nano DIR  **→**  Micro DIR  **→**  PoVI  **→**  DIR \+ PFC  **→**  Canonical state / proof

### **Spatial intelligence flow**

**PDF/CAD/BIM/scan/SLD  →**  Extraction \+ classification  **→**  Semantic graph  **→**  Geometry reconstruction  **→**  Conflict review  **→**  Governed Spatial revision  **→**  Operations / XR / Costing

# **2\. Architecture Principles and Boundaries**

* Spatial, not “digital twin”: STRATUM Spatial Verified is the canonical product and “spatial model” is the canonical noun.  
* One canonical infrastructure history: current state is derived from append-only, governed events; history is not silently rewritten.  
* Cryptography is necessary but insufficient for physical truth; evidence, qualified people, instrument state, provenance and governed finality remain explicit.  
* AI never equals authority. JARVIS and specialist agents may recommend, reason and orchestrate, but cannot downgrade required human or governance authority.  
* Storage is not authority. Database rows, files, indexes, spatial scenes and AI outputs carry provenance and trust classifications rather than becoming authoritative by location.  
* Provider neutrality: STRATUM Chain is an independent permissioned trust network and production operation does not depend on a public chain, token, mining or gas.  
* Safety before convenience: unsafe, ambiguous, conflicted or stale states must be surfaced rather than hidden by optimistic UX.  
* Typed boundaries: STRATUM modules exchange canonical objects/events and do not directly mutate one another’s databases.  
* Each module owns its persistence and publishes/consumes typed contracts; direct cross-database writes are prohibited.  
* Canonical identifiers are stable and never silently recycled.  
* Operational databases, artifact stores, search indexes, analytics stores and chain storage are separate authority classes.  
* High-volume NDIR/telemetry processing is isolated from live consensus, catch-up, archive queries and explorer traffic.  
* All externally visible schemas/protocols are versioned and backward-compatibility policy is explicit.

# **3\. Service / Module Decomposition**

| Service / plane | Responsibility |
| :---- | :---- |
| Web / Mobile Client | Role-aware UI shell, offline cache, Spatial/SLD viewer, work/evidence capture, JARVIS interface. |
| API Gateway / BFF | Session/tenant context, aggregation, rate limits, policy checks and client-oriented contracts. |
| Identity & Policy | Organizations, users, roles, attributes, credentials, passkeys, service/device identity, HITL policy. |
| Project/Site/Asset Service | Canonical lifecycle, configuration, relationships, operational state and asset identity. |
| Spatial Service | Revisions, coordinate frames, layers, geometry, topology mapping, view synchronization and spatial queries. |
| Document Intelligence | PDF/CAD/BIM/SLD parsing, OCR when necessary, title blocks, symbols, schedules, sheet metadata and extraction jobs. |
| Semantic Graph / Ontology | Asset/system/space/point relationships, mappings to Brick/223/IFC/AAS and canonical taxonomy. |
| Work Service | Tasks, inspections, maintenance, QA/QC, commissioning, safety, incidents and procedures. |
| Evidence / Data Room Service | Artifacts, metadata, provenance, retention, confidentiality, hash/integrity and bounded proof packages. |
| Operations / Telemetry | OPC UA ingestion, live/historical values, alarms/events, quality, reliability and rules. |
| Approval / Authority Service | Action-bound approvals, separation of duties, HITL levels and signed attestations. |
| NDIR/MDIR Pipeline | Observation normalization, durable queues, aggregation, idempotency, validation and consensus-ready MDIRs. |
| PoVI / Validator Runtime | PROPOSE/VERIFY/LOCK/COMMIT/FINALIZE, PLC/PFC, proposer selection, governance, catch-up and snapshots. |
| Independent Proof Verifier | Verifies DIR/PFC/snapshot/proof packages without trusting application databases. |
| JARVIS Orchestrator | Context, agent registry, model routing, tool permissions, dissent/evidence seeking, HITL escalation. |
| AI Costing | Estimates, quantity takeoff, RFIs/RFQs, suppliers, commercial reconciliation and project controls integration. |
| Studio / SIR Runtime | Governed authored workflows/rules/contracts/OPC bindings compiled to deterministic execution targets. |
| Search / Indexing | Trust-aware indexing across canonical entities and permitted artifacts; index never becomes authority. |
| Observability / Audit | Logs, traces, metrics, security audit, release evidence, SLOs and incident management. |

# **4\. Canonical Data Model**

| Entity | Purpose |
| :---- | :---- |
| Organization | Tenant / governance scope; owns policy and memberships. |
| Project | Delivery scope, contractual and project-control context. |
| Site | Physical operational location. |
| Building/Level/Space | Spatial containment hierarchy. |
| System | Logical/functional system or loop. |
| Asset | Persistent physical equipment identity. |
| Port/Connection | Logical/physical connectivity and interface. |
| ConfigurationRevision | Versioned design/procured/factory/installation/commissioning/as-built/operational configuration. |
| SpatialRevision | Versioned geometry/placement/coordinate model with provenance/confidence. |
| EvidenceArtifact | File/media/measurement/document or external source reference with integrity and policy metadata. |
| WorkItem | Task/inspection/maintenance/commissioning/safety/incident action. |
| Approval | Action-bound human/governance authorization record. |
| Observation / NDIR | Granular source-centric cryptographically referencable observation. |
| Micro DIR | Meaningful signed infrastructure event/candidate state transition. |
| DIR | PoVI-finalized canonical consensus unit. |
| PFC / PLC | Finality and lock certificate objects. |
| Procedure / SIR | Governed executable workflow/rule representation. |
| TelemetryBinding | OPC UA or other source binding with quality and identity. |
| Estimate / CostItem | Commercial scope and quantity/pricing object tied to canonical project/spatial entities. |
| Incident | Operational/safety/quality event workspace and timeline. |

# **5\. Authority and Data Classification**

* Every canonical object declares authorityClass, retentionClass, confidentiality, availabilityRequirement, reconstructionCapability and storagePolicy.  
* Authority derives from provenance, signatures, applicable approvals, canonical state, PoVI finality and trust classification; storage location is never sufficient.  
* Trust vocabulary is stable: POVI\_VERIFIED, FIELD\_VERIFIED, SURVEYED, SCANNED, OEM\_VERIFIED, SOURCE\_VERIFIED, LIVE, STALE, UNCERTAIN, CONFLICTED, INFERRED, PREDICTED, AI\_GENERATED, UNVERIFIED.  
* Approved, Verified, Commissioned, Finalized, Live and Certified remain independent dimensions.

# **6\. NDIR / MDIR / DIR Pipeline**

| Object | Technical rule |
| :---- | :---- |
| NDIR | Smallest granular observation/evidence/data unit; high-volume; usually not independently PoVI-finalized. |
| MDIR | Meaningful signed infrastructure event/state transition referencing one or more NDIRs/evidence objects. |
| Consensus-ready MDIR | Deterministically validated, idempotent, policy-complete event admitted to consensus ingress. |
| DIR | PoVI-finalized unit containing canonical ordered MDIRs/roots and previous-chain linkage. |
| PFC | Proof that mathematically BFT-safe COMMIT quorum satisfied finality for a DIR. |

* Ingress states: RECEIVED → DURABLY\_QUEUED → PREVALIDATING → CONSENSUS\_READY → PROPOSED → FINALIZED.  
* Idempotency key per MDIR prevents duplicate state transitions across retries.  
* Bounded backoff with jitter; explicit rejection reasons; no silent dropping after durable acceptance.  
* NDIRs may be aggregated with deterministic batches/Merkle roots while preserving item-level verification path.  
* Separate worker/resource pools for live consensus, new MDIR ingress, validator catch-up, snapshot transfer, archive and explorer traffic.

# **7\. PoVI Technical Requirements**

| ID | Requirement |
| :---- | :---- |
| TR-POVI-001 | Implement explicit height/round state machine with PROPOSE → VERIFY → LOCK → COMMIT → FINALIZE and ROUND\_CHANGE. |
| TR-POVI-002 | Finality quorum must use mathematically BFT-safe supermajority; specialist/evidence thresholds must not be labeled finality quorum. |
| TR-POVI-003 | Persist crash-safe locks/votes so validator restart cannot violate safety. |
| TR-POVI-004 | Formal PLC and PFC objects use canonical schemas and signatures. |
| TR-POVI-005 | Concealed randomized proposer selection is required; round-robin is not the target. |
| TR-POVI-006 | Fallback proposer selection may use the locked emergency fallback only when primary randomness is unavailable and must revert on subsequent transactions/rounds per policy. |
| TR-POVI-007 | Validator enrollment/activation/removal is governance-controlled and activates only at future safe heights. |
| TR-POVI-008 | SYNC\_HEAD / SYNC\_PROOF style peer traffic is read-only and cannot grant consensus participation to non-active validators. |
| TR-POVI-009 | Snapshot/catch-up verifies Genesis/trust roots, validator set, continuity, DIR/PFC proofs before advancing durable locally verified head. |
| TR-POVI-010 | Emergency suspension may stop unsafe progress but must never rewrite finalized history. |
| TR-POVI-011 | No mining, public token, staking or gas dependency is introduced into canonical protocol. |
| TR-POVI-012 | Protocol conformance requires adversarial tests for equivocation, partitions, crash/restart, stale peers, invalid certificates, replay and byzantine messages. |

# **8\. Spatial Reconstruction Architecture**

| Stage | Technical behavior |
| :---- | :---- |
| Ingest | PDF, CAD, DXF/DWG adapter, IFC/BIM, images/scans, point cloud/LiDAR, SLD, schedules, Data Room sources. |
| Document classification | Sheet type, discipline, revision, title block, scale, coordinate hints, references and confidence. |
| Extraction | Text, symbols, lines/polygons, rooms, equipment candidates, schedules, tags, ports and logical relationships. |
| Semantic normalization | Map candidates to canonical asset/system/space ontology and retain source-specific identifiers. |
| Geometry reconstruction | Resolve X/Y from plans and Z from floors/elevations/sections/BIM/OEM dimensions/field evidence. |
| Topology reconciliation | Separate SLD logical topology from physical routes/placement; link them through canonical IDs. |
| Conflict engine | Detect duplicate identities, source disagreement, geometry conflict, revision conflict and insufficient evidence. |
| Human review | Queue unresolved/high-impact changes with source overlays and confidence by X/Y/Z/geometry/topology/identity. |
| Spatial revision | Publish immutable/versioned revision state with provenance and quality classification. |
| Consumers | WebGL/3D, 2D/SLD/Hybrid, XR, AI Costing, operations, QA/QC, commissioning and proof packages. |

## **8.1 Evidence hierarchy for physical placement**

### **Placement precedence**

**LiDAR / verified scan  →**  As-built BIM/IFC  **→**  Survey / field measurement  **→**  Approved architecture/MEP  **→**  Elevations/sections  **→**  Riser/schedules  **→**  OEM dimensions  **→**  Verified photo/capture  **→**  OPC binding  **→**  SLD  **→**  AI/geometric inference

* Maintain zFloor, zBase, zCenter, zTop, mountingElevation, connection elevations and clearance volumes where available.  
* Use global/site/building/level/room/equipment datum hierarchy with coordinate reference metadata.  
* Route reconstruction uses ports, permitted zones, bend radii, clearances and obstacles rather than unconstrained AI guessing.  
* Progressive detail states: S0 Logical, S1 Approximate, S2 Drawing-derived, S3 Coordinated, S4 Field-verified, S5 Verified As-Built.  
* XR session drift correction must not mutate canonical geometry.

# **9\. Semantic Model and Standards Mapping**

* Canonical STRATUM ontology remains the internal contract while maintaining explicit mappings to IFC, Brick, ASHRAE 223 concepts, AAS and customer/OEM schemas.  
* Brick is useful for building assets, points, systems, locations and operational relationships; IFC supplies geometry and built-asset semantics; ASHRAE 223P-style graph semantics inform analytics/automation interoperability.  
* Mappings are versioned and bidirectional where feasible; imported semantics retain source namespace and confidence.  
* Semantic drift is tested with schema fixtures and migration rules.

# **10\. Data Architecture and Storage**

| Store | Role |
| :---- | :---- |
| Transactional relational DB | Organizations/projects/assets/work/approvals/configurations/state; strong integrity and tenant isolation. |
| Artifact/object store / Data Room | Large files/media/proof packages with retention and content hash. |
| Graph/semantic store | Ontology and relationship traversal; may be RDF/SPARQL-compatible or equivalent canonical graph layer. |
| Time-series store | High-volume telemetry and derived trends; source quality and timestamp semantics preserved. |
| Search index | Derived index for discovery; rebuildable and non-authoritative. |
| Chain/validator store | DIRs, certificates, validator state, durable locks/votes, snapshots and peer sync state. |
| Cache / offline client | Bounded, encrypted local data for assigned workflows; conflict-aware synchronization. |

# **11\. API and Event Contract Requirements**

* REST/GraphQL/client APIs may vary by service, but canonical mutation semantics and event schemas are versioned under a shared registry.  
* Every state-mutating command carries actor/service identity, tenant/project scope, idempotency key, correlation/causation IDs, expected version where needed and policy context.  
* Events use SCREAMING\_SNAKE\_CASE constants and canonical IDs such as assetId, projectId, organizationId, spatialRef, evidenceId, microDirId, validatorId.  
* No untyped event may mutate canonical state.  
* Protocol namespaces use explicit versions (for example POVI/1, STRATUM-SCHEMA/1, SIR/1); immutable published schemas require migration rather than in-place semantic redefinition.

# **12\. Identity, RBAC/ABAC and Credentials**

* Human, service, application, device, edge gateway and validator identities are distinct principals.  
* Authorization combines role, attributes, tenant/project/site scope, credential status, object state, HITL policy and action risk.  
* Admin permission is not engineering/safety/machine-control/validator authority.  
* Passkeys/WebAuthn or equivalent strong signing may be required for governed approvals.  
* Certificates/keys support rotation, revocation, expiration, hardware-backed custody where applicable and explicit trust roots.

# **13\. OPC UA and Edge Runtime**

* OPC UA is the preferred industrial interoperability foundation for secure client/server and PubSub integration where supported.  
* Bindings map OPC nodes/variables/events to canonical asset/system/point identities while preserving source timestamps, quality/status and engineering units.  
* Control/write operations are a separate governed capability from read/observe; site interlocks and machine safety remain authoritative.  
* Edge runtime buffers through outages, signs/identifies source, supports store-and-forward and never fabricates continuity.  
* Connector failures degrade observability but must not corrupt canonical asset identity or silently convert stale values into live state.

# **14\. JARVIS / AI Technical Architecture**

* Central orchestrator maintains current user/tenant/project/entity context, task intent, permitted tools and evidence scope.  
* Specialist agents are registered with declared capability, data access, action permissions, risk class, model requirements and evaluation suite.  
* Tool calls are typed and policy-evaluated; free-form model output cannot directly mutate canonical state.  
* Dissent/evidence seeking is a first-class orchestration behavior for materially uncertain/high-impact questions.  
* Prompt/tool/model/output provenance is captured according to confidentiality and audit policy.  
* Sensitive spatial/XR/OT context requires privacy-impact controls and least-privilege retrieval.

# **15\. SIR / Studio / Programmability**

* Priority order: Native PoVI modules \> STRATUM DSL/SIR \> sandboxed deterministic WASM \> optional EVM compatibility.  
* SIR expresses workflows, rules, contracts, OPC UA bindings, validation and deployment intent in a governed intermediate representation.  
* Execution must be deterministic, resource-bounded and versioned; high-risk rule changes require governed future activation.  
* Package registry and developer SDK preserve signatures, dependencies, compatibility metadata and supply-chain provenance.

# **16\. Security Requirements**

| Threat | Required controls |
| :---- | :---- |
| Identity compromise | Strong auth, passkeys/certs, scoped tokens, rotation/revocation, anomaly detection. |
| Tenant breakout | Defense-in-depth tenant scoping at API, query, storage and object-policy layers. |
| Parser/file attack | Sandbox/untrusted file handling, size/type limits, malware scanning where applicable, safe rendering and fuzz tests. |
| OT abuse | Separate control plane, allowlists, interlocks, HITL, device identity, network segmentation and audit. |
| Consensus byzantine behavior | Signature verification, equivocation evidence, safe locks, round changes, BFT quorum, conformance harness. |
| Supply chain | Signed builds/packages, pinned dependencies, SBOM, CI provenance, secret scanning and deployment attestation. |
| AI prompt/tool abuse | Scoped retrieval/tools, output labeling, injection-resistant connector handling, action confirmation and model/tool audit. |
| Data exfiltration | Classification-aware access, encryption, egress control, tenant isolation and sovereign deployment options. |
| Recovery attack | Signed/certified snapshots, independent verification, trust-root ceremonies and tested restoration procedures. |

# **17\. Performance, Scale and Lossless Load Absorption**

* Application, consensus, NDIR/telemetry, evidence, Spatial, indexing and analytics planes scale independently.  
* Durable acceptance occurs before asynchronous heavy processing; backpressure is explicit to clients and operators.  
* Priority classes may reserve capacity for safety/critical work while guaranteeing anti-starvation for normal accepted work.  
* Temporary validation lanes/workgroups may create bounded proof artifacts, but one canonical ledger remains authoritative.  
* Spatial models use tiling/LOD/progressive geometry and server-side spatial indexes for large facilities.  
* Numeric performance targets are benchmark-derived and versioned by deployment profile rather than invented globally.

# **18\. Offline, Sync and Conflict Resolution**

* Client explicitly exposes ONLINE, OFFLINE, SYNCING, CONFLICT, PENDING\_FINALITY and FINALIZED.  
* Offline captures receive stable client IDs/idempotency keys and preserve original capture time/timezone plus sync time.  
* Conflicts are typed (version, identity, geometry, approval, policy, evidence, task state) and resolved through deterministic or human-governed rules.  
* No offline workflow may assume remote authorization that cannot be proven locally; offline packages declare permitted actions and expiration.

# **19\. Deployment Profiles and Runtime**

| Profile | Technical characteristics |
| :---- | :---- |
| Pilot | Small app footprint, three validators, database/Data Room, controlled features; full PoVI claims only after conformance. |
| Project | 3–6 validators across ≥2 failure domains; app/API, evidence, Spatial, Costing, JARVIS, edge optional. |
| Facility | 5–9 validators, edge/OPC UA, archive, higher availability, operations/maintenance/commissioning. |
| Mission-Critical | 7+ validators, independent power/network/provider domains, strong key custody, redundant edge/relay, rigorous SLO/recovery. |
| Enterprise | Multi-site, dedicated analytics/archive, connector fabric, centralized governance with scoped sub-authorities. |
| Sovereign/Air-gapped | Customer-controlled keys/data, private/on-prem or offline packages, independent Genesis/trust roots where required. |

# **20\. CI/CD, Observability and Release Engineering**

* Pull requests must run unit, integration, schema compatibility, security, type/lint/build and selected end-to-end tests.  
* Release candidates must run core user-flow tests, persistence reload tests, migration tests, tenant isolation, accessibility and representative Spatial model tests.  
* PoVI changes require deterministic simulation plus adversarial/byzantine scenarios; validator runtime changes require restart/durability/catch-up tests.  
* Observability includes distributed tracing/correlation IDs, structured logs, metrics, job/queue health, validator health, integration freshness and release metadata.  
* Production promotion is blocked on failed required checks. A previous production baseline does not make a failed newer branch “deployed”.  
* Rollback and data migration rollback/forward-repair procedures are tested before release.

# **21\. Test and Conformance Matrix**

| Test family | Minimum scope |
| :---- | :---- |
| Unit | Domain invariants, parsers, policy, transformations, schema validation. |
| Contract | API/event/protocol schema compatibility and versioning. |
| Integration | Data Room, Costing, OPC UA, identity, Spatial pipeline, chain/validator interactions. |
| E2E | Ten core product journeys across representative roles. |
| Persistence | Reload, concurrent edits, delete/restore, idempotency, retries, offline sync. |
| Spatial QA | Rooms/polygons, title block, scale, alignment, coordinates, revision compare, cross-view selection. |
| Security | Authorization, tenant isolation, parser/fuzz, secrets, supply chain, OT control boundaries. |
| PoVI | Partitions, equivocation, stale peers, invalid proofs, restarts, round changes, catch-up, snapshots. |
| Accessibility | Keyboard, screen reader, contrast, reduced motion, touch targets, confirmation/error handling. |
| Performance | Representative projects, telemetry rates, evidence sizes, scene complexity and validator/network profiles. |
| Disaster recovery | Restore from backups/snapshots, trust-root validation and continuity verification. |

# **22\. Technical Definition of Done**

* Requirement is linked to canonical schema/event/module and automated/manual acceptance evidence.  
* Data migrations are versioned, tested on representative production-like data and have forward-repair/rollback plan.  
* No unresolved critical security, data-loss, tenant-isolation, authority or safety defect exists.  
* UI mutation survives reload and alternate client session as designed; integration errors are observable.  
* Trust labels and finality states match backend truth.  
* CI is green on release commit and deployment health checks pass in target environment.  
* Documentation, runbook, monitoring and ownership are present for operational services.

# **23\. Current Technical Baseline**

| Capability | Status | Technical note |
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

# **24\. Technical Build Order**

| Priority | Build sequence |
| :---- | :---- |
| P0 | Canonical schemas \+ terminology → CI/release stabilization → user-flow shell and persistence correctness → full PoVI core → NDIR/MDIR/DIR → PLC/PFC/Genesis → validator governance/portable runtime. |
| P1 | Spatial Verified convergence → Data Room Artifact/Evidence Service → AI Costing integration → unified JARVIS context/orchestration. |
| P2 | OPC UA/edge → complete reconstruction → mission-critical engineering services → QA/Safety/Commissioning/Operations. |
| P3 | External connectors → Studio/SIR/WASM → enterprise certification → sovereign/large-scale validator topology. |

# **25\. Redbook Requirements Coverage**

| Source ID | Redbook domain | Coverage |
| :---- | :---- | :---- |
| RB-H.01 | Asset lifecycle / configuration / change / decommissioning | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.02 | Scale / performance / lossless load absorption | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.03 | Security threat model | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.04 | Time / ordering / chronology | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.05 | OPC UA / machine interaction | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.06 | STRATUM Studio / SIR | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.07 | Developer ecosystem / SDK / package registry | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.08 | BIM / CAD / SLD / document intelligence | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.09 | Compliance / audit / certification / turnover | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.10 | Energy / power systems / grid & load intelligence | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.11 | Data center / mission critical | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.12 | Field execution / QA-QC | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.13 | Safety / EHS / Permit-to-Work / LOTO | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.14 | Project controls / cost / change | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.15 | Commissioning / startup / FPT / IST | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.16 | Data architecture / storage / sync / retention / recovery | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.17 | Infrastructure / deployment / edge-cloud runtime | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.18 | Identity / organizations / multi-tenancy / RBAC-ABAC / credentials | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.19 | Interoperability / API / integration fabric | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.20 | UX / Universal Command Center / Design System | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.21 | Protocol verification / testing / conformance / benchmarking | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.22 | Governance / legal / policy / IP / commercialization | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.23 | Cryptography / PKI / key management / trust roots | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.24 | Privacy / data sovereignty / confidential computing | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.25 | Canonical schemas / ontology / event registry / API contracts | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.26 | Resource accounting / capacity / economics without tokens | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.27 | Formal PoVI protocol | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |
| RB-H.28 | Genesis / bootstrap / reference deployment | Covered by this TRD and/or referenced PRD/BRD. Detailed 20 locked decisions remain normative in the included Redbook. |

# **26\. Technical References**

| Reference | Technical use |
| :---- | :---- |
| STRATUM Redbook v1.0 | Final Consolidated & Audited Edition, 10 September 2026\. Normative internal architecture baseline. |
| NFPA 70B (2026) | Standard for Electrical Equipment Maintenance. NFPA LiNK preview confirms 2026 edition. |
| NFPA 70 / NEC (2026) | National Electrical Code. Use through licensed/authorized references and jurisdiction resolution; do not replicate restricted code text. |
| NFPA 70E (2024/current cycle) | Electrical Safety in the Workplace; complements installation and maintenance safety programs. |
| buildingSMART IFC / ISO 16739-1:2024 | Vendor-neutral digital description of built assets; IFC 4.3.2.0 is final published buildingSMART schema release while 4.4 is in development. |
| OPC UA / OPC 10000 series | Platform-independent secure interoperability and information-model architecture for industrial systems. |
| Brick Schema | Open semantic ontology for building assets, points, systems, spaces and relationships. |
| ASHRAE Standard 223P work | Semantic data model for analytics and automation applications in buildings; graph-based semantic interoperability INTEGRATED REVISION v2.1 — EPC LIFECYCLE TECHNICAL ARCHITECTURE Revision date: 23 September 2026 Status: Normative. This section extends the TRD v2.0. Where a conflict exists, the requirements below govern. A. Revised Technical Flow Canonical project intelligence flow: Project/RFP/RFQ sources → Source Registry/Data Room → Discipline Classification → Extraction/Comprehension → Cross-Discipline Semantic Graph → OEM/Standards/Rule Context → Component Resolution → Expected-Power Analysis → Scale/Coordinate/Alignment Resolution → Spatial Compiler → Governed Spatial Revision → Construction/Field Evidence → Reality Validation → Discrepancy/RFI/Change → Approved Decision → New Governed Revision → Commissioning → As-Built Compilation → Closeout Package → Operations. Trust flow remains separate: Canonical event/evidence → NDIR → MDIR → PoVI where applicable → DIR/PFC/finalized canonical state. No cryptographic or storage mechanism independently establishes physical truth. B. Service and Boundary Additions TR-201 Source Registry and Multi-Discipline Ingestion The ingestion service MUST register each source with immutable source ID, project/tenant, discipline, file type, revision, uploader/connector, timestamp, content hash, provenance, processing state and supersession relationships. Architectural, electrical, mechanical, structural, civil, specifications, SLDs, schedules, OEM records, images/scans, redlines and approved change documents are first-class source classes. TR-202 Engineering Comprehension Pipeline The comprehension pipeline MUST be staged and observable: classify → extract → normalize → candidate detection → schedule parsing → title-block parsing → symbol/object recognition → cross-reference → semantic linking → confidence/conflict computation. Each derived assertion MUST retain source references and a derivation/trust class. AI output SHALL NOT overwrite source-extracted facts. TR-203 Standards / Code / OEM Context Adapter Authorized code, standards, specification, OEM and historical project context MAY contribute rules and recommendations. The system MUST retain source identity, edition/version, jurisdiction/applicability and retrieval provenance. Rule results MUST state whether they are advisory, policy-controlled or require professional/AHJ confirmation. TR-204 Component Registry / OEM Library Canonical component profiles SHALL include component\_family, manufacturer, model, aliases, dimensions, connection points, electrical/mechanical attributes, source references, model/geometry references, version, confidence and approval state. Representative geometry MUST be labeled as representative when not authoritative OEM/as-built geometry. Unknown components follow: candidate → research/source collection → dimensional/spec validation → optional 3D creation/acquisition → human approval → versioned registry entry. TR-205 Expected Power Service The system SHALL evaluate powered equipment across all disciplines. Inputs MAY include equipment schedules, nameplates, OEM data, specifications, design rules and contextual inference. The service SHALL produce an ExpectedPowerFinding with at minimum: finding\_id, project\_id, asset\_or\_candidate\_id, source\_ids, expected\_voltage, expected\_phase, expected\_kw\_kva\_or\_load\_range where available, basis, confidence, matching electrical provision(s), missing\_or\_ambiguous\_feed flag, reviewer state and resolution. Inference MUST remain INFERRED/UNCERTAIN until reviewed. The service MUST NOT invent electrical design authority. TR-206 Spatial Compiler v2 The compiler SHALL construct: L1 architectural context; L2 physical infrastructure; L3 logical/electrical topology; L4 canonical assets; and links to L5 installation, L6 evidence, L7 operations and L8 trust. Spatial placement requires explicit evidence for scale, coordinate frame, floor/elevation and alignment. Unknown Z or XYZ remains null/unknown rather than fabricated. Schedule-only assets may participate in topology and workflows without 3D placement. TR-207 Multi-Representation Canonical Entity Contract 2D drawing objects, SLD nodes, 3D objects, table rows, timeline entries, QR references and dependency graph nodes MUST resolve to the same canonical entity\_id when they represent the same asset. View-specific IDs are projections, not new authoritative identities. TR-208 Governed Revision Model A project/spatial revision MUST be immutable once published. Approved changes create a new revision that references predecessor revision, change set, approving event(s), affected source/entity IDs and evidence. Supersession changes canonical current-state projection without deleting historical revisions. Minimum objects: ProjectRevision SourceRevision ChangeSet ApprovalEvent SupersessionEvent SpatialCompilationManifest. TR-209 Field / Reality Capture Service A mobile-optimized service/surface SHALL support QR scan, photo, video, measurement, annotation, field note, redline, scan/reality-capture reference, incident/discrepancy creation and work-step evidence. Offline/degraded capture MUST queue with idempotency keys and preserve original capture timestamps, device/user identity and synchronization status. TR-210 Reality Validation Engine The engine SHALL preserve three explicit state domains: DesignedState — governed design intent; ObservedState — field-captured condition with provenance; VerifiedState — governed conclusion/approval supported by required authority/evidence. Comparison functions MAY evaluate identity, location, dimensions, rating, connection, route, topology, equipment presence and power provision. Results SHALL produce discrepancy records; they MUST NOT mutate DesignedState or VerifiedState directly. TR-211 Discrepancy Object A canonical Discrepancy SHALL include: discrepancy\_id, project\_id, location/entity scope, designed references, observed references, discrepancy type, severity/impact, confidence, reporter, timestamp, attachments/evidence, status, owner, related work/incident/RFI/change IDs and resolution. TR-212 RFI / Change Orchestration An RFI MAY be generated from a discrepancy and SHALL preserve affected context. Minimum RFI fields include issue/question, project/site/location, affected assets, source revision references, annotated evidence, requested decision, impact assessment, suggested alternatives when present, issuer/recipient, dates and status. JARVIS MAY draft or summarize but issuance/approval follows RBAC/HITL policy. An approved RFI/change response MUST produce a ChangeSet before affecting canonical project state. TR-213 Field-Marked Drawing Re-ingestion Field redlines, revised PDFs/CAD/BIM, specifications, approved submittals and RFI/change documents SHALL enter through the same Source Registry, preserving revision lineage and comparison to prior source versions. They do not bypass extraction/review merely because they originate from the field. TR-214 As-Built Compiler The As-Built compiler SHALL derive the accepted installed-state package from the latest governed project revision plus approved changes, validated field evidence and accepted commissioning results. It MUST preserve links to historical design revisions and SHALL NOT collapse the history into an untraceable final model. TR-215 Handover Manifest The closeout service SHALL generate a HandoverManifest containing required/present/missing status for applicable deliverables: final 2D sources; final spatial revision; canonical asset registry/Passports; SLD/logical topology; installation/revision history; approved RFI/change records; field/inspection evidence; commissioning/test results; OEM records; maintenance baseline; QR identifiers; proof/provenance package; audit report. The manifest SHALL be exportable and hashable; trust/finality claims remain separately qualified. C. Event Model Additions The event registry SHALL include or map equivalent typed events: SOURCE\_REGISTERED SOURCE\_CLASSIFIED EXTRACTION\_COMPLETED CANDIDATE\_IDENTIFIED COMPONENT\_MATCHED COMPONENT\_LIBRARY\_ENTRY\_PROPOSED COMPONENT\_LIBRARY\_ENTRY\_APPROVED EXPECTED\_POWER\_FINDING\_CREATED EXPECTED\_POWER\_FINDING\_RESOLVED SPATIAL\_COMPILATION\_CREATED PROJECT\_REVISION\_PUBLISHED FIELD\_OBSERVATION\_CAPTURED DISCREPANCY\_CREATED RFI\_DRAFTED RFI\_ISSUED RFI\_RESPONSE\_RECEIVED CHANGESET\_PROPOSED CHANGESET\_APPROVED REVISION\_SUPERSEDED COMMISSIONING\_TEST\_COMPLETED COMMISSIONING\_EXCEPTION\_CREATED AS\_BUILT\_COMPILED HANDOVER\_MANIFEST\_CREATED PROJECT\_TURNED\_OVER. Events shall carry tenant/project scope, actor/service identity, timestamp, correlation/idempotency key and provenance/evidence references where applicable. D. API / Integration Requirements 1\. The Field/Reality application MAY be separately deployed but MUST use authenticated typed APIs/events and canonical IDs. 2\. Data Room, Spatial Verified, AI Costing, JARVIS, OPC UA/edge and STRATUM Chain MUST exchange canonical objects/events; direct cross-database mutation remains prohibited. 3\. Spatial-to-Costing SHALL consume governed quantities and source revision identifiers so commercial reconciliation can identify which revision produced each quantity. 4\. OPC UA/BMS/SCADA telemetry SHALL bind to canonical asset IDs and retain source quality/timestamp; telemetry alone cannot promote physical-truth status. 5\. External BIM/CAD/GIS/reality-capture adapters SHALL preserve native source provenance and adapter/version metadata. E. Security, Authority and Safety RBAC, tenant isolation and least privilege apply to source ingest, field capture, engineering review, RFI issuance, approval, library registration and revision publication. High-consequence actions SHALL declare required H0–H5 HITL authority. AI-assisted recommendations MUST label model/tool provenance and confidence and MUST be injection-resistant when consuming documents/connectors. Codes/standards/OEM context MUST NOT be represented as automatic legal/regulatory compliance. F. Testing and Release Gates In addition to existing test requirements, release candidates SHALL include: • multi-discipline ingestion fixture tests; • source-provenance retention tests; • schedule-only asset/no-invented-XYZ tests; • scale/coordinate/alignment uncertainty tests; • component-library matching/versioning tests; • expected-power positive/negative/ambiguous-feed tests; • design-vs-observed discrepancy tests; • RFI-response-to-ChangeSet-to-new-revision tests; • historical revision non-destruction tests; • offline field capture/idempotent replay tests; • field-marked drawing re-ingestion tests; • as-built compilation and handover completeness tests; • canonical identity consistency across 2D/SLD/3D/table/QR/work/operations; • RBAC/HITL tests for review, issuance, approval and revision publication; • device-level QR/camera/WebGL acceptance where applicable. G. Observability Each pipeline stage SHALL expose processing state, failure reason, duration and correlation ID. Users and operators shall be able to distinguish queued, processing, partial, needs-review, failed and completed states. Derived-model generation MUST never fail silently or display fabricated project geometry as a successful result. . |

