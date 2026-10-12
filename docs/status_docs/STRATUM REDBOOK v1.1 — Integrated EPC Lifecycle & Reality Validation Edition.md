# **STRATUM REDBOOK**

## *STRATUM Chain • STRATUM Spatial Verified • Proof of Verified Infrastructure (PoVI)*

**Architecture, Trust, Data, Spatial, AI, Operations, Governance, Deployment, and Implementation Baseline**

Version 1.1 — Integrated EPC Lifecycle & Reality Validation Edition  
September 10, 2026

**Prepared for STRATUM Power**

**Status note:** This Redbook distinguishes Implemented, Partial, Planned, and Conceptually Locked architecture. A concept being 'locked' means it is approved as part of the specification; it does not mean the capability is deployed or verified in software.

# **Document Control and Normative Conventions**

| Field | Value |
| :---- | :---- |
| Document | STRATUM Redbook |
| Version | 1.0 |
| Date | September 10, 2026 |
| Primary product name | STRATUM Spatial Verified |
| Blockchain / trust layer | STRATUM Chain |
| Consensus protocol | Proof of Verified Infrastructure (PoVI) |
| Canonical consensus unit | Digital Immutable Record (DIR) |
| AI orchestration layer | JARVIS — STRATUM Chief AI Orchestrator |
| Status language | Implemented / Partial / Planned / Conceptually Locked |
| Brand rule | Always write STRATUM Power |

## **Normative language**

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used in the architectural sense to distinguish mandatory invariants, recommended controls, and optional extensions. Where this Redbook says 'Locked,' the decision is conceptually approved for the STRATUM specification.

## **Status discipline**

* Implemented — working code or service exists and has been directly verified at the implementation level described.  
* Partial — a capability exists in incomplete form, lacks conformance to the Redbook, or is present only in selected modules.  
* Planned — specified but not yet implemented or not yet verified as implemented.  
* Conceptually Locked — approved as the target architecture. This is not an implementation claim.

# **Executive Summary**

STRATUM is specified as an infrastructure operating and trust ecosystem centered on STRATUM Spatial Verified, STRATUM Chain, the STRATUM Data Room, STRATUM AI Costing, and JARVIS. The architecture combines spatial infrastructure representation, evidence-backed asset lifecycle management, permissioned Byzantine-fault-tolerant finality, industrial interoperability, machine-readable engineering context, operations and maintenance, field execution, commissioning, safety, project controls, procurement intelligence, cybersecurity, AI orchestration, and auditable governance.

STRATUM Chain is designed as an independent permissioned network. Production operation does not depend on Ethereum, Base, Polygon, Bitcoin, or another public chain. It requires no mining, public token, staking, or gas fees. The native record hierarchy is Nano DIR → Micro DIR → DIR. Nano DIRs capture granular observations, Micro DIRs capture meaningful infrastructure events and candidate state transitions, and DIRs are the PoVI-finalized canonical consensus units.

The fundamental trust principle is that cryptography proves identity, integrity, provenance, and network finality; it does not by itself prove that a physical-world assertion is true. Physical truth is established through source provenance, evidence, role attestations, engineering review, field verification, test instruments, approval workflows, machine state, and PoVI-governed canonicalization.

STRATUM Spatial Verified is explicitly a Spatial model, not a 'digital twin' product. Legacy repositories or internal code may retain historical 'twin' terminology for compatibility, but user-facing architecture and product language use Spatial.

This Redbook consolidates all previously locked architecture plus a 60-point closure audit. The closure audit found no missing giant application domain; remaining gaps were primarily normative schemas, edge cases, engineering-service formalization, deployment semantics, trust-model consolidation, legal/privacy controls, and verification mechanics. All 60 recommendations are pre-approved and locked herein.

# **Detailed Table of Contents**

# **Front Matter — Naming Conventions, Abbreviations, and Editorial Rules**

## **FM-1. Naming Conventions**

* Company brand: always write STRATUM Power. STRATUM is uppercase; Electric is title case.  
* Primary product/application: STRATUM Spatial Verified. Do not describe it as a digital twin. The canonical noun is Spatial model.  
* Blockchain/trust network: STRATUM Chain.  
* Consensus protocol: Proof of Verified Infrastructure (PoVI).  
* Native consensus unit: Digital Immutable Record (DIR). Conventional “block” terminology is deprecated in user-facing STRATUM language.  
* Height-zero record: Genesis DIR. Do not use “genesis block” in user-facing STRATUM language.  
* Granular observation: Nano DIR (NDIR). Meaningful infrastructure event: Micro DIR (MDIR). Finalized consensus unit: DIR.  
* AI orchestrator: JARVIS — STRATUM Chief AI Orchestrator. JARVIS is the conductor of specialist agents and does not itself create consensus authority.  
* Intermediate rules/workflow representation: STRATUM Intermediate Representation (SIR).  
* Use stable canonical IDs in lower camel case field names: assetId, projectId, organizationId, SpatialRef, evidenceId, microDirId, validatorId.  
* Use SCREAMING\_SNAKE\_CASE for enumerated protocol/event/status constants: ASSET\_REGISTERED, PENDING\_FINALITY, SAFETY\_CRITICAL\_CONTROL.  
* Use PascalCase for schema/object type names: Asset, EvidencePackage, ValidatorIdentity, AIRecommendation, CommissioningPlan.  
* Use slash-version notation for protocol families where appropriate: POVI/1, STRATUM-SCHEMA/1, SIR/1. Exact namespaces are governed and immutable once published.  
* Timestamps are UTC ISO 8601 for canonical storage while preserving original local timezone/offset when relevant.  
* Cryptographic hashes are lowercase hexadecimal unless a schema explicitly defines another canonical encoding.  
* Human-readable validator labels such as Validator A/B/C/D are permanent and non-reused; validatorId/public key identity remains the security identity.  
* Trust words are qualified. Prefer PoVI Verified, Field Verified, OEM Verified, Source Verified, AI Inferred, Live, Stale, Conflicted, or Unverified rather than generic “verified.”  
* Approved, Verified, Commissioned, Finalized, Live, and Certified are not synonyms. Each belongs to a separate authority/trust dimension.  
* Legacy repository/table/API names containing twin, block, chain, or transaction may remain internally for compatibility but MUST NOT redefine canonical user-facing terminology.  
* Acronyms are spelled out on first substantive use in a chapter unless they are defined in the Abbreviations table.

## **FM-2. Abbreviations and Acronyms**

| Abbreviation | Meaning |
| :---- | :---- |
| AAS | Asset Administration Shell |
| ABAC | Attribute-Based Access Control |
| AHJ | Authority Having Jurisdiction |
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| AR | Augmented Reality |
| ATS | Automatic Transfer Switch |
| BACnet | Building Automation and Control network |
| BFT | Byzantine Fault Tolerance |
| BIM | Building Information Modeling |
| BMS/BAS | Building Management / Building Automation System |
| BOM | Bill of Materials |
| CAD | Computer-Aided Design |
| CMMS | Computerized Maintenance Management System |
| CoC | Certificate of Conformance / Chain of Custody, context-dependent |
| CPU | Central Processing Unit |
| CSF | Cybersecurity Framework |
| DIR | Digital Immutable Record |
| DPIA | Data Protection Impact Assessment |
| EAM | Enterprise Asset Management |
| EHS | Environment, Health, and Safety |
| EOR | Engineer of Record |
| EOP | Emergency Operating Procedure |
| ERP | Enterprise Resource Planning |
| EU | Execution Unit |
| EVSE | Electric Vehicle Supply Equipment |
| FAT | Factory Acceptance Test |
| FPT | Functional Performance Test |
| GIS | Geographic Information System |
| GNSS | Global Navigation Satellite System |
| HITL | Human in the Loop |
| HSM | Hardware Security Module |
| HVAC | Heating, Ventilation, and Air Conditioning |
| IDTA | Industrial Digital Twin Association |
| IFC | Industry Foundation Classes |
| IIoT | Industrial Internet of Things |
| IST | Integrated Systems Testing |
| ITP | Inspection and Test Plan |
| JARVIS | STRATUM Chief AI Orchestrator |
| JHA/JSA | Job Hazard Analysis / Job Safety Analysis |
| KCA | Kolmogorov Complexity Approximation |
| LOTO | Lockout/Tagout |
| MDIR | Micro DIR |
| MEP | Mechanical, Electrical, and Plumbing |
| MOP | Method of Procedure |
| MR | Mixed Reality |
| NDIR | Nano DIR |
| NCR | Nonconformance Report |
| NFPA | National Fire Protection Association |
| NIST | National Institute of Standards and Technology |
| OEM | Original Equipment Manufacturer |
| OPC UA | Open Platform Communications Unified Architecture |
| OT | Operational Technology |
| PFC | PoVI Finality Certificate |
| PESTEL | Political, Economic, Social, Technological, Environmental, and Legal |
| PKI | Public Key Infrastructure |
| PLC | PoVI Lock Certificate; separately, programmable logic controller where explicitly stated |
| PoVI | Proof of Verified Infrastructure |
| PPE | Personal Protective Equipment |
| PQ/PQC | Post-Quantum / Post-Quantum Cryptography |
| PTW | Permit to Work |
| PUE | Power Usage Effectiveness |
| QA/QC | Quality Assurance / Quality Control |
| RBAC | Role-Based Access Control |
| RCA | Root Cause Analysis |
| RFID | Radio-Frequency Identification |
| RFI | Request for Information |
| RFQ | Request for Quotation |
| RPP | Remote Power Panel |
| SCADA | Supervisory Control and Data Acquisition |
| SDK | Software Development Kit |
| SIEM | Security Information and Event Management |
| SIR | STRATUM Intermediate Representation |
| SLD | Single-Line Diagram |
| SLO/SLA | Service-Level Objective / Service-Level Agreement |
| SOP | Standard Operating Procedure |
| TEE | Trusted Execution Environment |
| TLS | Transport Layer Security |
| TPM | Trusted Platform Module |
| UPS | Uninterruptible Power Supply |
| VR | Virtual Reality |
| VRF | Verifiable Random Function |
| WASM | WebAssembly |
| XR | Extended Reality |

**LOCKED — Naming conventions and abbreviations in this front matter are normative across the Redbook and future implementation specifications.**

**Front Matter — Naming Conventions, Abbreviations, and Editorial Rules**

FM-1. Naming Conventions

FM-2. Abbreviations and Acronyms

**Appendix H — Complete Locked Architecture Registry**

**Appendix I — Final Completeness Audit and Locked Corrections**

# **Appendix H — Complete Locked Architecture Registry**

This appendix is the anti-omission registry for the STRATUM Redbook. It preserves the major previously locked 20-point architecture sets individually. These are target specification decisions, not implementation claims.

## **H.1 Asset Lifecycle / Configuration / Change / Decommissioning — 20 Locked Decisions**

**1\.** Canonical asset identity persists across the complete lifecycle and is never silently recycled.

**2\.** Lifecycle follows REGISTERED → RECEIVED → INSTALLED → INSPECTED → TESTED → COMMISSIONED → VERIFIED → MAINTAINED → MODIFIED → RETIRED, while temporary operational status remains separate.

**3\.** Registration is evidence-backed and records identity, source, OEM/model/serial, project/site context, and provenance.

**4\.** Receiving establishes condition, custody, authenticity evidence, discrepancies, and shipping/lot lineage.

**5\.** Installation binds asset identity to physical position, system/topology, installer/work session, and evidence.

**6\.** Configuration is a first-class append-only/versioned object rather than an overwriteable JSON blob.

**7\.** Named baselines include DESIGN, PROCURED, FACTORY, INSTALLATION, COMMISSIONING, AS\_BUILT, and OPERATIONAL.

**8\.** Modification lifecycle is proposed → reviewed → approved → scheduled → executed → verified and includes multidisciplinary impact analysis.

**9\.** Temporary configurations are time-bounded and require explicit restoration or governed extension.

**10\.** Replacement normally creates a new assetId with predecessor/successor relationship, preserving both histories.

**11\.** Hierarchical component replacement may preserve parent identity where engineering identity remains continuous.

**12\.** Owner, custodian, operator, maintainer, warranty provider, and service provider are distinct roles/relationships.

**13\.** Operational state history is separate from lifecycle state.

**14\.** Maintenance records declare configuration consequences and whether recommissioning/reverification is required.

**15\.** Safety/quality restriction states include QUARANTINED, DO\_NOT\_ENERGIZE, RESTRICTED, INSPECTION\_REQUIRED, ENGINEERING\_REVIEW\_REQUIRED.

**16\.** Decommissioning follows proposal → impact review → isolation → preservation → removal → topology/Spatial update → retirement.

**17\.** End-of-life dispositions include SCRAP, RECYCLE, SALVAGE, REFURBISH, REDEPLOY, RETURN\_OEM, RESELL, ARCHIVE; redeploy preserves identity/history where valid.

**18\.** Environmental/end-of-life handling is jurisdiction-aware.

**19\.** Reactivation/recommissioning is explicit, evidence-heavy, and never achieved by simply editing a retired status.

**20\.** No lifecycle/configuration/ownership transition is silently edited; current state is deterministically derived from finalized events, while NDIR captures observation, MDIR captures meaningful transition, and DIR supplies finality.

**LOCKED — Asset history remains verifiable after retirement, replacement, or redeployment.**

## **H.2 Scale / Performance / Lossless Load Absorption — 20 Locked Decisions**

**1\.** Separate application, consensus, NDIR/telemetry, evidence, Spatial, indexing, and analytics planes.

**2\.** Durable ingress states are RECEIVED → DURABLY\_QUEUED → PREVALIDATING → CONSENSUS\_READY → PROPOSED → FINALIZED.

**3\.** Pre-validation gateways may reject malformed work cheaply but never create authority.

**4\.** Multi-tenant scheduling is deterministic, priority-aware, and anti-starvation.

**5\.** NDIRs are hierarchically aggregated using deterministic batches/Merkle roots.

**6\.** Lossless Load Absorption prevents silent loss after durable acceptance.

**7\.** Temporary parallel validator workgroups may validate bounded lanes and produce proof/certification artifacts without creating separate canonical ledgers.

**8\.** One canonical ledger remains authoritative regardless of parallel validation lanes.

**9\.** Final consensus independently verifies lane results/certificates before finality.

**10\.** Workgroup count/scaling is adaptive to load and validator count; small networks are not forced into unnecessary lanes.

**11\.** Idempotency keys prevent duplicate work across retries/restarts.

**12\.** Sync/catch-up work is isolated from consensus-critical message processing.

**13\.** Hardware-neutral validator authority: stronger hardware improves performance, never voting weight.

**14\.** Pruning and certified snapshots reduce validator storage pressure without losing verifiability.

**15\.** Archive nodes retain richer historical content and do not gain votes.

**16\.** Indexes and projections are disposable/rebuildable from canonical history plus source manifests.

**17\.** Overload degrades latency/features before integrity or safety.

**18\.** Durably accepted records are never silently dropped; explicit rejection must have reason/status.

**19\.** Consensus resource envelopes are bounded per DIR/MDIR and benchmark-derived.

**20\.** Performance scaling MUST preserve deterministic execution, provenance, finality rules, and tenant fairness.

**LOCKED — Scale optimizations may change throughput strategy but cannot change canonical truth or PoVI quorum semantics.**

## **H.3 Security Threat Model — 20 Locked Decisions**

**1\.** The network states an explicit Byzantine minority assumption rather than claiming unhackability.

**2\.** Compromise of an application server cannot by itself finalize or rewrite DIR history.

**3\.** Compromise of Neon/PostgreSQL cannot by itself create valid PFCs or change validator authority.

**4\.** Compromise/deletion of Data Room storage is detectable through content hashes/manifests but may affect availability.

**5\.** Source/device signatures prove provenance/integrity, not necessarily truth.

**6\.** Replay attacks are prevented by chain/height/round/step/schema/domain binding and sequence/idempotency rules.

**7\.** DDoS and resource exhaustion are addressed by admission controls, bounded work, fair scheduling, aggregation, and isolation.

**8\.** Network partition without quorum halts finality instead of creating conflicting history.

**9\.** A compromised quorum is an explicit trust boundary and catastrophic threat condition.

**10\.** Software supply-chain risk is reduced through signed releases, SBOMs, provenance, and verification.

**11\.** Application administrators cannot bypass PoVI, safety, or trust-critical approval requirements.

**12\.** Consensus execution does not depend on local wall clocks for deterministic state decisions.

**13\.** Consensus execution does not call external I/O, randomness, web APIs, or mutable databases.

**14\.** Crash/restart state is verified before a validator resumes signing.

**15\.** Private keys are purpose-separated and protected with escalating assurance tiers.

**16\.** Cross-tenant authorization is enforced server-side, not only in UI.

**17\.** Prompt injection/malicious documents cannot directly grant AI or connector authority.

**18\.** OT/machine commands require identity, policy, HITL, and local interlocks.

**19\.** Privacy/retention/DR controls address confidentiality and recoverability separately from finality.

**20\.** Threat claims are scoped: under the stated assumptions, compromise of app/db/storage/admin/single/minority validators cannot rewrite finalized history.

**LOCKED — Finality safety is conditional on quorum honesty and cryptographic assumptions; the Redbook forbids absolute “unhackable” claims.**

## **H.4 Time / Ordering / Chronology — 20 Locked Decisions**

**1\.** Distinguish eventOccurredAt, recordedAt, submittedAt, acceptedAt, and finalizedAt.

**2\.** Consensus finalization establishes canonical ledger order, not physical-world occurrence time.

**3\.** Late-arriving events do not rewrite earlier finalized DIRs.

**4\.** Clock quality/trust is tracked for devices, gateways, servers, humans, and imports.

**5\.** Source sequence numbers and gaps are preserved where available.

**6\.** Timestamp conflicts retain provenance rather than silently choosing one.

**7\.** CORRECT\_EVENT\_TIME or equivalent append-only correction may revise interpretation without rewriting history.

**8\.** UTC is canonical for storage while original local timezone/offset is retained when relevant.

**9\.** Event registry defines whether occurrence time, dependency, or accepted sequence affects deterministic MDIR ordering.

**10\.** Dependencies override naive chronological sorting when prerequisites demand it.

**11\.** Priority class does not erase event time.

**12\.** Offline observations record local sequence/time and later submission/finality times separately.

**13\.** Imported historical records are labeled historical/imported and not misrepresented as originally observed by the network.

**14\.** Sensor sourceTimestamp and serverTimestamp may both be preserved.

**15\.** OPC UA StatusCode/quality accompanies timestamps.

**16\.** Spatial capture sessions carry capture time, processing time, review time, and verification time.

**17\.** Human approvals record exact signing time and approval scope.

**18\.** Protocol height/round/step provide deterministic consensus chronology.

**19\.** Audit timelines can reconstruct real-world chronology, ingestion chronology, and finality chronology independently.

**20\.** No last-write-wins policy may erase meaningful temporal conflicts.

**LOCKED — STRATUM preserves multiple clocks and makes their trust/meaning explicit.**

## **H.5 OPC UA / Machine Interaction — 20 Locked Decisions**

**1\.** OPC UA source identity preserves serverApplicationUri, namespaceUri, nodeId, browse/type context, datatype, engineering units, StatusCode, and timestamps.

**2\.** Namespace URI, not ephemeral namespace index, is the canonical namespace identity.

**3\.** The OPC UA Bridge performs discovery, session management, browse, companion-spec handling, subscriptions/PubSub, history, identity mapping, normalization, NDIR aggregation, MDIR candidacy, and Spatial synchronization.

**4\.** Support OPC UA client/server integration and PubSub where appropriate.

**5\.** High-frequency telemetry flows to NDIRs and aggregation; significant events/actions may become MDIRs.

**6\.** Consensus never performs live OPC UA calls.

**7\.** OPC UA certificates/application identity map to device/gateway provenance.

**8\.** Companion specifications and structured information models should be preserved rather than flattened unnecessarily.

**9\.** Alarms & Conditions are modeled explicitly.

**10\.** Writes/method calls follow least privilege and declared control capability.

**11\.** Historical ingestion preserves both original source time and import time and does not pretend to be live observation.

**12\.** Offline buffering is durable and sequence-aware.

**13\.** StatusCode quality GOOD/UNCERTAIN/BAD is retained through normalization.

**14\.** Spatial live overlays are derived views and do not mutate canonical geometry.

**15\.** Command lifecycle is request → authorization → send → acknowledgement → result → evidence/NDIR/MDIR as applicable.

**16\.** STRATUM authorization never bypasses PLC/device/local safety interlocks.

**17\.** OEM capability discovery supports model/firmware/companion metadata.

**18\.** Namespace/schema versions and remapping are explicit.

**19\.** PubSub provenance and replay protection are defined.

**20\.** Multiple OPC UA sources may map to one canonical asset while preserving independent provenance and explicit failover.

**LOCKED — OPC UA is an industrial interface and evidence source, not a source of PoVI finality.**

## **H.6 STRATUM Studio / SIR — 20 Locked Decisions**

**1\.** SIR is the canonical intermediate representation for authored rules/workflows across visual, natural-language, DSL, Native, WASM, and optional EVM targets.

**2\.** SIR includes program/version, typed inputs/outputs, state read/write scopes, permissions, OPC bindings, triggers, conditions, actions, runtime, resources, security, and deployment metadata.

**3\.** Visual workflows round-trip through SIR and STRATUM DSL.

**4\.** Natural-language authoring produces a proposal, ambiguity analysis, permission review, preview, simulation, and authorization path; it never jumps directly to critical execution.

**5\.** Compilation targets include Native PoVI modules, STRATUM DSL, sandboxed WASM, and optional EVM/Solidity compatibility.

**6\.** Cross-runtime interfaces are typed and capability-scoped.

**7\.** Visual block taxonomy includes Sources, Logic, Trust, Actions, Machine, and Advanced.

**8\.** Reusable custom blocks have signed/versioned manifests.

**9\.** Ambiguity is risk-classified and escalates to human clarification where consequential.

**10\.** Consequence visualization shows affected assets/state/commands/approvals before deployment.

**11\.** Simulation produces deterministic traces and expected state effects.

**12\.** Collaboration is Git-like with versions, diffs, authorship, review, and approval.

**13\.** AI-generated logic has no special trust status.

**14\.** Engineering units are typed in SIR.

**15\.** Capability discovery exposes available data/actions without granting them.

**16\.** Governed templates/OEM libraries can be referenced with version/provenance.

**17\.** Lifecycle is DRAFT → DEV → SIMULATION → TEST → REVIEWED → GOV\_APPROVED → SCHEDULED → PROD with exact hash identity.

**18\.** Observability traces runs, errors, resource use, and actions.

**19\.** RBAC/ABAC and separation of duties apply to authoring/review/deploy.

**20\.** Signed portable packages support CLI/API/SDK workflows; Studio itself is never independent authority.

**LOCKED — No Studio, natural-language, or AI path can bypass PoVI, HITL, deterministic runtime, or machine-safety controls.**

## **H.7 Developer Ecosystem / SDK / Package Registry — 20 Locked Decisions**

**1\.** Unified SDK targets TypeScript, Go, Rust, Python, and Solidity compatibility where relevant.

**2\.** Signed content-addressed package types include NATIVE, DSL, WASM, EVM, OPC\_UA, STUDIO\_BLOCK, TEMPLATE, OEM\_LIBRARY.

**3\.** Every package declares capability manifest, requested permissions, APIs, state scopes, resources, compatibility, publisher, and license.

**4\.** Package trust level is explicit and separate from registry listing.

**5\.** Dependencies are deterministic and locked by exact versions/hashes.

**6\.** Reproducible builds are a release objective.

**7\.** Publishers sign packages and have key-rotation/revocation history.

**8\.** Registry search/discovery never equals protocol activation.

**9\.** Published package versions are immutable; updates create new versions.

**10\.** Deprecation and security advisories are versioned and visible.

**11\.** Emergency suspension can prevent new activation/use while preserving historical verification.

**12\.** Conformance suites validate determinism, permissions, resource limits, APIs, schemas, and security.

**13\.** OEM libraries may declare compatibility/validation levels.

**14\.** Third-party publishing is governed for production/certified channels.

**15\.** Publisher reputation/provenance may inform trust but never protocol voting power.

**16\.** Licensing/IP metadata are first-class.

**17\.** Environment separation: LOCAL, SANDBOX, DEVNET, CONFORMANCE, STAGING, PROD.

**18\.** CI/CD may automate builds/tests/deploy preparation but cannot bypass governance activation.

**19\.** Machine-readable documentation, schemas, examples, test vectors, and changelogs accompany packages.

**20\.** Commercial package ecosystems require no token and cannot purchase consensus authority.

**LOCKED — Every deployable artifact must be attributable, content-addressed, permission-scoped, dependency-locked, testable, and activation-governed.**

## **H.8 BIM / CAD / SLD / Document Intelligence — 20 Locked Decisions**

**1\.** Engineering documents are canonical versioned objects with stable IDs, source/provider, revision, status, hash, project/site/Spatial context, and approval state.

**2\.** Provider-neutral ingestion supports Drive, uploads, Autodesk/BIM systems, document systems, and future connectors.

**3\.** Structured sources are preferred before OCR/image inference when available.

**4\.** Coordinate systems and drawing/model transforms are normalized explicitly.

**5\.** SLD semantic extraction identifies assets, connectivity, ratings, protection, labels, and logical topology.

**6\.** SLD-to-Spatial reconstruction uses the evidence hierarchy and does not treat drawing coordinates as physical truth.

**7\.** CAD extraction preserves layers/blocks/entities/coordinates/source metadata.

**8\.** BIM/IFC GUIDs map to canonical assetId without replacing STRATUM identity.

**9\.** Schedules/tables are reconciled with drawings/models/assets.

**10\.** Cross-document entity resolution preserves confidence and conflicts.

**11\.** Revision diff identifies added/removed/changed assets, routes, ratings, notes, quantities, and geometry.

**12\.** Multi-document conflicts are explicit.

**13\.** Documents may generate candidate rules/requirements only through review and source traceability.

**14\.** Provenance-backed takeoff feeds AI Costing with source region/page/object/geometry references.

**15\.** Costing is revision-aware and quantifies deltas.

**16\.** Data Room retains source/version/provenance and approvals.

**17\.** Annotations/RFIs/NCRs can anchor to page/region/object/Spatial location.

**18\.** Design-vs-installed/as-built reconciliation is first-class.

**19\.** JARVIS acts as Engineering Document Copilot for search, comparison, extraction, impact analysis, and drafting within authority limits.

**20\.** Every extracted/inferred fact retains source/version/confidence; AI inference never silently becomes approved engineering truth.

**LOCKED — Engineering-document intelligence must preserve source, revision, provenance, inference state, and approval boundaries.**

## **H.9 Compliance / Audit / Certification / Turnover — 20 Locked Decisions**

**1\.** Compliance Case is a first-class object with scope, requirements, evidence, findings, exceptions, approvals, and status.

**2\.** Requirement-to-evidence matrices show every requirement and supporting artifact/event.

**3\.** Signatures record role, credential, scope, action/document hash, intent, and time.

**4\.** A DIR-bound Turnover Baseline identifies exact as-built/configuration/evidence state at handover.

**5\.** Punch-list/NCR history preserves creation, disposition, correction, retest, and closure.

**6\.** Commissioning gates drive turnover readiness.

**7\.** Warranty state includes provider, coverage, effective dates, exclusions, evidence, service obligations.

**8\.** Auditors receive scoped/time-bounded access rather than global admin.

**9\.** Phased/area/system turnover is supported.

**10\.** Certification states are scoped/versioned and distinct from PoVI finality.

**11\.** Retention/legal hold policies apply to turnover evidence.

**12\.** Historical audits can reconstruct the exact source/approval/DIR state applicable at the audit date.

**13\.** Portable forensic/proof packages can be independently verified.

**14\.** Recertification/reinspection creates new events and does not rewrite old certificates.

**15\.** Maintenance continuity links post-turnover work back to the baseline.

**16\.** Exceptions/waivers carry reason, authority, compensating controls, expiry, and closure.

**17\.** Digital Turnover Package includes Spatial, asset registry, documents, tests, commissioning, warranties, O\&M, compliance, proof references.

**18\.** Portable verifier supports external parties without full platform access.

**19\.** Portfolio analytics derive completion/compliance/exception trends without redefining certification status.

**20\.** Every certification/turnover claim must trace requirement → source → evidence → performer/reviewer/approver → state → DIR/proof where applicable.

**LOCKED — Turnover is a verifiable baseline, not merely a folder of files.**

## **H.10 Energy / Power Systems / Grid & Load Intelligence — 20 Locked Decisions**

**1\.** Canonical electrical graph models sources, buses, transformers, switchgear, breakers, ATS, generators, UPS, PDU/RPP, panels, feeders, loads, DER, storage, EVSE, and relevant controls.

**2\.** Load classes distinguish criticality, interruptibility, safety, process dependency, and redundancy role.

**3\.** Live voltage/current/power/energy/frequency/power-quality telemetry enters as NDIR with quality/provenance.

**4\.** Capacity/utilization is derived from verified ratings/configuration plus live/forecast demand.

**5\.** Deterministic power-flow calculations are versioned engineering services.

**6\.** Short-circuit/fault-current analysis is versioned and source-traceable.

**7\.** Protection coordination/selectivity analysis is versioned and reviewable.

**8\.** Power-quality analytics cover disturbances/harmonics/events with measurement provenance.

**9\.** Demand forecasting is advisory and confidence-labeled.

**10\.** Resilience analysis models failure domains and restoration paths.

**11\.** Generator/UPS/battery autonomy uses rated/verified configuration, fuel/SOC, load, environmental factors, and assumptions.

**12\.** DER/microgrid topology and operating modes are modeled.

**13\.** EV charging load and managed charging impacts are represented.

**14\.** Load shedding is governed, constrained, and safety-aware.

**15\.** Optimization respects operational/safety/contractual constraints and remains advisory unless explicitly authorized.

**16\.** Tariff/rate structures and demand charges may inform cost optimization.

**17\.** Grid events/outages are source-attributed and separated from internal faults.

**18\.** Energy/environmental metrics retain source/calculation methodology.

**19\.** JARVIS power copilot explains state, capacity, risks, scenarios, and recommendations.

**20\.** Measured, calculated, forecast, and verified states are clearly distinct; control actions obey HITL and local interlocks.

**LOCKED — Electrical intelligence never collapses live telemetry, engineering calculation, prediction, and PoVI-verified configuration into one undifferentiated “truth.”**

## **H.11 Data Center / Mission Critical — 20 Locked Decisions**

**1\.** Canonical facility model spans electrical, cooling, controls, fire/life-safety, IT load, fuel, water where applicable, and physical spaces.

**2\.** A/B power paths and cross-ties are explicit.

**3\.** Capacity dimensions include electrical, UPS, generator, cooling, rack/space, network, fuel, and operational constraints.

**4\.** Critical load objects map to dependency/redundancy requirements.

**5\.** UPS/generator autonomy is calculated from current verified configuration plus operational inputs.

**6\.** Cooling dependencies and electrical-cooling coupling are modeled.

**7\.** Thermal/temperature/humidity telemetry is quality-aware.

**8\.** PUE and related metrics are derived with methodology/source transparency.

**9\.** Redundancy state distinguishes design intent, installed configuration, current available redundancy, and degraded state.

**10\.** Blast-radius analysis maps upstream failures/maintenance to downstream services/assets.

**11\.** MOP/SOP/EOP execution checks assumptions against current verified topology/state.

**12\.** Maintenance-risk analysis evaluates loss of redundancy and concurrent work.

**13\.** Concurrent-work conflicts are detected across trades/systems.

**14\.** Alarm-cascade analysis distinguishes root/secondary events where evidence supports it.

**15\.** Load-growth scenarios show capacity exhaustion and required upgrades.

**16\.** AI/HPC readiness considers high-density load, power quality, cooling, redundancy, controls, and growth.

**17\.** OEM replacement/substitution analysis includes fit, rating, maintenance, service, efficiency, supply risk.

**18\.** Compound failure simulation is nondestructive and assumption-labeled.

**19\.** JARVIS mission-critical operations synthesizes Spatial, power, alarms, work, procedures, incidents, commissioning, and maintenance context.

**20\.** Designed redundancy and current operational redundancy are never conflated; machine/safety commands remain governed.

**LOCKED — Mission-critical readiness is continuously derived from verified configuration, live quality-aware state, work/maintenance/incident context, and approved operating rules.**

## **H.12 Field Execution / QA-QC — 20 Locked Decisions**

**1\.** FieldWorkSession is a first-class task-scoped context with user/team, scope, assets/Spatial region, procedure, permits, time, devices, and privacy policy.

**2\.** Requirements auto-assemble from approved design, OEM instructions, codes/standards, project specs, ITPs, and work instructions.

**3\.** Typical installation lifecycle includes RECEIVED → ID VERIFIED → POSITIONED → MOUNTED → CONNECTED → TORQUED → LABELED → INSPECTED → TESTED.

**4\.** Temporary object/material accounting tracks tools, fasteners, covers, debris, leads, jumpers, and temporary equipment where useful.

**5\.** Torque/measurement acceptance relies on calibrated/instrumented evidence or qualified procedure, not image inference alone.

**6\.** Identity/authenticity is checked before installation acceptance.

**7\.** AI assists workmanship/sequence checks but formal inspection remains human/qualified where required.

**8\.** HOLD\_POINT and WITNESS\_POINT are explicit states.

**9\.** NCR/rework lineage is append-only.

**10\.** Deterministic QA gates evaluate required evidence/steps/approvals.

**11\.** Inspection forms/results are structured and source/role/credential aware.

**12\.** Tests retain raw results, instrument identity, calibration, units, and conditions.

**13\.** Progressive capture occurs before concealment where policy requires.

**14\.** Rework preserves original failure/nonconformance evidence and subsequent correction/retest.

**15\.** QA analytics target process/system improvement and avoid default worker ranking.

**16\.** Privacy is task-scoped and proportional.

**17\.** Cross-trade Spatial coordination shows conflicts and dependencies.

**18\.** JARVIS QA copilot guides requirements/evidence and flags missing/conflicting work.

**19\.** Turnover readiness derives from verified field/inspection/test evidence.

**20\.** Field automation cannot bypass safety, ITP, qualification, approval, or PoVI rules.

**LOCKED — Field quality is evidence-backed and attributable; visual AI alone is never treated as proof of hidden/quantitative conditions such as torque or electrical isolation.**

## **H.13 Safety / EHS / Permit-to-Work / LOTO — 20 Locked Decisions**

**1\.** SafetyPermit is first-class with type, scope, location/assets, hazards, controls, qualified people, validity, approvals, and closure.

**2\.** JHA/JSA is structured, versioned, linked to actual work scope, and may be SIR-executable where appropriate.

**3\.** LOTO lifecycle explicitly records identification, shutdown, isolation, lock/tag application, stored-energy control, zero-energy verification, work, restoration, and release.

**4\.** Zero-energy verification requires appropriate physical/procedural/instrument evidence; camera inference alone is insufficient.

**5\.** Energized work has elevated authorization/evidence/qualification requirements.

**6\.** Spatial hazard zones can be dynamic and source/confidence aware.

**7\.** PPE recognition is assistive and never definitive compliance certification.

**8\.** Human STOP\_WORK authority cannot be suppressed by AI or schedule/cost pressure.

**9\.** Deterministic readiness gates can block high-risk progression when required evidence/permit/LOTO state is missing.

**10\.** Near-miss/hazard observations are structured and preserve uncertainty.

**11\.** JARVIS safety copilot correlates permit, JHA, Spatial, assets, live data, incidents, LOTO, tools, qualifications, and procedures.

**12\.** Confined-space requirements include atmospheric/rescue/entry context where applicable.

**13\.** Lifting/rigging workflows can model load, route, exclusion zones, equipment, capacity, and approvals.

**14\.** Work-at-height controls and fall-protection requirements are contextual.

**15\.** Overlapping permits/work scopes are conflict-checked.

**16\.** Emergency operations follow preapproved EOPs/degraded modes rather than ad hoc AI instructions.

**17\.** Qualifications/certifications and expiration are enforced by action scope.

**18\.** Exposure/privacy data is minimized to work purpose.

**19\.** Safety analytics focus on system/process hazards rather than generalized individual surveillance.

**20\.** Every safety-critical action preserves audit/evidence/HITL trail and cannot be silently bypassed by admin/AI.

**LOCKED — STRATUM supports safety execution but never transfers statutory responsibility from accountable persons or organizations.**

## **H.14 Project Controls / Cost / Change — 20 Locked Decisions**

**1\.** Baseline scope, schedule, budget, procurement, and configuration are versioned.

**2\.** Schedule activities may link directly to assets, systems, Spatial regions, drawings, work packages, and evidence.

**3\.** Progress is evidence-backed rather than purely self-reported where feasible.

**4\.** Spatial planned-vs-actual supports installed-quantity progress.

**5\.** Cost model separates estimate, budget, commitment, actual, forecast, change, allowance, contingency, and risk.

**6\.** ETC/EAC predictions are explainable and source/version aware.

**7\.** Earned value uses defined progress rules and distinguishes verified vs reported progress.

**8\.** Change lifecycle is identify → quantify → evaluate → approve/reject → implement → verify → close, with append-only lineage.

**9\.** Delay observations/inferences are separate from accepted contractual/legal conclusions.

**10\.** JARVIS supports lookahead, constraint removal, scenario analysis, and risk synthesis.

**11\.** Productivity analytics are privacy-aware and default to process/system measures rather than worker ranking.

**12\.** Resource planning incorporates skills/qualifications where relevant.

**13\.** Cash-flow forecasts derive from schedule/cost/procurement assumptions.

**14\.** Risk register/contingency drawdown is explicit.

**15\.** Claims/notice support preserves source facts, correspondence, chronology, and inference boundaries.

**16\.** What-if scenarios never overwrite the approved baseline.

**17\.** Role-based dashboards derive from canonical sources.

**18\.** Portfolio views aggregate without erasing project context.

**19\.** AI may recommend replanning/change but cannot alter approved baseline, contract, budget, or authority silently.

**20\.** Estimate→budget→commitment→actual→forecast→change→EAC lineage is canonical and auditable.

**LOCKED — Project controls distinguish planned, approved, actual, forecast, inferred, and verified states.**

## **H.15 Commissioning / Startup / FPT / IST — 20 Locked Decisions**

**1\.** CommissioningPlan defines systems, prerequisites, tests, sequences, roles, witnesses, evidence, and completion criteria.

**2\.** Readiness gates ensure design/installation/QA/safety/permit/configuration prerequisites are satisfied.

**3\.** Startup procedures are versioned and may be executed through SIR/JARVIS/XR guidance.

**4\.** Energization readiness evaluates tools/foreign objects, covers/grounds/leads, protection settings, safety approvals, downstream state, open deficiencies, and required humans.

**5\.** Functional Performance Tests are structured with inputs/actions/expected results/evidence/pass-fail criteria.

**6\.** Integrated Systems Testing covers cross-system sequences and failure modes across power, cooling, controls, life safety, and dependencies.

**7\.** JARVIS may supply live context, check prerequisites, guide steps, and collect evidence within authority limits.

**8\.** Spatial/XR aids navigation, identification, witness context, and anchored evidence.

**9\.** Deficiency → correction → retest → acceptance is append-only.

**10\.** COMMISSIONED is a deterministic lifecycle state dependent on specified evidence/approvals, not a manual status edit.

**11\.** Commissioning creates an immutable/versioned configuration baseline.

**12\.** Sequences of operation are explicit and versioned.

**13\.** Trend/time-series evidence is retained or root-committed at appropriate granularity.

**14\.** Failure-mode tests are governed and safety reviewed.

**15\.** Witness roles/signatures are explicit.

**16\.** Phased turnover/commissioning is supported.

**17\.** Seasonal/deferred tests retain open obligations until completed/waived by authority.

**18\.** Owner/operator training evidence may use XR/VR and structured completion records.

**19\.** Lessons learned feed analytics/recommendations but not uncontrolled self-modifying production rules.

**20\.** Every commissioning result is traceable to procedure version, actual configuration, evidence, witness/approver, and DIR/proof where policy requires.

**LOCKED — Commissioning readiness and completion are evidence-driven state transitions, not descriptive labels.**

## **H.16 Data Architecture / Storage / Sync / Retention / Recovery — 20 Locked Decisions**

**1\.** Every class of data has explicit authority, retention, confidentiality, availability, and reconstruction properties.

**2\.** Authority is separate from storage provider.

**3\.** Storage tiers distinguish validator canonical state, operational DB, telemetry/time-series, Data Room/evidence, Spatial/object store, archives, indexes/caches.

**4\.** Validators retain sufficient canonical state, proofs, key/validator history, protocol versions, and scheduled transitions to validate future history.

**5\.** Neon/PostgreSQL serves operational persistence/projection and may coordinate current serverless implementation, but does not define PoVI authority.

**6\.** Data Room is provider-neutral despite current Google Drive usage.

**7\.** Telemetry/NDIR path uses durable local/edge buffering, time-series/object storage, deterministic aggregation, and MDIR commitments.

**8\.** Spatial geometry is content-addressed through manifests and hashes.

**9\.** Search/vector/graph/dashboard projections are derived and rebuildable.

**10\.** Typed event synchronization is replayable and idempotent.

**11\.** Offline clients record signed local sequence/history and synchronize later without rewriting original occurrence time.

**12\.** Conflicts are resolved semantically rather than last-write-wins.

**13\.** Risk-based replication spans independent failure domains for critical evidence/proofs.

**14\.** Certified snapshots accelerate recovery while binding state/protocol/validator roots.

**15\.** Node roles include validator, archive, edge gateway, OPC bridge, Spatial edge/archive, AI edge, API/event/indexer/artifact/observability.

**16\.** Retention classes R0–R4 govern payload longevity; hashes/proofs may outlive payloads.

**17\.** Backup integrity is periodically restoration-tested.

**18\.** Provider-independent reconstruction begins from Genesis and proof history rather than database backups alone.

**19\.** Storage/provider migrations verify content hashes/manifests before cutover.

**20\.** Data deletion, pruning, archival, redaction, and crypto-shredding do not rewrite finalized commitments.

**LOCKED — Canonical trust survives provider migration, index rebuild, application recovery, and payload relocation.**

## **H.17 Infrastructure / Deployment / Edge-Cloud Runtime — 20 Locked Decisions**

**1\.** Runtime roles are explicit: VALIDATOR, ARCHIVE, EDGE\_GATEWAY, OPC\_BRIDGE, SPATIAL\_EDGE, AI\_EDGE, API, EVENT, INDEXER, ARTIFACT, OBSERVABILITY.

**2\.** Edge handles source-adjacent capture/control buffering; cloud handles scalable application/search/analytics where policy permits.

**3\.** Vercel is an MVP/reference hosting option, not a protocol dependency.

**4\.** Portable validators support PC/RPi/VPS/cloud/industrial edge.

**5\.** Raspberry Pi ARM64 is a first-class low-resource target.

**6\.** Hardware class does not change voting power.

**7\.** Peer discovery supports multiple bootstrap paths.

**8\.** NAT/private network/VPN/relay are connectivity mechanisms only.

**9\.** Transport encryption uses modern authenticated channels while consensus messages retain independent signatures/context.

**10\.** Crash-safe persistent signing/lock state is mandatory for full PoVI validators.

**11\.** Offline nodes may collect evidence/NDIRs but do not manufacture finality without quorum.

**12\.** Snapshot/PFC verification accelerates sync without trusting the snapshot server.

**13\.** Releases/installers are signed and carry SBOM/build provenance.

**14\.** Consensus-affecting upgrades are governed and future-height activated.

**15\.** Rolling application deployment cannot silently change consensus rules.

**16\.** Resource governance isolates heavy non-consensus work from validator safety.

**17\.** Health includes CPU/RAM/storage/network/sync/keys/peers/finality.

**18\.** Service failures are isolated so UI/index/AI outages do not alter consensus truth.

**19\.** Provider portability is periodically demonstrated through reference deployments.

**20\.** No provider, hardware vendor, database, or public chain is required for protocol identity/finality.

**LOCKED — Deployment convenience cannot collapse logical trust boundaries or provider-neutrality.**

## **H.18 Identity / Organizations / Multi-Tenancy / RBAC-ABAC / Credentials — 20 Locked Decisions**

**1\.** Canonical identity types include HUMAN, ORGANIZATION, VALIDATOR, SERVICE, DEVICE, GATEWAY, AI\_AGENT, OEM, SUPPLIER, AUDITOR, AUTHORITY.

**2\.** Organization/tenant structures represent real commercial/operational boundaries.

**3\.** Tenant isolation applies to every module and storage/projection path.

**4\.** RBAC provides understandable role bundles.

**5\.** ABAC evaluates context such as project, asset, qualification, permit, device, location, purpose, time, and risk.

**6\.** Canonical action permissions include READ, CREATE, UPDATE, APPROVE, EXECUTE, CONTROL, EXPORT, SHARE, ADMINISTER.

**7\.** Scope hierarchy supports organization→portfolio→project→site→building→system→asset with explicit exceptions.

**8\.** Identity assurance IAL0–IAL5 expresses increasing confidence/credential assurance.

**9\.** Credentials are structured with issuer, type, scope, jurisdiction, expiry, and evidence.

**10\.** External access is time-/project-/purpose-bounded by default.

**11\.** Delegation is scoped, expiring, revocable, attributable, and cannot amplify authority.

**12\.** Separation of duties may require author≠approver, installer≠inspector, requester≠commercial approver.

**13\.** HITL approval binds exact identity, credentials, role, scope, action hash, target, parameters, revision, evidence, and time.

**14\.** Device identities include manufacturer/model/serial/firmware/certificates/asset binding/trust.

**15\.** AI agents have independent identity/scope and do not inherit unrestricted user authority.

**16\.** Zero-trust service identity rejects implicit trust based on network location.

**17\.** Validator consensus identity remains separate from app/admin identity.

**18\.** Cross-org shared assets/records use scoped grants over a single canonical identity where possible.

**19\.** Identity lifecycle supports INVITED, ACTIVE, SUSPENDED, REVOKED, EXPIRED, RETIRED while retaining historical attribution.

**20\.** No Admin/SUPER\_ADMIN role bypasses engineering, safety, machine-control, or PoVI governance authority.

**LOCKED — Authentication, authorization, credentials, HITL, and PoVI are distinct control layers.**

## **H.19 Interoperability / API / Integration Fabric — 20 Locked Decisions**

**1\.** All external/internal integrations use a governed integration fabric rather than uncontrolled DB coupling.

**2\.** API families cover identity, organizations, projects, assets, Spatial, evidence, documents, incidents, work, maintenance, commissioning, costing, procurement, controls, compliance, OPC UA, Jarvis, and proofs.

**3\.** Stable canonical IDs remain primary; external IDs are aliases.

**4\.** Events are typed/versioned and carry idempotency/provenance.

**5\.** Webhooks/subscriptions are signed, retryable, idempotent, and replay-protected.

**6\.** Imports use deterministic source/event identity and conflict policy.

**7\.** AAS integration maps AAS identifiers/submodels to STRATUM asset/state semantics without replacing canonical assetId.

**8\.** CMMS/EAM integration covers assets/locations/plans/work/failures/parts/meters/warranties.

**9\.** ERP/procurement integration covers vendors/requisitions/POs/receipts/invoices/materials/inventory/contracts.

**10\.** BMS/BAS adapters may support BACnet, OPC UA, Modbus, MQTT, and vendor APIs.

**11\.** SCADA integration strictly separates read telemetry from high-risk writes/commands.

**12\.** Industrial protocol adapters preserve source identity/quality and do not become authority.

**13\.** BIM/IFC/Autodesk/CAD integration preserves original GUID/revision/source transforms.

**14\.** GIS integrates geographic features with Spatial/asset identity.

**15\.** Historian integration treats historian as high-volume source store, not consensus truth.

**16\.** Enterprise SSO may use OIDC/OAuth/SAML/SCIM while authorization remains STRATUM-controlled.

**17\.** Schema registry manages API/event compatibility and migrations.

**18\.** Connector certification levels range from UNVERIFIED through SAFETY\_REVIEWED.

**19\.** JARVIS may use connector context only within identity/privacy/trust scopes and must preserve source/time/conflicts.

**20\.** External writes/actions pass the same authorization/HITL/PoVI rules as native UI actions.

**LOCKED — Connectivity to an external platform never grants that platform canonical or consensus authority.**

## **H.20 UX / Universal Command Center / Design System — 20 Locked Decisions**

**1\.** Role-based home surfaces align to executive, PM, engineer, estimator, procurement, field, commissioning, operator, safety, auditor, owner, admin.

**2\.** JARVIS is contextual across surfaces, not a disconnected chat page.

**3\.** Spatial-first navigation supports site→building→level→room/zone→system→asset→evidence/work/history.

**4\.** Views synchronize Table, 2D, SLD, Spatial3D, Hybrid, XR, Timeline, Dependency Graph.

**5\.** Universal Command Center aggregates risks, incidents, system/validator health, approvals, work, power/capacity, compliance, commissioning, procurement, project controls, and JARVIS.

**6\.** Progressive complexity hides protocol detail until needed.

**7\.** Universal Asset Drawer unifies identity, lifecycle, operational state, Spatial, SLD, config, health, maintenance, incidents, evidence, docs, commercial/commissioning/compliance/proof history.

**8\.** Field mobile is task-first, large-target, camera/QR/NFC/voice-friendly, offline-capable, low-typing.

**9\.** Connectivity/finality states are explicit: ONLINE, OFFLINE, SYNCING, CONFLICT, PENDING\_FINALITY, FINALIZED.

**10\.** Unified Approval Inbox spans engineering, RFI/change, procurement, estimate, commissioning, safety, machine action, validator governance, contract/rule deployment.

**11\.** Incident Workspace combines timeline, assets/Spatial, live data, alarms, media, annotations, people, procedures, actions, hypotheses, evidence, approvals, DIR history.

**12\.** Provenance Explorer explains why a state is believed and traverses source/evidence/approval/MDIR/DIR/PFC.

**13\.** Universal Search spans structured and artifact sources with trust-aware results.

**14\.** Notification classes INFO, ACTION, APPROVAL, WARNING, CRITICAL, SAFETY, GOVERNANCE support ack/assign/escalate/resolve.

**15\.** Dashboards are configurable but do not redefine canonical semantics.

**16\.** Persona views expose appropriate depth and safe actions.

**17\.** Admin UI distinguishes administration from engineering/safety/machine/PoVI authority.

**18\.** Design System components include Asset Card, Trust Badge, Status Chip, DIR Badge, Approval Card, Incident Card, Evidence Card, Spatial Panel, SLD Viewer, Timeline, Dependency Graph, Notification, Data Table, Command Palette, JARVIS Panel, Risk Indicator, Provenance Drawer, Work Stepper.

**19\.** Semantic design tokens encode trust/finality, hazard, uncertainty/conflict, operational state, approvals, connectivity, and privacy consistently.

**20\.** Accessibility includes keyboard, screen reader, contrast, reduced motion, touch targets, safe confirmations, offline/conflict visibility, and measurable acceptance criteria.

**LOCKED — One infrastructure operating system should feel semantically and visually coherent across every module.**

## **H.21 Protocol Verification / Testing / Conformance / Benchmarking — 20 Locked Decisions**

**1\.** Test taxonomy spans unit, integration, protocol, conformance, security, failure, performance, load, recovery, interoperability, safety, AI/HITL, Spatial, field, and release.

**2\.** PoVI safety tests cover conflicting proposals, double votes, stale/context-invalid messages, wrong roots, replay, and malicious proposer behavior.

**3\.** PoVI liveness tests cover proposer failure, slow/partitioned nodes, round changes, message loss, and recovery.

**4\.** Network partitions verify minority halt and no conflicting finality.

**5\.** Byzantine harness simulates equivocation, withholding, flooding, invalid state roots, replay, and corruption.

**6\.** Deterministic execution must match across OS/architecture/runtime implementations.

**7\.** Crash/restart tests exercise persistence before/after VERIFY/LOCK/COMMIT/FINALIZE.

**8\.** Validator lifecycle tests cover install, enroll, sync, candidate, activate, rotate, migrate, degrade, quarantine, retire/revoke.

**9\.** Installer certification covers Windows/macOS/Linux/RPi/cloud/edge, signatures, networking, startup, upgrades, rollback, uninstall.

**10\.** NDIR→MDIR→DIR tests cover malformed payloads, duplicates, sequence gaps, corrections, late arrivals, conflicting evidence, and aggregation proofs.

**11\.** Telemetry benchmarks measure ingress, aggregation, queues, latency, storage growth, OPC point/device scale.

**12\.** Consensus benchmarks measure proposal, VERIFY, COMMIT, finality latency, DIR size, bandwidth, CPU/RAM/storage, validator-count scaling.

**13\.** Raspberry Pi benchmarks include CPU/RAM/storage/network/temperature/power/sync.

**14\.** Spatial/SLD ground-truth tests measure asset identity, topology, X/Y/Z, orientation, route extraction, revision detection, and provenance classifications.

**15\.** OPC UA lab tests quality, timing, certificate rotation, disconnect/replay, alarms, writes/methods, namespace change, invalid NodeIds.

**16\.** Connector conformance tests mapping, auth, pagination, retries, idempotency, schema change, deletion, conflicts, provenance.

**17\.** JARVIS/AI evaluation tests attribution, confidence, hallucination, permission/HITL, unsafe recommendations, prompt injection, tool scope.

**18\.** Security red-team tests tenant escape, key theft, malicious package/document/connector, validator compromise, OPC abuse, AI privilege escalation.

**19\.** Disaster recovery drills reconstruct from Genesis, PFCs, key/validator history, snapshots, state, evidence/Spatial manifests, projections/indexes.

**20\.** Signed Release Verification Manifest records versions, artifacts, test evidence, benchmarks, limitations, approvals, security review, hashes.

**LOCKED — Release status vocabulary is IMPLEMENTED, VERIFIED, CERTIFIED, PRODUCTION\_READY, each requiring increasing evidence.**

## **H.22 Governance / Legal / Policy / IP / Commercialization — 20 Locked Decisions**

**1\.** Governance domains include PROTOCOL, VALIDATOR, ORGANIZATION, PROJECT, SAFETY, CERTIFICATION, COMMERCIAL, DATA, AI.

**2\.** Authority Registry stores authority type, organization/jurisdiction, scope, members, thresholds, effective dates, and status.

**3\.** Protocol governance binds proposed version, change hash, rationale, security/compatibility impact, migration, test evidence, activation height.

**4\.** Validator membership changes are governed canonical actions.

**5\.** Project authority maps design, QA, commissioning, commercial, safety, substitution, and machine-control responsibilities.

**6\.** Delegation is bounded, attributable, expiring, and cannot exceed source authority.

**7\.** Threshold classes may be simple, dual, majority, supermajority, or multiparty high assurance.

**8\.** Emergency controls are scoped/expiring/attributable and cannot rewrite finalized history.

**9\.** Disputes/appeals/corrections are append-only.

**10\.** Cryptographic finality, engineering approval, contractual approval, regulatory acceptance, legal effect, and certification are distinct.

**11\.** Digital signatures preserve identity, intent, scope, document/action hash, verification method, and context.

**12\.** IP classes include STRATUM\_PROPRIETARY, CUSTOMER\_OWNED, OEM\_PROPRIETARY, OPEN\_SOURCE, LICENSED\_THIRD\_PARTY, JOINTLY\_DEVELOPED, CONFIDENTIAL, PUBLIC.

**13\.** Commercial licensing may be by org/site/project/asset/user/module/AI/storage/support and never invalidates prior proof history.

**14\.** Deployment models include SaaS, customer cloud/VPC, on-prem, air-gapped, sovereign, hybrid.

**15\.** Certification is scoped/versioned/evidence-backed/revocable and distinct from simple product listing.

**16\.** Marketplace packages carry publisher/signature/license/permissions/security/compatibility metadata.

**17\.** AI governance controls approved models/providers/data routes/tools/risk envelope and model updates.

**18\.** Standards/policy updates are versioned, reviewed, dated, and traceable.

**19\.** Commercial status cannot buy validator votes, weaker safety, stronger trust classification, or certification.

**20\.** Open-source/proprietary boundaries should favor verifiable protocol/proof interoperability while protecting proprietary Spatial/JARVIS/commercial differentiators according to strategy.

**LOCKED — No pay-to-trust, pay-to-consensus, or pay-to-certification shortcut is permitted.**

## **H.23 Cryptography / PKI / Key Management / Trust Roots — 20 Locked Decisions**

**1\.** Every trust-critical human/org/validator/device/gateway/service/AI/OEM/connector/package publisher has cryptographic identity where technically appropriate.

**2\.** Purpose-specific keys include CONSENSUS, VRF, TRANSPORT, DEVICE, OPC\_UA, USER\_SIGNING, SERVICE, DEVELOPER, PACKAGE\_SIGNING, GOVERNANCE, RECOVERY.

**3\.** Validator identity stores validatorId, consensusPublicKey, vrfPublicKey, transportPublicKey, keyVersions, keyStatus; private keys remain local except explicitly approved custody models.

**4\.** Enrollment codes never contain private keys and local key generation is default.

**5\.** Trust hierarchy may include Protocol Root → Network/Deployment → Organization → Project → device/user/service without cross-domain impersonation.

**6\.** Root rotation changes future trust only and preserves historical authorship verification.

**7\.** Key registry tracks keyId/purpose/algorithm/validity/status/replacement links.

**8\.** Algorithm Registry provides crypto agility rather than permanently hardcoding one algorithm.

**9\.** Domain separation strings distinguish DIR/MDIR/NDIR/PoVI VERIFY/COMMIT/package/approval signatures.

**10\.** Deterministic canonical serialization precedes hashing/signing.

**11\.** Content-address identity remains stable across storage relocation.

**12\.** Merkle hierarchy aggregates NDIRs/batches/project roots/MDIR commitments/DIR roots.

**13\.** Key assurance levels may range from software to OS secure storage, TPM/Secure Enclave, HSM, and managed high assurance; assurance never changes voting weight.

**14\.** Human approvals bind exact action hash/resource/revision/parameters.

**15\.** Device/gateway signatures preserve acting-for-device distinction.

**16\.** Recovery creates future valid authority but leaves old signatures verifiable.

**17\.** Compromise lifecycle covers suspected, confirmed, suspended/quarantined, revoked, rotated/reissued, investigated, closed.

**18\.** Software/package supply-chain signatures cover binary/container/SBOM/source/build provenance/publisher.

**19\.** Post-quantum migration readiness supports algorithm replacement, dual/hybrid signatures, larger proof structures, and governed migration without resetting history.

**20\.** Cryptography must never be marketed as proof of physical truth absent evidence/verification.

**LOCKED — Purpose-specific, versioned, revocable cryptographic identity underpins trust while preserving algorithm agility and historical verification.**

## **H.24 Privacy / Data Sovereignty / Confidential Computing — 20 Locked Decisions**

**1\.** Privacy classification is assigned at object creation using PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED/SAFETY\_SENSITIVE/OT\_SENSITIVE/PERSONAL/HIGHLY\_RESTRICTED.

**2\.** Sovereignty metadata includes allowed/prohibited regions, residency, jurisdiction, customer policy, export restrictions.

**3\.** Proof is separated from payload so canonical commitments need not expose sensitive content.

**4\.** Validators receive the minimum data necessary for deterministic validation.

**5\.** Sensitive DB/Data Room/Spatial/telemetry/edge/backups/mobile data is encrypted at rest.

**6\.** Trust-critical communications are encrypted/authenticated in transit.

**7\.** Tenant-specific encryption boundaries prevent accidental cross-tenant disclosure.

**8\.** Customer-controlled keys/HSM/on-prem/air-gapped custody are supported as deployment options.

**9\.** ABAC evaluates identity/org/project/role/credential/resource/class/location/device/purpose/time.

**10\.** Field/XR privacy is scoped by workSessionId, purpose, area, duration, retention, and authorized users.

**11\.** Generalized worker surveillance and default continuous biometric/productivity tracking are prohibited product objectives.

**12\.** AI routing classes include LOCAL\_ONLY, PRIVATE\_EDGE, PRIVATE\_CLOUD, APPROVED\_EXTERNAL, NO\_AI.

**13\.** Confidential computing/attestation is an optional high-assurance tier.

**14\.** Selective disclosure/privacy-preserving proof techniques may be added where practical.

**15\.** Redaction/access revocation/key destruction can reduce payload accessibility without rewriting finalized commitments.

**16\.** Retention lifecycle includes ACTIVE, ARCHIVED, RETENTION\_HOLD, DELETION\_SCHEDULED, DELETED, CRYPTO\_SHREDDED.

**17\.** Cross-border transfers are policy/jurisdiction aware.

**18\.** Privacy-preserving analytics may use aggregation, pseudonymization, de-identification, tenant-local or federated methods.

**19\.** Privacy incidents follow detect → contain → scope → preserve evidence → notify as required → remediate → verify closure.

**20\.** Privacy policy can restrict payload access/AI processing but cannot retroactively rewrite valid finalized historical commitments.

**LOCKED — STRATUM preserves verifiability while minimizing disclosure and respecting residency/retention/access policy.**

## **H.25 Canonical Schemas / Ontology / Event Registry / API Contracts — 20 Locked Decisions**

**1\.** Every first-class object uses a common canonical envelope with objectId/type/schemaVersion/tenant/org/project/creator/timestamps/status/trust/source/DIR refs.

**2\.** One canonical Asset schema is shared across modules.

**3\.** Project/site/facility hierarchy supports Organization→Portfolio→Project→Campus→Site→Building→Level→Room/Zone→System→Asset as applicable.

**4\.** Evidence uses one canonical schema with evidenceId/type/contentHash/artifact/source/capture/trust/retention/relationships/signatures.

**5\.** NDIR uses one deterministic schema for granular observations.

**6\.** MDIR uses one typed/versioned schema for meaningful events and state transitions.

**7\.** DIR uses one PoVI-finalized schema binding previous hash, MDIR root, state root, validator root, protocol version, proposer, finality proof.

**8\.** Governed Event Registry defines event type/version/subjects/evidence/authority/state effects/priority.

**9\.** State Transition Registry machine-defines allowed source/target states and prerequisites.

**10\.** Relationship ontology standardizes PART\_OF, LOCATED\_IN, FEEDS, FED\_BY, CONNECTED\_TO, PROTECTS, CONTROLLED\_BY, BACKED\_UP\_BY, MAINTAINED\_BY, OWNED\_BY, REPLACED\_BY, DEPENDS\_ON, etc.

**11\.** Property ontology standardizes engineering property names/types/units/source and prevents semantic duplicates.

**12\.** Engineering unit system preserves source and normalized values/units with conversion version.

**13\.** Trust-state vocabulary is canonical across modules.

**14\.** Resource-oriented versioned APIs use stable resources such as projects/sites/assets/spatial-revisions/evidence/incidents/work-orders/estimates/ndir/mdir/dir.

**15\.** Commands and queries are separated so reads do not mutate state.

**16\.** Standard API response envelope includes requestId, success, data, errors, warnings, provenance, schemaVersion, pagination and finality refs when applicable.

**17\.** Machine-readable error taxonomy includes auth/authz/validation/conflict/dependency/evidence/HITL/finality/rate/schema errors.

**18\.** Schema compatibility classifies backward/forward compatible, breaking, and migration-required changes while preserving old interpretation.

**19\.** Canonical schemas generate SDK types/structs/models/OpenAPI/validators/docs/test fixtures.

**20\.** Modules may extend but not redefine shared meanings such as Asset/Evidence/SpatialRef/Identity/NDIR/MDIR/DIR/Incident/Approval/WorkOrder.

**LOCKED — Every authoritative object/event/relationship/property/API/state transition has stable identity, explicit version, deterministic schema, provenance, trust class, and historical interpretation.**

## **H.26 Resource Accounting / Capacity / Economics Without Tokens — 20 Locked Decisions**

**1\.** No cryptocurrency/token is required for network operation.

**2\.** Execution Units meter deterministic consensus work.

**3\.** Storage units are tracked separately from compute.

**4\.** Network/message bandwidth units are tracked separately.

**5\.** Each DIR has bounded consensus-resource limits.

**6\.** MDIRs declare expected resource use before admission.

**7\.** High-volume NDIRs are aggregated so cost scales with meaningful events rather than raw sample count.

**8\.** Multi-tenant fair-share scheduling prevents starvation.

**9\.** Priority traffic remains bounded and cannot claim infinite resources.

**10\.** Protocol versions publish minimum/recommended/archive/enterprise resource profiles.

**11\.** Scale through batching/parallel prevalidation/workgroups/archive/index separation before forcing expensive validators.

**12\.** Heavy rendering/AI/PDF/video/search/analytics remain outside consensus.

**13\.** Storage lifecycle uses hot/warm/cold/archive/permanent-trust tiers.

**14\.** Archive contribution does not increase voting power.

**15\.** Infrastructure cost attribution covers compute/storage/network/AI/Data Room/Spatial/connectors/support.

**16\.** Commercial quotas may cover users/projects/assets/storage/telemetry/AI/Spatial/API while never corrupting history.

**17\.** Capacity pressure triggers warnings, low-priority throttling, increased aggregation, delay, and scaling while preserving safety/protocol traffic.

**18\.** Operational resource growth is forecast from assets/sensors/sample rates/NDIR/MDIR/DIR/evidence/Spatial/retention/AI usage.

**19\.** Low-cost/zero-incremental-cost validator operation is a target where existing hardware/connectivity permit, not a claim of zero economic cost.

**20\.** Commercial payment cannot alter PoVI vote weight, trust class, or canonical finality.

**LOCKED — Integrity, safety, provenance, and finalized history outrank throughput or commercial convenience under capacity pressure.**

## **H.27 Formal PoVI Protocol — 20 Locked Decisions**

**1\.** Consensus phases are PROPOSE → VERIFY → LOCK → COMMIT → FINALIZE.

**2\.** Every consensus message binds chainId, height, round, step, validatorSetRoot, protocolVersion.

**3\.** Each finalized DIR owns one immutable height; failed rounds increment without creating DIRs.

**4\.** At each height the applicable ACTIVE validator set determines N and Q=floor(2N/3)+1.

**5\.** Normal proposer selection uses collective entropy plus per-validator VRF with equal eligible opportunity.

**6\.** Proposer timeout causes round change/new proposer; transient failure is not automatic permanent punishment.

**7\.** Proposal includes previousDIRHash, ordered MDIRs/root, proposed stateRoot, validatorSetRoot, protocolVersion, proposer, proposalHash, VRF proof, signature.

**8\.** Validators independently validate every MDIR for schema/signature/authority/dependencies/evidence/state/resource/module/replay before voting.

**9\.** MDIR deterministic ordering uses validity/dependencies, priority, dependency readiness/depth, accepted sequence, occurrence time, microDirHash.

**10\.** VERIFY signs proposalHash or NIL and validators must not equivocate.

**11\.** Q VERIFY votes form PLC and establish lockedDIR/lockedRound.

**12\.** Unlock/reproposal requires valid higher-round quorum evidence; no free unlock.

**13\.** COMMIT is allowed only with current-round valid lock evidence and binds proposal hash plus state root.

**14\.** Q COMMIT signatures form PFC binding chain/height/round/DIRHash/stateRoot/validatorSetRoot/protocolVersion/signers.

**15\.** PFC verification finalizes height and advances canonical state.

**16\.** Partition without quorum halts finality.

**17\.** Equivocation evidence contains conflicting signed messages and may trigger quarantine-pending while permanent penalty remains governed.

**18\.** Consensus-critical signed state is durably persisted before broadcast.

**19\.** Catch-up verifies snapshots/PFC/hash continuity/state/validator/protocol history and trusts proofs, not peer assertions.

**20\.** Validator/protocol/module changes activate prospectively from finalized state at future heights.

**LOCKED — Under the stated Byzantine and cryptographic assumptions, two conflicting DIRs at the same height must not both obtain valid PFCs.**

## **H.28 Genesis / Bootstrap / Reference Deployment — 20 Locked Decisions**

**1\.** Every STRATUM network has unique chainId, networkName, environment, GenesisDIRHash.

**2\.** Height 0 Genesis DIR establishes trust roots, validator registry, protocol/modules/governance/resource/schema configuration.

**3\.** Genesis never fabricates pre-chain physical history; historical imports remain explicit imports.

**4\.** Current MVP foundation uses Validators A/B/C as initial configured nodes once full protocol conformance exists.

**5\.** Bootstrap package includes authenticated Genesis, trust roots, network/peer information, protocol compatibility, and snapshot discovery.

**6\.** One-click bootstrap verifies Genesis, generates local keys, enrolls, discovers, syncs, enters candidate, then governed ACTIVE.

**7\.** Candidate mode may sync/verify/report health but cannot vote.

**8\.** Validator activation occurs at a future height so all honest nodes agree on membership.

**9\.** Small deployment profile is 3–6 validators with all-validator participation and compact signatures.

**10\.** Medium profile supports 7–20 validators, multiple sites/providers, relays, archives, aggregation, rotating coordination.

**11\.** Enterprise profile supports 20+ validators, multi-org/multi-region, archives, edge, stronger key assurance, security-justified committees.

**12\.** Hybrid hosting may mix Vercel, Raspberry Pi, customer servers, VPS/cloud while preserving equal ACTIVE vote authority.

**13\.** Site edge may package edge gateway, OPC bridge, NDIR buffer, Spatial edge, optional validator/AI while preserving logical separation.

**14\.** Offline sites may collect/prepare work but cannot claim global finality without quorum.

**15\.** Air-gapped networks have independent chainId/Genesis/validators/trust roots/Data Room/Jarvis and require no public internet.

**16\.** Certified snapshots bind snapshot height, DIR/state/validator/protocol/manifests and proof.

**17\.** Recovery reconstructs from Genesis → key/validator history → certified snapshot → subsequent DIR/PFC history.

**18\.** Peer/bootstrap resilience uses multiple discovery paths and no single DNS/server as trust root.

**19\.** Reference deployment manifest declares nodes/regions/providers/network/backup/AI/retention policies.

**20\.** Network lifecycle covers creation, ACTIVE operation, planned shutdown, archival, successor network, migration, and fork-prevention; proof import/export does not create external-chain dependency.

**LOCKED — A STRATUM network can reconstruct trust without depending on Vercel, Neon, Google Drive, or another specific provider.**

# **Appendix I — Final Completeness Audit and Locked Corrections**

After integrating the original architecture, all sixty closure recommendations, the complete locked architecture registry, Naming Conventions, Abbreviations, implementation audit, and updated standards references, the Redbook was audited again for omission and semantic inconsistency.

| Audit area | Result | Locked conclusion |
| :---- | :---- | :---- |
| Naming/terminology consistency | PASS after correction | Canonical user-facing product is STRATUM Spatial Verified; legacy Twin/block/chain naming is isolated to compatibility notes. |
| Abbreviations/acronyms | PASS after addition | Dedicated front-matter table now defines protocol, engineering, OT, security, Spatial, commissioning, and commercial abbreviations. |
| Previously locked 20-point sets | PASS after correction | Complete Locked Architecture Registry now preserves the major numbered decision sets individually instead of relying on compressed prose. |
| Implemented/Partial/Planned discipline | PASS | The document explicitly distinguishes conceptually locked architecture from current implementation evidence. |
| PoVI vs current validator implementation | PASS | Current 2-of-3 serverless signature network remains classified as implemented foundation but non-conforming to target PoVI quorum/state machine. |
| Data classification | PASS | Master matrix plus canonical data-class chapter covers telemetry, docs, Spatial, assets, states, incidents, approvals, maintenance, estimates, AI, audit, search, DIR history. |
| Trust semantics | PASS | Physical truth, provenance, approval, live state, engineering verification, and PoVI finality are kept distinct. |
| Spatial terminology and coordinate provenance | PASS | Spatial model terminology, evidence hierarchy, geometry confidence and normative closure requirements are included. |
| JARVIS authority boundary | PASS | Agent orchestration, AI provenance, HITL, privacy, continuous observation limits, and no-self-escalation are explicit. |
| Safety/commissioning/field | PASS | ITP, PTW/LOTO, FPT/IST, readiness gates, evidence, calibrated instruments, and statutory responsibility boundary are included. |
| Standards/licensing | PASS with ongoing maintenance requirement | NFPA and other licensed standards are rights-aware; the Redbook forbids unauthorized cloning and requires version/applicability traceability. |
| Interoperability | PASS | OPC UA, AAS, IFC/BIM/CAD/GIS/CMMS/EAM/BMS/SCADA/ERP connector principles and mapping requirements are present. |
| Cryptography and PQ migration | PASS after reference update | Key-purpose separation, agility, post-quantum migration readiness, and current NIST PQC references are present. |
| SRE / incident / recovery | PASS | Observability, provider-independent recovery, snapshots, catastrophic governance ceremonies, and platform incident lifecycle are included. |
| Open-source/IP/legal boundaries | PASS at architecture level | Required distinctions are defined; precise licensing strategy remains a governed business decision rather than an accidental omission. |
| Numeric limits | INTENTIONALLY OPEN | Consensus/resource/Spatial/availability thresholds that require empirical data are marked benchmark-derived rather than fabricated. |
| Machine-readable normative schemas | DEFINED AT CATALOG LEVEL; IMPLEMENTATION FOLLOW-ON | Required schema families/fields are cataloged; exact byte/datatype/test-vector specification is the next protocol engineering artifact. |
| Repository-by-repository implementation status | PARTIAL BY DESIGN | Initial evidence-based audit is included. A deeper live source audit remains ongoing implementation work, not missing architecture. |

## **I.1 Additional Recommendations Locked by the Final Audit**

* Every future Redbook revision MUST maintain a machine-readable traceability index from Redbook requirement → schema/event/module → implementation repo/service → tests → release status.  
* The formal PoVI protocol specification SHOULD become a separate normative companion document generated from the Redbook, with pseudocode, exact canonical datatypes, wire encodings, domain strings, and test vectors.  
* The canonical schema/event registry SHOULD live in a dedicated shared package/repository consumed by STRATUM Spatial Verified, validators, Data Room, AI Costing, JARVIS, SDKs, and connectors to prevent semantic drift.  
* The STRATUM Proof Verifier SHOULD be kept architecturally independent from application/database services so auditors can verify DIR/PFC/MDIR/NDIR proofs offline.  
* Every major release SHOULD regenerate Appendix C implementation status from evidence rather than manually carrying forward stale classifications.

**LOCKED — These five final-audit recommendations are approved and incorporated as Redbook governance requirements. No additional missing architecture domain was identified after this correction pass; remaining open items are implementation-grade formalization, empirical benchmarking, and source-code convergence.**

**Appendix J — References**

**Part I — Foundations**

1\. Vision, Scope, and Architectural Principles

2\. Canonical Terminology and Trust Vocabulary

3\. STRATUM Ecosystem and Module Boundaries

4\. Data Classes and Authority Model

5\. Nano DIR, Micro DIR, and DIR Trust Hierarchy

**Part II — STRATUM Chain and PoVI**

6\. Proof of Verified Infrastructure (PoVI)

7\. Proposer Selection and Concealed Randomization

8\. Consensus State Machine and Finality

9\. Validator Identity, Enrollment, Governance, and Recovery

10\. Genesis, Bootstrap, Snapshots, and Network Lifecycle

11\. Cryptography, PKI, Keys, and Trust Roots

12\. Smart Rules, SIR, DSL, WASM, and Optional EVM Compatibility

13\. Resource Accounting and Tokenless Economics

14\. Protocol Verification, Conformance, and Benchmarking

**Part III — Spatial and Infrastructure Semantics**

15\. STRATUM Spatial Data Model and Asset Ontology

16\. SLD-to-Spatial X/Y/Z Reconstruction

17\. Reality Capture, XR, and Field Spatial Computing

18\. Engineering Calculations and Mission-Critical Power Intelligence

19\. Codes, Standards, OEM Knowledge, and Jurisdiction Resolution

**Part IV — Evidence, Data, and Platform Services**

20\. STRATUM Data Room

21\. Evidence, Provenance, Artifacts, and Proof Packages

22\. Data Architecture, Storage, Sync, Retention, and Disaster Recovery

23\. Shared Platform Services

24\. Identity, Organizations, Multi-Tenancy, RBAC/ABAC, and Credentials

25\. Privacy, Sovereignty, Confidential Computing, and Data Rights

26\. Interoperability, APIs, AAS, BIM/IFC, CMMS/EAM, BMS/SCADA, ERP, and GIS

**Part V — AI, Commercial Intelligence, and Work Execution**

27\. JARVIS — STRATUM Chief AI Orchestrator

28\. AI Agents, Provenance, Authority, and HITL

29\. STRATUM AI Costing

30\. Procurement, Supply Chain, Commercial Intelligence, and Contract Controls

31\. Project Controls, Schedule, Cost, Change, and Earned Progress

32\. Field Execution and QA/QC

33\. Safety, EHS, Permit-to-Work, and LOTO

34\. Commissioning, Startup, FPT, and IST

35\. Operations, Maintenance, Reliability, and Predictive Intelligence

**Part VI — Security, UX, Deployment, and Governance**

36\. Cybersecurity and OT Zero Trust

37\. UX, Universal Command Center, and STRATUM Design System

38\. Infrastructure, Edge-Cloud Runtime, and One-Click Validator Packaging

39\. Governance, Legal Authority, IP, Certification, and Commercialization

40\. Deployment Profiles, SLO/SLA, Observability, and Platform Incident Management

**Part VII — Normative Closure Audit (All 60 Locked)**

41\. Master Data Classification and Trust Mapping

42\. Formal PoVI and Wire Protocol Closure

43\. Canonical Ontology, Event Registry, and Engineering Services

44\. Trust, HITL, JARVIS, Knowledge, and Regulatory Closure

45\. Security, Secrets, Networking, Upgrades, and SRE Closure

46\. Data, Spatial, Data Room, Costing, Commercial, Safety, and UX Closure

47\. Deployment, Legal, Open-Source Boundaries, Namespace, and Network Lifecycle

**Part VIII — Implementation Baseline**

48\. Evidence-Based Implementation Audit

49\. Implemented / Partial / Planned Matrix

50\. Dependency Graph and Recommended Build Order

**Appendices**

Appendix A — Master Data Classification Matrix

Appendix B — Master Event and State Registry

Appendix C — Master Implementation Status Matrix

Appendix D — Normative Protocol Schema Catalog

Appendix E — HITL Authority Matrix

Appendix F — Trust-State and Terminology Migration Glossary

Appendix G — Reference Deployment Profiles

Appendix H — APA References

# **Part I — Foundations**

## **1\. Vision, Scope, and Architectural Principles**

### **Independent infrastructure trust**

STRATUM Chain is an independent permissioned trust network. No external public blockchain is required in production.

**LOCKED — STRATUM Chain is an independent permissioned trust network. No external public blockchain is required in production.**

### **Provider neutrality**

Vercel, Neon, Google Drive, Matterport, cloud providers, and other platforms are implementation providers, not sources of consensus authority.

**LOCKED — Vercel, Neon, Google Drive, Matterport, cloud providers, and other platforms are implementation providers, not sources of consensus authority.**

### **Spatial, not digital twin**

STRATUM Spatial Verified models infrastructure spatially, logically, operationally, commercially, and historically while preserving provenance and trust state.

**LOCKED — STRATUM Spatial Verified models infrastructure spatially, logically, operationally, commercially, and historically while preserving provenance and trust state.**

### **One canonical history**

Trust-critical history is append-only. Corrections, supersession, revocation, and dispute resolution are new events; finalized history is never silently rewritten.

**LOCKED — Trust-critical history is append-only. Corrections, supersession, revocation, and dispute resolution are new events; finalized history is never silently rewritten.**

### **Safety before convenience**

When safety, quorum, evidence, authorization, or deterministic validation is insufficient, STRATUM halts or requires human verification rather than guessing.

**LOCKED — When safety, quorum, evidence, authorization, or deterministic validation is insufficient, STRATUM halts or requires human verification rather than guessing.**

### **AI never equals authority**

AI may observe, infer, recommend, draft, simulate, and execute explicitly permitted low-risk actions, but AI output does not become canonical merely because it was generated.

**LOCKED — AI may observe, infer, recommend, draft, simulate, and execute explicitly permitted low-risk actions, but AI output does not become canonical merely because it was generated.**

### **Storage is not authority**

A database row, file, Spatial model, search index, or AI result is not authoritative merely because it exists.

**LOCKED — A database row, file, Spatial model, search index, or AI result is not authoritative merely because it exists.**

### **Cryptography is necessary but not sufficient**

Signatures and hashes prove integrity/provenance; physical truth still depends on evidence, instruments, qualified humans, machine state, and governed finality.

**LOCKED — Signatures and hashes prove integrity/provenance; physical truth still depends on evidence, instruments, qualified humans, machine state, and governed finality.**

## **2\. Canonical Terminology and Trust Vocabulary**

### **STRATUM Spatial Verified**

Canonical product/application name. Legacy 'Twin' terminology is deprecated in user-facing language.

### **STRATUM Chain**

Independent permissioned blockchain/trust network.

### **Digital Immutable Record (DIR)**

Native PoVI-finalized canonical consensus unit; analogous to a conventional blockchain block.

### **Genesis DIR**

Height-zero trust configuration and canonical network origin.

### **Nano DIR (NDIR)**

Smallest cryptographically referencable granular observation/evidence/data unit. Typically source-centric and high-volume; usually not independently PoVI-finalized.

### **Micro DIR (MDIR)**

Meaningful signed infrastructure event or proposed state transition referencing one or more NDIRs/evidence items. Canonical when included in a finalized DIR.

### **PoVI**

Proof of Verified Infrastructure, STRATUM's permissioned BFT consensus protocol.

### **PFC**

PoVI Finality Certificate, proving \>2/3 COMMIT signatures for a finalized DIR.

### **PLC**

PoVI Lock Certificate, proving \>2/3 VERIFY votes for a proposal/round.

### **JARVIS**

STRATUM Chief AI Orchestrator and conductor of specialist AI agents.

### **SIR**

STRATUM Intermediate Representation for deterministic authoring of workflows, rules, contracts, OPC UA bindings, and deployable logic.

### **Trust vocabulary**

POVI\_VERIFIED | FIELD\_VERIFIED | SURVEYED | SCANNED | OEM\_VERIFIED | SOURCE\_VERIFIED |  
LIVE | STALE | UNCERTAIN | CONFLICTED | INFERRED | PREDICTED | AI\_GENERATED | UNVERIFIED

**LOCKED — Trust-state words MUST retain stable meanings across every STRATUM module.**

## **3\. STRATUM Ecosystem and Module Boundaries**

* STRATUM Spatial Verified  
* STRATUM Chain  
* STRATUM Data Room  
* STRATUM AI Costing  
* JARVIS — STRATUM Chief AI Orchestrator  
* STRATUM Studio / SIR  
* OPC UA Bridge / Edge Runtime  
* Asset Intelligence  
* Field Execution / QA-QC  
* Safety / EHS / PTW / LOTO  
* Commissioning / Startup / FPT / IST  
* Operations / Maintenance / Reliability  
* Procurement / Supply Chain  
* Project Controls  
* Compliance / Audit / Turnover  
* Shared Identity / Evidence / Annotation / Incident / HITL Services

**LOCKED — Modules exchange typed canonical objects/events and do not mutate one another's databases directly.**

## **4\. Data Classes and Authority Model**

Every data object declares:  
authorityClass • retentionClass • confidentiality • availabilityRequirement • reconstructionCapability • storagePolicy

The authority of an object derives from its provenance, signatures, applicable approvals, canonical state, PoVI finality, and trust classification—not from the database, file provider, or UI displaying it.

**LOCKED — Authority MUST remain separable from storage location.**

## **5\. Nano DIR, Micro DIR, and DIR Trust Hierarchy**

RAW SOURCE  
  ↓  
Nano DIR(s) — What was observed?  
  ↓ aggregation / Merkle root  
Micro DIR(s) — What happened?  
  ↓ proposal / deterministic validation  
PoVI consensus  
  ↓  
DIR — What did the validator network finalize?  
  ↓  
FINALIZED CANONICAL STATE

NDIRs may represent individual sensor values, OPC UA values, measurements, XR observations, image/frame hashes, tool/fastener observations, or other granular source records. MDIRs represent meaningful events such as ASSET\_REGISTERED, ASSET\_INSTALLED, INSPECTION\_COMPLETED, TEST\_PASSED, PROTECTION\_TRIP, MAINTENANCE\_COMPLETED, SPATIAL\_POSITION\_VERIFIED, or INCIDENT\_REPORTED.

NDIRs may be signed directly by devices. If the device cannot sign, a gateway may sign with explicit acting-for-device provenance; dual signatures are permitted. NDIR batches are aggregated deterministically using Merkle structures. MDIRs follow SUBMITTED → VALIDATED → PENDING FINALITY → FINALIZED; finalization occurs only through the containing DIR.

**LOCKED — The three-layer hierarchy NDIR → MDIR → DIR is permanent STRATUM terminology.**

### **Canonical placement of major information types**

| Information | Primary category | Treatment |
| :---- | :---- | :---- |
| Sensor readings / raw telemetry | OPC\_UA\_TELEMETRY \+ NANO\_DIR | High-volume source data in time-series/object storage; hashes/roots flow into MDIRs when significant. |
| Design files / drawings / specifications | DOCUMENT \+ EVIDENCE; SPATIAL\_MODEL when parsed/mapped | Data Room holds artifacts; content hashes and revisions preserve provenance. |
| Activities / work execution | APPLICATION\_STATE; meaningful completion/transition → MICRO\_DIR | Task progress remains workflow data; trust-critical milestones become MDIRs. |
| Statuses | APPLICATION\_STATE or derived projection; trust-critical lifecycle state derives from finalized MDIR/DIR | UI status alone is never authoritative. |
| Assets themselves | Canonical Asset object in APPLICATION\_STATE, with authoritative lifecycle/configuration anchored to CONSENSUS\_STATE where required | Asset identity persists independently of storage. |
| Asset states | MICRO\_DIR state transitions → DIR → CONSENSUS\_STATE | Lifecycle state is reconstructable from finalized history. |
| Incidents | APPLICATION\_STATE \+ EVIDENCE \+ AUDIT; significant incident transitions → MICRO\_DIR | Incident evidence and facts retain source/trust distinctions. |
| Approvals | AUDIT \+ EVIDENCE; trust-critical approval outcome → MICRO\_DIR | Approval is tied to exact action/revision and authorized identity. |
| Maintenance | APPLICATION\_STATE; completed/verified maintenance → MICRO\_DIR; telemetry may be NDIR | History remains traceable to evidence and finality. |
| Spatial geometry | SPATIAL\_MODEL; source capture → REALITY\_CAPTURE; trust-relevant revisions may be committed via MDIR/DIR | Large meshes/point clouds remain off-validator with cryptographic commitments. |
| AI recommendations | AI\_DERIVED | Never canonical merely because AI produced them. |
| Estimates / forecasts | APPLICATION\_STATE \+ AI\_DERIVED where AI-assisted | Approved revisions retain explicit lineage; commercial approval and PoVI are distinct. |
| Security events | SECURITY\_EVENT \+ AUDIT; trust-critical incidents/revocations may become MDIR | Operational logging remains distinct from canonical trust history. |
| Search indexes / embeddings | SEARCH\_INDEX / CACHE | Disposable and rebuildable; never authority. |
| Finalized network history | DIR\_HISTORY \+ CONSENSUS\_STATE | Validator/archive layer with PFC-backed finality. |

# **Part II — STRATUM Chain and PoVI**

## **6\. Proof of Verified Infrastructure (PoVI)**

PoVI is STRATUM's permissioned Byzantine-fault-tolerant consensus model. Its safety mechanics intentionally draw on established BFT patterns such as locking, supermajority voting, and deterministic state-machine replication; the architecture does not claim novel consensus mathematics merely for using these patterns.

PROPOSE → VERIFY → LOCK → COMMIT → FINALIZE

For N ACTIVE validators at a height, the quorum is Q \= floor(2N/3) \+ 1\. Therefore: 3→3, 4→3, 5→4, 6→5, 7→5, 8→6, 9→7, 12→9. The safety assumption is fewer than one-third Byzantine validator authority, plus standard cryptographic assumptions.

**LOCKED — No quorum means no finality. During partitions, PoVI prioritizes safety over availability.**

## **7\. Proposer Selection and Concealed Randomization**

Normal proposer selection combines a collective unpredictable seed with per-validator verifiable random functions (VRFs), preserving equal protocol opportunity among eligible validators. Small networks may have all validators publish VRF contributions; larger networks may use threshold entropy committees and security-driven validation committees.

The proposer winner is the lowest valid VRF output, with deterministic tie-breaking by validator sequence and then public-key hash. A coordinator, where used, is a cryptographic/logistical role rather than a source of finality authority, and proposer/coordinator separation is preferred where practical.

### **Emergency fallback**

If normal randomization is unavailable, PoVI may use a coordinatorless Fibonacci–KCA fallback. KCA is explicitly a finite approximation because exact Kolmogorov complexity is incomputable. Fibonacci offsets 1, 2, 3, 5, 8... modulo N may be combined with SHA-256. The fallback MUST NOT be described as cryptographically random by itself.

**LOCKED — Hardware power, purchased resources, or payment never increases proposer probability.**

## **8\. Consensus State Machine and Finality**

### **Height and rounds**

Each finalized DIR occupies one height. Failed rounds do not create DIRs; they increment the round until a valid DIR finalizes.

### **Proposal**

A proposal binds chainId, height, round, previousDIRHash, deterministic MDIR order/root, proposed stateRoot, validatorSetRoot, protocolVersion, proposerId, VRF proof, and signature.

### **VERIFY**

Validators independently validate schema, signatures, authority, dependencies, evidence requirements, state transitions, resource limits, module execution, and replay protection, then sign VERIFY(proposalHash) or VERIFY(NIL).

### **LOCK**

Q valid VERIFY votes create a PLC. Validators persist lockedDIR and lockedRound. A valid lock cannot be abandoned by preference.

### **Unlock**

A lock changes only through protocol-valid higher-round evidence satisfying safe unlock/re-proposal rules.

### **COMMIT**

A validator commits only to a proposal with valid current-round lock evidence and binds proposal hash plus deterministic state root.

### **PFC**

Q valid COMMIT signatures form a PFC containing/committing to chainId, height, round, DIRHash, stateRoot, validatorSetRoot, protocolVersion, signer set, and signatures.

### **FINALIZE**

After PFC verification, the DIR becomes canonical, state advances, and height increments.

### **Crash safety**

Consensus-critical signed state is durably persisted before broadcast to prevent restart-induced double signing.

### **Catch-up**

A lagging validator verifies certified snapshots, PFCs, hash continuity, validator-set changes, protocol versions, and deterministic state transitions; it trusts proofs, not the sender.

**LOCKED — Two conflicting DIRs MUST NOT both obtain valid PFCs at the same height under the stated Byzantine and cryptographic assumptions.**

## **9\. Validator Identity, Enrollment, Governance, and Recovery**

CANDIDATE → ACTIVE → DEGRADED → QUARANTINED → RETIRED / REVOKED

Every validator has a permanent validatorId and a permanent, non-reused friendly label such as Validator A, B, C, D. The real security identity is an immutable UUID/public key identity. One ACTIVE validator equals one vote.

Keys are purpose-separated: Consensus, VRF, and Transport at minimum; governance/threshold keys may be separate. Enrollment codes are single-use and short-lived; they never contain private keys. Keys are generated locally. Candidate validators may sync and verify but may not vote until governance activates them at a future height.

Objective health metrics may move a node to DEGRADED. Equivocation or objective severe faults may trigger quarantine-pending, while permanent penalties remain governed. Membership and key-recovery governance uses supermajority policy over eligible authority. Quorum is never lowered because nodes are offline.

**LOCKED — Validator identity persists across authorized device migration; a Raspberry Pi Validator D can later migrate to a PC/VPS and remain Validator D.**

## **10\. Genesis, Bootstrap, Snapshots, and Network Lifecycle**

Every network has a unique chainId, networkName, environment, and GenesisDIRHash. Height 0 is the Genesis DIR and establishes the initial protocol version, validator registry, trust roots, module registry, governance authorities, resource policy, and canonical schema versions.

Imported pre-existing records are not fabricated into Genesis history; they enter as explicit historical imports with provenance.

Install → verify Genesis → local key generation → enrollment → peer discovery → proof-verifying sync → CANDIDATE → governed ACTIVE

Certified snapshots bind snapshotHeight, DIRHash, stateRoot, validatorSetRoot, protocolVersion, stateManifestRoot, SpatialManifestRoot, and certificate. Catastrophic reconstruction follows Genesis → key/validator history → latest valid snapshot → subsequent DIR/PFC history → current canonical state.

**LOCKED — No database backup or cloud provider alone defines recovered truth.**

## **11\. Cryptography, PKI, Keys, and Trust Roots**

* Actors include humans, organizations, validators, devices, gateways, services, AI agents, OEMs, connector publishers, and package publishers.  
* Purpose-specific keys: CONSENSUS, VRF, TRANSPORT, DEVICE, OPC\_UA, USER\_SIGNING, SERVICE, DEVELOPER, PACKAGE\_SIGNING, GOVERNANCE, RECOVERY.  
* Local key generation is default; validator private keys are not centrally generated or silently escrowed.  
* Trust hierarchy may include protocol root → deployment/network authority → organization → project → device/user/service, but domains cannot impersonate one another.  
* Key history is versioned with ACTIVE, ROTATED, EXPIRED, REVOKED, COMPROMISED, RETIRED states.  
* Cryptographic algorithms are registry-driven and migration-capable; algorithm agility and future hybrid/post-quantum migration are designed in.  
* Domain separation strings distinguish DIR, MDIR, NDIR, VERIFY, COMMIT, package signing, approvals, and other signatures.  
* Canonical serialization precedes hashing/signing. RFC 8785-like JSON canonicalization is the initial interoperability baseline (Rundgren et al., 2020).  
* Content-addressed artifacts preserve identity across storage migration.  
* NDIR/evidence collections use Merkle structures for scalable proof of inclusion.  
* Hardware assurance may range from software keys to OS secure storage, TPM/Secure Enclave, HSM, and higher-assurance modules; assurance never changes voting weight.  
* Human approvals bind action hash, target, parameters, revision, identity, credential state, and time.  
* Device signatures and gateway acting-for-device signatures remain distinguishable.  
* Recovery restores future authority; it never rewrites historical signatures.  
* Production packages should carry binary/content hash, SBOM hash, source/build provenance, publisher identity, and signature.

**LOCKED — Cryptography proves identity, integrity, provenance, and protocol participation—not physical truth by itself.**

## **12\. Smart Rules, SIR, DSL, WASM, and Optional EVM Compatibility**

* Native PoVI deterministic modules are the mandatory highest-authority runtime.  
* No external I/O inside consensus execution.  
* Explicit read/write scopes and namespace/capability isolation.  
* Deterministic outputs such as ACCEPT, REJECT, REVERT, and state updates.  
* Versioned modules activated by governed future height.  
* Execution Units meter compute without a token.  
* Atomic execution: invalid trust-critical execution rejects the candidate transition.  
* Dependencies are acyclic, bounded, and typed.  
* Emergency suspension is narrow, reasoned, evidence-backed, time-bounded, and governed.  
* Runtime hierarchy: Native PoVI → STRATUM DSL → sandboxed deterministic WASM → optional Solidity/EVM compatibility.  
* All runtimes share SIR, deterministic metering, state, no-I/O rules, versioning, governance, and atomic behavior.  
* Deployable contracts are permissioned and carry developer identity, hash, interfaces, resource profile, review state, governance approval, and activation height.  
* Cross-runtime calls are typed, bounded-depth, and atomic.  
* Randomness is PoVI-provided and domain-separated.  
* OPC UA command capabilities are explicitly declared with control tier and HITL requirements.  
* Compilation, determinism, permissions, resource limits, simulation, historical replay, and security tests precede governed activation.  
* Runtime failures trap/reject/revert without killing the validator; repeated faults may lead to scoped suspension.

**LOCKED — No programmable runtime can override PoVI invariants, safety policy, or HITL.**

## **13\. Resource Accounting and Tokenless Economics**

* No mining reward, staking reward, gas token, or speculative cryptocurrency is required.  
* Execution Units meter deterministic state reads/writes, hashing, signature/proof verification, contract instructions, and bounded compute.  
* Storage and network usage are tracked separately from execution.  
* DIRs have bounded MDIR count, size, EUs, signature checks, and state writes; exact caps are benchmark-driven.  
* MDIRs declare expected resource use before admission.  
* High-volume NDIRs are aggregated cryptographically rather than finalized sample-by-sample.  
* Multi-tenant ingress uses deterministic fair-share scheduling and anti-starvation.  
* P0/P1 priority is not an unlimited resource bypass.  
* Minimum/recommended/archive/enterprise resource profiles are published per protocol version.  
* Scale outward through batching, parallel prevalidation, workgroups, archives, indexers, and horizontal app services before forcing expensive validator hardware.  
* 3D rendering, AI inference, video/PDF processing, search, and analytics stay out of consensus.  
* Storage tiers include hot, warm, cold, archive, and permanent trust.  
* Archive contribution never grants extra votes.  
* Commercial charges may reflect compute, storage, network, AI, Spatial processing, connectors, support, users, projects, assets, and retention, but never buy consensus authority.  
* Overload should warn, aggregate more, throttle low priority, scale services, and preserve safety/protocol traffic; durably accepted records are not silently dropped.  
* Zero-dollar validator operation may be a practical target when hardware/connectivity already exist, but the architecture does not claim infrastructure has zero economic cost.

**LOCKED — Commercial pricing and protocol authority are strictly separate.**

## **14\. Protocol Verification, Conformance, and Benchmarking**

* Canonical test taxonomy: unit, integration, protocol, conformance, security, failure, performance, load, recovery, interoperability, safety, AI/HITL, Spatial, field, and release acceptance.  
* PoVI safety tests: conflicting proposals, equivocation, stale/out-of-order messages, malicious proposer, minority Byzantine behavior.  
* PoVI liveness tests under proposer failure, slow nodes, disconnects, round changes, message loss, and restart.  
* Partition tests verify quorum-side finality and minority halt.  
* Byzantine validator harness intentionally double-votes, proposes wrong state roots, replays, floods, withholds, and corrupts proposals.  
* Cross-platform deterministic execution must produce identical state and stateRoot on x86\_64 and ARM64.  
* Crash/restart testing covers persistence boundaries around VERIFY, LOCK, COMMIT, and FINALIZE.  
* Validator installer lifecycle tests cover install, enroll, candidate, sync, approve, active, rotate, migrate, retire/revoke.  
* One-click installer certification covers Windows, macOS, Linux, Raspberry Pi, cloud VM, industrial edge, signatures, startup, networking, sync, upgrade, rollback, and uninstall.  
* End-to-end NDIR→MDIR→DIR tests cover malformed inputs, duplicates, sequence gaps, corrections, late arrivals, and conflicting evidence.  
* Telemetry benchmarks measure NDIR ingest, OPC UA points/devices, aggregation latency, MDIR rate, queue depth, and storage growth.  
* Consensus benchmarks measure proposal/VERIFY/COMMIT/finality latency, DIR size, resource use, network bandwidth, and validator count effects.  
* Raspberry Pi benchmarks explicitly measure CPU, RAM, storage, bandwidth, temperature, power, and sync.  
* Spatial/SLD ground-truth tests measure identity, topology, X/Y/Z, orientation, route extraction, revision detection, and distinguish inferred/drawing/field-verified accuracy.  
* OPC UA lab tests quality codes, clock drift, certificate rotation, disconnect/replay, alarms, writes, methods, namespace changes, and invalid NodeIds.  
* Connector conformance tests auth, mapping, idempotency, retries, pagination, schema evolution, deletion, conflicts, provenance, and timestamps.  
* Jarvis/AI tests attribution, confidence calibration, hallucination, permissions, HITL escalation, unsafe recommendation rejection, and tool scope.  
* Security/red-team tests tenant breakout, validator compromise, key theft, prompt injection, malicious documents/connectors/packages, OPC UA abuse, replay, and privilege escalation.  
* Disaster recovery drills reconstruct from Genesis, PFC history, validator/key history, snapshots, state, Spatial/evidence manifests, application projections, and indexes.  
* Release verification manifests record versions, artifacts, tests, benchmarks, known limitations, security assessment, approvals, and hashes.

**LOCKED — Implemented, Verified, Certified, and Production Ready are distinct statuses and MUST NOT be used interchangeably.**

# **Part III — Spatial and Infrastructure Semantics**

## **15\. STRATUM Spatial Data Model and Asset Ontology**

* Stable assetId independent of external IDs or geometry.  
* Hierarchical containment plus typed relationship graph.  
* Geometry supports point, line, polyline, polygon, bounding box, mesh/model reference, local/site/BIM/geographic/floor coordinate systems.  
* Geometry is separate from identity.  
* Preserve source provenance from BIM, IFC, Revit, CAD, PDF, OEM, SCADA, CMMS, GIS, and field capture.  
* Extensible ontology across electrical and non-electrical domains with OEM extensions.  
* Electrical topology relations include FEEDS, FED\_BY, PROTECTS, SWITCHES, PARALLELS, TIES, BYPASSES, GROUND and related ratings.  
* Staged BIM/CAD/PDF ingestion with AI confidence and review.  
* Multi-source conflicts are explicit rather than silently merged.  
* Typed engineering properties carry units and source.  
* Spatial revisions are append-only.  
* Dependency/impact analysis is deterministic where based on verified graph state.  
* Live and authoritative states are explicit: LIVE, VERIFIED, CONFLICTED, STALE, INFERRED.  
* Design→procured→installed→commissioned→as-built reconciliation is preserved.  
* Evidence anchors may be granular to component/region/geometry.  
* AI/predictive annotations remain PREDICTED, INFERRED, or RECOMMENDED.  
* Federated multi-site models are supported.  
* DIR-bound snapshots enable historical reconstruction.  
* Spatial quality states include DRAFT, IMPORTED, MAPPED, VALIDATED, ENGINEERING\_REVIEWED, VERIFIED, CONFLICTED.  
* Open interoperability includes IFC/BIM/CAD/GIS/OPC UA/AAS/BMS/SCADA/CMMS/EAM/OEM/Data Room.

**LOCKED — Visualization is not authority; Spatial identity, semantics, geometry revision, topology, source provenance, and trust class remain explicit.**

## **16\. SLD-to-Spatial X/Y/Z Reconstruction**

A single-line diagram provides logical topology; its drawing coordinates are not assumed to be physical X/Y/Z. STRATUM reconstructs physical position from an evidence hierarchy.

LiDAR / verified scan  
→ as-built BIM/IFC  
→ survey / field measurement  
→ approved architectural/MEP  
→ elevations / sections  
→ riser  
→ schedules  
→ OEM dimensions / mounting  
→ verified photos/capture  
→ OPC UA mapping  
→ SLD  
→ AI/geometric inference

* Maintain zFloor, zBase, zCenter, zTop, mountingElevation, connection elevations, and clearance volumes.  
* Use global/site → building → level → room floor → equipment datum hierarchy.  
* Reconstruct busway, tray, conduit, feeders, risers, ductbanks, and control routes using ports, allowed zones, bend radii, clearances, and obstacles.  
* Use OEM port-aware geometry and constraint solving rather than unconstrained AI guessing.  
* Provenance states: SURVEYED, SCANNED, AS\_BUILT, BIM\_VERIFIED, DRAWING\_DERIVED, FIELD\_VERIFIED, OEM\_DERIVED, CONSTRAINT\_SOLVED, AI\_INFERRED, UNKNOWN.  
* Progressive detail: S0 Logical, S1 Approximate, S2 Drawing-derived, S3 Coordinated, S4 Field-verified, S5 Verified As-Built.  
* Maintain confidence separately for X, Y, Z, geometry, topology, and identity.  
* XR registration uses survey points, markers/QR, architecture, LiDAR, GNSS where appropriate; session drift correction does not modify canonical geometry.  
* Users can switch SLD / Spatial / Hybrid and cross-highlight physical/logical representations.

**LOCKED — Inferred coordinates remain labeled inferred until stronger evidence verifies them.**

## **17\. Reality Capture, XR, and Field Spatial Computing**

* XR modes: AR, MR, VR, remote expert, training, commissioning, maintenance, procurement.  
* Track device capability, calibration, and accuracy.  
* Hierarchical anchors carry confidence and residual error.  
* XR observations never automatically overwrite canonical geometry.  
* Live OPC UA overlays preserve source quality/trust.  
* Asset identification fuses QR, NFC, OCR, vision, LiDAR, Spatial context, OEM identity, OPC UA identity, and topology.  
* Guided SOP/MOP/EOP execution and remote expert collaboration are supported.  
* Anchored evidence may include photo, video, depth, point cloud, thermal, voice, measurement, and annotation.  
* Multi-user sessions share a registered frame.  
* Hazard/PPE visualization is confidence-gated.  
* Offline XR packages permit only actions allowed without live authorization.  
* Measurements carry calibration provenance.  
* Deviation detection supports QA.  
* SLD/topology may be overlaid in immersive views.  
* Machine commands require identity, alignment, role, policy, and local interlocks.  
* Training simulation remains distinct from production state.  
* AI and remote-expert guidance remains advisory unless an approved workflow grants bounded execution.  
* Adaptive LOD supports device capability.  
* Matterport is one connector, never a dependency.  
* Provider-neutral capture supports STRATUM-native capture plus Matterport, Leica, FARO, NavVis, Trimble, Autodesk, mobile LiDAR/depth, drones, photogrammetry, survey, custom/future providers.

**LOCKED — Every reality capture has a canonical SpatialCaptureRef and source hash/provenance; provider brand is not trust.**

## **18\. Engineering Calculations and Mission-Critical Power Intelligence**

The closure audit requires a dedicated engineering-services layer. The following services are locked as first-class, versioned, evidence-aware, and approval-governed capabilities:

* load flow  
* short-circuit / fault current  
* protection coordination  
* selective coordination  
* voltage drop  
* arc-flash input/result management  
* capacity analysis  
* redundancy and failure-domain analysis  
* grounding and bonding  
* conductor sizing  
* transformer loading  
* generator/UPS autonomy  
* power-quality analysis  
* maintenance bypass and concurrent-maintainability analysis

Engineering calculations MUST record input dataset revision, source/trust class, algorithm/tool version, assumptions, result confidence where applicable, reviewer/approver, and affected assets. AI may prepare or explain calculations but cannot silently issue engineering approval.

### **Mission-critical / data-center topology**

Utility → service/switchgear → generator → ATS/paralleling → UPS → PDU/RPP/busway → rack/load

STRATUM models N, N+1, 2N and other redundancy patterns, failure domains, capacity envelopes, maintenance bypass, concurrent maintainability, fault propagation, and integrated systems testing scenarios.

**LOCKED — Mission-critical readiness is derived from topology, evidence, commissioning state, configuration, maintenance state, and approved operating policy—not from a single dashboard flag.**

## **19\. Codes, Standards, OEM Knowledge, and Jurisdiction Resolution**

The knowledge architecture is versioned, rights-aware, and jurisdiction-aware. Licensed sources such as NFPA LiNK may be referenced/used according to authorized access; STRATUM MUST NOT create an unauthorized clone of copyrighted standards. NFPA LiNK is treated as a licensed standards-access source, not a freely harvestable corpus (National Fire Protection Association, 2026).

* Maintain standards registry with current and historical editions.  
* Distinguish current publication, adopted edition, project-specified edition, AHJ interpretation, and engineer direction.  
* OEM knowledge stores source version, content hash, effective dates, model/series applicability, and region.  
* Ingestion: discover → acquire → rights verify → hash → parse → extract → review → publish → map.  
* Source classes: direct authoritative, interpreted/reviewed, project-specific, secondary, AI-generated.  
* Conflicts preserve hierarchy and may produce INSUFFICIENT\_AUTHORITY rather than a guessed answer.  
* Reviewed source-to-rule transformations may become SIR/DSL logic with traceability.  
* Rules map to asset classes, topology, Spatial regions, jurisdictions, lifecycle state, and project conditions.  
* Support grandfathering, supersession, waivers, deviations, exceptions, expiry, and compensating controls.  
* Cross-region knowledge may map NFPA/UL/IEEE/IEC/BS/EN/CSA/ASHRAE with partial/no-equivalence states.  
* Code-change impact analysis identifies affected assets/projects.

**LOCKED — Every compliance requirement must trace to source/version/applicability/interpretation/approval; AI uncertainty never silently becomes authority.**

# **Part IV — Evidence, Data, and Platform Services**

## **20\. STRATUM Data Room**

STRATUM Data Room is a first-class canonical document/evidence workspace across the ecosystem, accessed through a shared provider-neutral Artifact/Evidence Service. Google Drive may currently act as a storage provider but is not architecturally privileged.

* Artifact types include documents, drawings, submittals, RFIs, photos, test reports, warranties, contracts, commissioning packages, NDIRs, MDIRs, proof packages, Spatial captures, and incident evidence.  
* Every important artifact may carry artifactId, contentHash, provider/source locator, permissions, retention class, version history, project/asset/Spatial references, and DIR references.  
* Provider migration does not change cryptographic/content identity.  
* A Data Room file is not authoritative merely because it exists.  
* NDIRs and MDIRs are first-class Data Room artifacts with manifests, signatures, hashes, Merkle inclusion proofs, attachments, and proof packages.

Source ↔ Nano DIR ↔ Micro DIR ↔ DIR ↔ Evidence / Asset / Spatial / Work Order

* Finalized MDIRs link to containing DIR and PFC; NDIR batches are discoverable through roots and MDIR references.  
* Sensitive payloads may be hidden while integrity/existence proof remains available to authorized viewers.

**LOCKED — Data Room may store, index, search, retain, and present NDIRs/MDIRs, but PoVI finality is independent of Data Room storage.**

## **21\. Evidence, Provenance, Artifacts, and Proof Packages**

* Content hash is authoritative; locator is secondary.  
* Evidence package includes type/hash/metadata/source/signer/time/locators/retention/root.  
* Signatures prove provenance/integrity, not necessarily physical truth.  
* Role attestations identify who observed, performed, inspected, approved, or witnessed.  
* Revisions are append-only; source status may be AVAILABLE, ARCHIVED, MISSING, DELETED\_AT\_SOURCE.  
* Device identities and gateway acting-for-device provenance are preserved.  
* Calibration provenance is first-class for measurement/test evidence.  
* AI outputs are signed/referenceable with model/version/input/output/confidence, but advisory unless separately approved.  
* Retention classes R0 TEMPORARY, R1 OPERATIONAL, R2 PROJECT\_LIFECYCLE, R3 ASSET\_LIFETIME, R4 PERMANENT\_TRUST.  
* Critical evidence may use redundant locators.  
* Access is auditable and privacy-by-reference.  
* Redaction changes access/payload availability, not historical commitments.  
* Cross-system evidence preserves dual provenance and chain of custody.

### **DIR Proof Package**

The Redbook locks an independently verifiable DIR\_PROOF\_PACKAGE format containing the target DIR/MDIR/NDIR identifiers, canonical serialized object or hash, Merkle inclusion path where applicable, PFC, validator public-key history required for verification, protocol/schema versions, artifact hashes, and optional human-readable manifest.

**LOCKED — A portable STRATUM Proof Verifier MUST be able to validate proof packages offline without trusting STRATUM application servers.**

## **22\. Data Architecture, Storage, Sync, Retention, and Disaster Recovery**

* Multi-tier storage: PoVI/DIR state → structured operational DB → telemetry/time-series → object/evidence → Spatial/geometry → archive → search/analytics.  
* Validators retain last finalized height/hash/stateRoot/validatorSetRoot/protocolVersion/PFC/current state/critical key history/scheduled transitions.  
* Neon is operational persistence and projection storage, not consensus truth.  
* Raw telemetry → NDIR → time-series/object store → hierarchical aggregation → NDIR roots → MDIR → PoVI.  
* Large geometry uses external content-addressed artifacts with geometryManifestId, SpatialRevision, meshHash, pointCloudHash, textureManifestHash, coordinateFrame, captureRefs, LODManifest.  
* Derived indexes, vector search, full-text search, graph projections, dashboards, embeddings, and recommendations are rebuildable.  
* Typed events provide replayable/idempotent synchronization. DIR\_FINALIZED may trigger projections, Spatial, compliance, maintenance, search, and Jarvis updates.  
* Offline devices maintain durable local signed event logs with monotonic sequence and explicit eventOccurredAt, recordedLocallyAt, submittedAt, acceptedAt, finalizedAt.  
* Conflict resolution is semantic, not last-write-wins.  
* Replication is risk-based across independent failure domains.  
* Certified snapshots bind state and manifest roots.  
* Node/storage roles include VALIDATOR, ARCHIVE NODE, SPATIAL ARCHIVE, EVIDENCE ARCHIVE, ANALYTICS STORE; archives gain no vote.  
* Backups are hash/manifests/state-root/PFC/key-version verified and tested through restoration drills.  
* Provider-independent reconstruction: Genesis → DIR/PFC → validator/key history → snapshot → state → Spatial/evidence manifests → app DB → indexes → Jarvis projections.  
* Provider migrations copy → hash verify → register new locator → dual read → cutover → retire old locator.

**LOCKED — Offline, sync, migration, retention, pruning, backup, and recovery must never silently rewrite chronology or provenance.**

## **23\. Shared Platform Services**

* Canonical objects: Identity, Role, Organization, Project, AssetRef, SpatialRef, Annotation, Incident, EvidenceRef, Approval, HITL, Notification, Task, WorkItem, Exception, Comment, Attachment, ExternalRef, Audit.  
* Typed event bus/orchestration; no direct cross-module mutation.  
* One shared HITL service.  
* Shared annotation/incident/evidence relationship graph.  
* Identity service combines RBAC and ABAC.  
* Notification/escalation service tracks priority and acknowledgement.  
* Typed APIs replace database coupling.  
* Derived Infrastructure Knowledge Graph supports cross-module search.  
* SIR-compatible workflow/task engine.  
* Trust-critical AuditEvents may become NDIR/MDIR.  
* Provider-neutral artifact and Spatial-capture abstractions.  
* Shared coordinate-transform service.  
* Shared trust vocabulary.  
* Decision threads and collaboration remain attributable.  
* Automation/Agent Authority Boundary returns EXECUTE\_AUTO, CONFIRM, QUALIFIED, MULTIPARTY, or REJECT.

**LOCKED — Shared services are reusable control points and MUST NOT be bypassed by individual modules.**

## **24\. Identity, Organizations, Multi-Tenancy, RBAC/ABAC, and Credentials**

* Canonical identities: HUMAN, ORGANIZATION, VALIDATOR, SERVICE, DEVICE, GATEWAY, AI\_AGENT, OEM, SUPPLIER, AUDITOR, AUTHORITY.  
* Organizations model owner, GC, electrical contractor, subcontractor, engineer, OEM, supplier, service provider, utility, AHJ, auditor, STRATUM internal, and others.  
* True tenant isolation across projects, assets, Spatial, Data Room, Costing, incidents, work, procurement, controls, Jarvis, analytics, APIs.  
* RBAC supplies human-readable role bundles.  
* ABAC adds context such as project, asset class, qualification, permit, time, location, device assurance, and purpose.  
* Resource permissions: READ, CREATE, UPDATE, APPROVE, EXECUTE, CONTROL, EXPORT, SHARE, ADMINISTER.  
* Scope hierarchy may inherit organization→portfolio→project→site→building→system→asset, except high-risk permissions that require explicit grants.  
* Identity assurance levels IAL0–IAL5 support increasing proof/assurance.  
* Professional credentials are structured, issuer/jurisdiction/scope/expiry-aware.  
* External access should be time-bound/project-bound by default.  
* Delegation is explicit, scoped, expiring, revocable, and cannot exceed delegator authority.  
* Separation of duties can require author ≠ approver, installer ≠ inspector, requester ≠ commercial approver.  
* HITL approvals bind identity, credential state, role, scope, action hash, target, parameters, revision, evidence, and time.  
* Machines/devices have identities with manufacturer/model/serial/firmware/certificate/asset binding/trust state.  
* AI agents have independent identity/scope and never automatically inherit all permissions of the user.  
* Service-to-service identity follows zero-trust principles consistent with NIST SP 800-207 (Rose et al., 2020).  
* Validator consensus identity remains separate from application administration.  
* Cross-organization collaboration shares canonical objects through scoped grants rather than duplicating truth.  
* Identity lifecycle: INVITED, ACTIVE, SUSPENDED, REVOKED, EXPIRED, RETIRED; historical signatures remain attributable.  
* One 'Admin' role never constitutes a universal bypass.

## **25\. Privacy, Sovereignty, Confidential Computing, and Data Rights**

* Confidentiality classes: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SAFETY\_SENSITIVE, OT\_SENSITIVE, PERSONAL, HIGHLY\_RESTRICTED.  
* Objects may declare allowed/prohibited regions, residency policy, jurisdiction, customer policy, and export restrictions.  
* Proof is separable from payload so validators need not see sensitive raw content.  
* Validators receive minimum necessary data.  
* Sensitive databases, Data Room content, Spatial artifacts, telemetry archives, edge caches, backups, and mobile stores support encryption at rest.  
* All trust-critical communications use authenticated encryption.  
* Tenant/project/data-class encryption boundaries are supported.  
* Enterprise deployments may use STRATUM-managed, customer-managed, HSM, on-prem, or air-gapped key custody.  
* Fine-grained access evaluates identity, tenant, role, credentials, resource, classification, location, device assurance, purpose, and time.  
* XR/camera/voice continuous observation is limited to authorized WorkSessions, areas, purposes, durations, retention, and users.  
* STRATUM prohibits generalized biometric/productivity surveillance as a default product objective.  
* AI routing classes: LOCAL\_ONLY, PRIVATE\_EDGE, PRIVATE\_CLOUD, APPROVED\_EXTERNAL, NO\_AI.  
* Confidential-computing/TEE support is an optional high-assurance tier.  
* Selective disclosure/proof may demonstrate completion, valid credential, threshold, matching artifact, or approval without exposing unnecessary fields.  
* Redaction/revocation/crypto-shredding changes accessibility, not finalized historical commitments.  
* Retention/deletion states include ACTIVE, ARCHIVED, RETENTION\_HOLD, DELETION\_SCHEDULED, DELETED, CRYPTO\_SHREDDED.  
* Cross-border replication checks source region, destination, class, safeguards, and policy.  
* Privacy-preserving analytics may use aggregation, pseudonymization, de-identification, tenant-local computation, or federated result exchange.  
* Privacy incidents follow DETECTED → CONTAINED → SCOPED → EVIDENCE PRESERVED → REQUIRED NOTIFICATIONS → REMEDIATION → VERIFIED CLOSURE.

**LOCKED — Verifiability must be preserved while disclosure is minimized.**

## **26\. Interoperability, APIs, AAS, BIM/IFC, CMMS/EAM, BMS/SCADA, ERP, and GIS**

* One governed integration fabric, not uncontrolled point-to-point mutations.  
* API-first access to identity, organizations, projects, assets, Spatial, documents, evidence, DIR references/proofs, work, incidents, maintenance, commissioning, costing, procurement, controls, compliance, OPC UA, and Jarvis.  
* External IDs are aliases; STRATUM assetId remains canonical.  
* Typed events such as ASSET\_CREATED, WORK\_ORDER\_COMPLETED, INCIDENT\_OPENED, CONFIGURATION\_CHANGED, DOCUMENT\_REVISED, COMMISSIONING\_COMPLETED.  
* Webhooks/subscriptions use signatures, retries, idempotency, and replay protection.  
* Imports use source event/idempotency keys.  
* AAS mapping supports AAS asset/submodel identifiers while retaining STRATUM canonical identity. IDTA AAS specifications define standardized metamodel/API/security/package structures that STRATUM can interoperate with (Industrial Digital Twin Association, 2026).  
* CMMS/EAM integration covers assets, locations, plans, work orders, inspections, failures, parts, labor, meters, warranties.  
* ERP/procurement integration covers vendors, requisitions, POs, receipts, invoices, materials, inventory, contracts.  
* BMS/BAS adapters may use BACnet, OPC UA, Modbus, vendor APIs, MQTT and normalize point identity, units, quality, timestamp, alarm and operating state.  
* SCADA integration separates read telemetry from tightly governed writes/setpoints/commands.  
* Industrial adapters may include Modbus, EtherNet/IP, PROFINET, DNP3, MQTT, vendor protocols.  
* BIM/IFC/Revit/CAD integration preserves source GUIDs/revisions. IFC is an open vendor-neutral standardized digital description of built assets and is a natural interoperability source (buildingSMART International, 2024).  
* GIS maps features to assetId and Spatial geometry.  
* Historians remain high-volume stores while roots/significant events connect to PoVI.  
* Enterprise SSO supports OIDC/OAuth/SAML/SCIM-style provisioning while STRATUM authorization remains independent.  
* Schema registry tracks versions and compatibility.  
* Connector certification levels: UNVERIFIED, COMMUNITY, TESTED, STRATUM\_REVIEWED, STRATUM\_CERTIFIED, SAFETY\_REVIEWED.  
* Jarvis may reason across external sources while preserving source, timestamp, trust class, conflict state, and canonical mapping.

**LOCKED — External systems can contribute data and workflow state; they do not become consensus authority by connection.**

# **Part V — AI, Commercial Intelligence, and Work Execution**

## **27\. JARVIS — STRATUM Chief AI Orchestrator**

* JARVIS is the unified AI orchestration layer across all STRATUM platforms and leads specialist AI agents.  
* It receives objectives, decomposes work, assigns agents, parallelizes tasks, monitors progress, challenges weak work, detects conflicts, seeks dissent, requests evidence, synthesizes, and escalates to HITL.  
* AI-agent agreement is advisory, not PoVI consensus.  
* Persistent JarvisContext may include user, organization, project, site, module, assets, Spatial/SLD, work order, incident, compliance, procurement, revision, DIR, permissions, conversation.  
* Multimodal inputs include text, voice, images, drawings, SLDs, photos, video, XR, annotations, geometry, OPC UA data, and documents.  
* Modes: READ, EXPLAIN, RECOMMEND, DRAFT, SIMULATE, REQUEST\_ACTION, EXECUTE\_ALLOWED.  
* Jarvis never self-escalates permissions and every tool/action is audited.

### **Continuous Work Observation and Hazard Prevention**

* Only runs in explicitly activated authorized work sessions.  
* Fuses camera/XR/depth/LiDAR/Spatial/procedure/OPC UA/tools/parts.  
* Object accounting may track fasteners/tools/materials; if an item is unaccounted for, Jarvis uses uncertainty language and may hold progression to a high-risk step pending human verification.  
* Camera observation never proves torque or electrical isolation; instrumented or procedural evidence is stronger.  
* Expected Physical vs Observed vs PoVI Authoritative vs Live OPC UA are separate states.  
* Intervention levels J0 silent, J1 hint, J2 reminder, J3 warning, J4 procedure hold, J5 human/supervisor escalation.  
* Energization readiness checks tool/material accountability, covers, procedures, approvals, OPC UA/interlocks, incidents, annotations, and evidence, returning READY / CONDITIONAL / NOT\_READY / HUMAN\_VERIFY.  
* Temporary spatial objects may include tempObjectId/class/X/Y/Z/firstSeen/lastSeen/confidence/task/disposition/hazard relationship.  
* No generalized biometric/productivity surveillance.

**LOCKED — Jarvis may recommend or hold within policy; it never invents camera-only certainty about electrical safety.**

## **28\. AI Agents, Provenance, Authority, and HITL**

* Every AI agent/model has registered identity, model/provider/version, allowed tools/data scopes/action level/human-control level.  
* Recommendation is a persistent object rather than disposable chat text when operationally relevant.  
* Retrieval hierarchy prioritizes PoVI, verified project data, AHJ/regulation, publisher/OEM, project sources, secondary sources, and AI.  
* AI explanations expose factors and confidence dimensions.  
* AI output is never canonical by itself.  
* Specialist agents cover Spatial, Procurement, Costing, Project Controls, Knowledge, Field/QA, Safety, Commissioning, Operations, Cybersecurity, etc.  
* AI may generate SIR/DSL/Native/WASM/Solidity/OPC mappings/visual workflows, but generated code receives no special trust.  
* Record model/prompt/context/tool/output provenance.  
* Risk A0 informational, A1 low recommendation, A2 action draft, A3 engineering, A4 machine/safety, A5 governance; map to HITL.  
* Knowledge state labels KNOWN, DERIVED, INFERRED, PREDICTED, UNKNOWN, CONFLICTED.  
* Closed-loop learning does not self-modify production rules without governed review.  
* High-risk agent/model disagreement may trigger multi-agent verification but never substitutes required human authority.  
* Privacy routes control AI processing location.  
* Edge/local AI may support OCR, tracking, offline voice, spatial assistance, and limited hazard/procedure recognition.  
* Autonomous envelope includes observe, classify, retrieve, summarize, compare, monitor, temporary annotate, draft, simulate, recommend, and approved low-risk workflows.  
* Independent critical machine control, engineering/compliance approval, procurement award, Spatial verification, or governance override is forbidden.  
* AI incidents may trigger scoped restriction/rollback.

### **HITL levels**

H0 automated observation  
H1 recommendation  
H2 human confirmation  
H3 qualified approval  
H4 multi-party approval  
H5 safety/governance high assurance

**LOCKED — Every SIR workflow declares required humanControlLevel and authorization semantics.**

## **29\. STRATUM AI Costing**

* Canonical estimating and cost-intelligence module.  
* Consumes Spatial, SLD/BIM/CAD, asset ontology, OEM/BOM, procurement pricing, labor/productivity history, project controls, regional factors, PESTEL, and Data Room sources.  
* Outputs versioned/explainable quantities, assemblies, labor, materials, equipment, quotes, allowances, risk, contingency, schedule impact, lifecycle cost, estimates, forecasts, changes, and scenarios.  
* Spatial quantities may include equipment counts, cable/conduit lengths, busway/tray, devices/terminations, supports, clearance/access impacts, installation complexity, each with provenance/confidence.  
* Jarvis orchestrates Spatial \+ Procurement \+ Costing \+ Project Controls \+ Knowledge \+ Data Room for cross-revision pricing and impact analysis.  
* Cost items may reference estimateItemId, assetId, SpatialRegion, drawingRef, BOMItem, supplierQuote, laborAssembly, activityId, changeEventId, confidence, sourceRefs.  
* Estimate versions are explicit and append-only once approved; no silent overwrite.  
* Bidirectional ecosystem: Data Room ↔ Spatial ↔ AI Costing ↔ Procurement ↔ Project Controls ↔ QA/QC ↔ Commissioning ↔ Operations ↔ Jarvis.  
* AI-generated cost output is not authoritative merely because generated.

## **30\. Procurement, Supply Chain, Commercial Intelligence, and Contract Controls**

* Supplier/OEM registry is regional and qualification-aware.  
* Availability modes include BEST\_TECH, BEST\_AVAILABLE, BEST\_SCHEDULE, BEST\_LIFECYCLE.  
* Substitution compares equivalent, better, partial, review-required, or not equivalent.  
* Landed/lifecycle cost covers purchase, freight, tariff, tax, expedite, install/redesign/commissioning, spares, maintenance, energy, service, downtime, replacement, disposal.  
* PESTEL covers tariffs, geopolitics, origin, trade, sanctions, shipping.  
* Authenticity covers manufacturer/model/serial/lot/channel/CoC/FAT/UID states.  
* Supplier performance/qualification and warranty/service regional fit are tracked.  
* BOM is multi-source and Spatial/XR fit-aware.  
* Concentration risk covers OEM, supplier, country, factory, route, vendor lock.  
* Quotes/bids are normalized for immersive comparison.  
* Substitutions require governance/approval.  
* Demand forecast and explainable sourcing dimensions include technical, commercial, resilience, lifecycle, overall.  
* PO→ship→receive→inspect→authenticate→accept→install preserves provenance.  
* Delivery/install readiness includes Spatial path/constraints.  
* Commercial changes are append-only.  
* PO risks and portfolio procurement analytics are derived.  
* Cheapest is never automatically best value.

### **Contract controls closure**

The Redbook locks canonical Contract, Subcontract, PurchaseOrder, ChangeOrder, CommercialApproval, Commitment, Invoice/PaymentReference, Claim/Notice, and CommercialAuthority objects with explicit version, party, scope, value, currency, effective dates, approvals, evidence, source document hash, and project/asset/change linkage.

**LOCKED — Commercial authority and PoVI physical trust remain distinct but cross-referenceable.**

## **31\. Project Controls, Schedule, Cost, Change, and Earned Progress**

* Versioned baseline covers scope, schedule, budget, and procurement.  
* Activities tie to physical asset/Spatial context where relevant.  
* Progress is evidence-backed.  
* Spatial planned-vs-actual supports installation progress.  
* Cost model supports estimate/budget/commitment/actual/forecast.  
* ETC/EAC forecasts are explainable.  
* Earned value uses verified progress definitions.  
* Change lifecycle is explicit and append-only.  
* Delay evidence distinguishes observed/derived/accepted/legal conclusions.  
* Jarvis supports lookahead and scenario analysis.  
* Productivity analytics focus on process/system rather than personal worker ranking.  
* Resource leveling includes qualifications.  
* Cash flow, risk, contingency, and claims-support provenance are modeled.  
* What-if analysis is nondestructive.  
* Role/portfolio dashboards are derived.  
* Jarvis can recommend replanning but cannot silently alter baseline/contract/cost.

### **Schedule semantic closure**

Activities carry IDs, calendars, durations, milestones, predecessor/successor relationships, constraints, baseline/current/actual dates, float where applicable, responsible scope, Spatial/asset links, status source, evidence refs, and accepted-vs-forecast distinctions.

## **32\. Field Execution and QA/QC**

* FieldWorkSession is first-class.  
* Installation requirements are auto-assembled from approved design, OEM, project, code, and work instructions.  
* Typical progression: RECEIVED → ID VERIFIED → POSITIONED → MOUNTED → CONNECTED → TORQUED → LABELED → INSPECTED → TESTED.  
* Jarvis object/material accounting supports foreign-object prevention.  
* Torque verification is instrument/calibration-backed.  
* Pre-install authenticity/BOM checks precede acceptance.  
* AI workmanship assistance is advisory; formal acceptance is human/qualified.  
* HOLD\_POINT and WITNESS\_POINT are explicit.  
* NCR dispositions are append-only.  
* Deterministic QA gates determine readiness where rules are formalizable.  
* Inspections carry role, credentials, provenance.  
* Tests carry instrument/raw data/calibration.  
* Progressive capture occurs before concealment.  
* Rework lineage is preserved.  
* QA analytics focus on processes/systems and privacy.  
* Cross-trade Spatial coordination is supported.  
* Turnover readiness accumulates from verified evidence.

### **Inspection and Test Plans (ITP)**

ITPs are first-class objects containing inspection/test step, acceptance criteria, applicable source/standard/specification, hold/witness designation, required evidence, qualified role, instrument requirements, dependencies, result, disposition, and approval.

## **33\. Safety, EHS, Permit-to-Work, and LOTO**

* SafetyPermit types: general, energized, LOTO, confined space, hot work, lifting, excavation, work at height, temporary hazards.  
* JHA/JSA becomes structured/executable where possible.  
* LOTO lifecycle records isolation, locks, tags, zero-energy proof; visual observation alone is insufficient.  
* Energized work requires high assurance.  
* Spatial dynamic hazard zones are supported.  
* PPE recognition is assistive and non-definitive.  
* Human STOP\_WORK cannot be suppressed; Jarvis may recommend stop/hold.  
* Readiness gates are deterministic where formal rules exist.  
* Near-miss/hazard workflow is structured.  
* Jarvis compares procedure/JHA/location/asset/OPC UA/zones/tools/incidents/LOTO/PPE/HITL and escalates OBSERVE→REMIND→WARN→HOLD→STOP RECOMMEND→ESCALATE.  
* Confined-space conditions/rescue, lifting/rigging Spatial path, height work, overlapping permits are modeled.  
* Emergency operation follows approved EOPs; Jarvis does not invent ad hoc unsafe procedures.  
* Qualifications and task-scoped exposure/privacy are explicit.  
* Safety analytics target system improvement.  
* Audit reconstruction is preserved.

### **Physical LOTO identity closure**

Locks, tags, isolation points, authorized employees, affected employees, group lockboxes, group LOTO membership, transfer of responsibility, removal authority, verification instrument/result, and re-energization clearance are first-class objects/events.

**LOCKED — STRATUM assists safety execution but does not transfer statutory safety responsibility from legally/organizationally responsible persons.**

## **34\. Commissioning, Startup, FPT, and IST**

* CommissioningPlan is first-class.  
* Pre-functional readiness gates ensure prerequisites/evidence.  
* Startup uses structured SIR/Jarvis/XR guidance.  
* Energization readiness checks tools/fasteners/covers/grounds/leads/protection/safety/approvals/downstream state.  
* Functional Performance Tests (FPT) are structured.  
* Integrated Systems Testing (IST) covers utility, generator, ATS, UPS, cooling, life safety, and interdependent systems.  
* Jarvis may provide live commissioning context.  
* Spatial/XR supports navigation/evidence.  
* Deficiency→correction→retest lineage is explicit.  
* COMMISSIONED is a deterministic lifecycle outcome based on required evidence/approvals.  
* Configuration baseline is immutable/versioned.  
* Sequence-of-operations is modeled.  
* Trend/time-series evidence may be root-committed rather than raw-finalized.  
* Failure-mode tests are governed.  
* Witness roles/signatures are explicit.  
* Phased, seasonal, deferred commissioning are supported.  
* Owner training may use XR/VR.  
* Lessons learned feed analytics without uncontrolled production-rule changes.

### **Executable commissioning procedure closure**

FPT/IST procedures SHOULD be representable in SIR with typed prerequisites, step order, expected observations, permitted commands, evidence requirements, pass/fail criteria, hold points, witness requirements, rollback/recovery steps, and exact version hash.

## **35\. Operations, Maintenance, Reliability, and Predictive Intelligence**

* Maintenance strategies: TIME, USAGE, CONDITION, PREDICTIVE, EVENT, REGULATORY, OEM, RISK.  
* Work orders are evidence-backed.  
* Condition monitoring is quality-aware with OPC UA status/quality.  
* Predictive output remains advisory.  
* Fault/event correlation distinguishes inferred from confirmed.  
* Maintenance priority considers risk/topology.  
* BOM/spares/alternates are integrated.  
* Mobile/offline signed field execution is supported.  
* Outage/maintenance windows can be topology-simulated.  
* SOP/MOP/EOP are structured.  
* Reliability metrics preserve provenance.  
* Post-maintenance verification/recommissioning is supported.  
* Root-cause analysis tracks hypotheses as supported/rejected/confirmed.  
* Interval optimization is governed.  
* Parts forecast and closed-loop field learning are controlled.  
* Portfolio/cross-OEM reliability analytics are derived.  
* Asset Intelligence may recommend same/different OEM, equivalent/higher-rated, maintainable, lower-energy, regional, resilient, OPC-UA-native, or alternative technology options.  
* Recommendations consider PESTEL, technical/site/climate/load/redundancy/maintainability/supply/service/OEM history/warranty/standards/AHJ/TCO/energy/carbon/cyber/future growth.  
* Replacement/OEM/protection/rating/PO/energization decisions require applicable approvals.

# **Part VI — Security, UX, Deployment, and Governance**

## **36\. Cybersecurity and OT Zero Trust**

* Cyber asset identity is first-class.  
* Zero trust applies to humans, machines, agents, services, and validators, consistent with NIST's principle that network location/ownership does not create implicit trust (Rose et al., 2020).  
* Segmentation separates IT, Engineering, OT, OPC UA, Safety, PoVI, Management, XR, Guest as appropriate.  
* Machine communications use mutual authentication/certificates.  
* Privileged access management covers validator, OPC UA, production, certificates, protocol, emergency access.  
* Software/firmware/configuration hashes form baselines.  
* Vulnerabilities map to installed assets.  
* Remote OT access is just-in-time.  
* Cyber and physical events may be correlated.  
* Containment is governed and considers physical impact.  
* Secure boot/TPM/enclave/HSM attestation is supported where needed.  
* Keys are purpose-separated.  
* Secrets are references, not embedded in source/SIR/contracts/DIR payloads.  
* SBOM/build/publisher signatures support software supply-chain integrity.  
* SIEM/logs are derived; trust-critical security events may become MDIR.  
* Anomaly ≠ attack without supporting evidence.  
* Ransomware resilience includes backups, DIR/PFC/snapshot/config verification, segmentation.  
* Disaster recovery verifies cryptographic integrity.  
* Red-team scope includes PoVI, APIs, OPC UA, certs, tenants, AI/contracts/sandbox/XR/supply-chain/remote access.  
* Live OT testing occurs only in safe explicitly authorized conditions.

### **Secrets-management closure**

OAuth tokens, API credentials, database credentials, connector secrets, service credentials, signing materials, and recovery secrets MUST use dedicated secret stores or secure local custody, version/rotation metadata, least privilege, audit, and explicit revocation. Secret material MUST NOT be placed in NDIR/MDIR/DIR payloads, SIR source, logs, or user-visible provenance packages.

**LOCKED — Security monitoring does not become consensus authority.**

## **37\. UX, Universal Command Center, and STRATUM Design System**

* Role-based home surfaces for executive, PM, engineer, estimator, procurement, field technician, commissioning, operator, safety, auditor, owner, admin.  
* Jarvis is contextual across major surfaces, not isolated as a chat tab.  
* Spatial-first navigation: Site → Building → Floor → Room → System → Asset → Evidence → Work → History.  
* Synchronized representations: table, 2D drawing, SLD, Spatial 3D, Hybrid, XR, timeline, dependency graph.  
* Universal Command Center may show risks, incidents, alerts, validator/system health, power capacity/redundancy, open work, approvals, commissioning, compliance, procurement, project controls, Jarvis.  
* Progressive disclosure hides cryptographic complexity until requested.  
* Universal Asset Drawer shows identity, state, operations, Spatial/SLD, configuration, health, maintenance, incidents, evidence, docs, cost, procurement, commissioning, compliance, DIR history.  
* Field mobile is task-first, large-target, voice/camera/QR/NFC, offline-capable, minimal typing.  
* Offline states: ONLINE, OFFLINE, SYNCING, CONFLICT, PENDING FINALITY, FINALIZED.  
* Unified approval inbox spans design, RFI, change, substitution, estimate, purchase, commissioning, safety, machine action, validator governance, contract deployment.  
* Incident workspace combines timeline, affected assets, Spatial location, live signals, alarms, media, annotations, people, procedures, actions, hypotheses, evidence, approvals, DIR history.  
* Evidence/provenance explorer explains why a state is believed and links evidence→approval→MDIR→DIR→PFC.  
* Universal search spans assets/projects/sites/people/docs/SLDs/Spatial/work/incidents/estimates/suppliers/DIRs/standards/OEM/procedures/annotations.  
* Notifications: INFO, ACTION, APPROVAL, WARNING, CRITICAL, SAFETY, GOVERNANCE with ack/assign/escalate/context/resolve.  
* Dashboards are configurable without redefining canonical semantics.  
* Persona-specific views expose appropriate depth.  
* Admin surfaces distinguish administrative permission from engineering, machine-control, and PoVI governance authority.  
* STRATUM Design System components include Asset Card, Trust Badge, Status Chip, DIR Badge, Approval Card, Incident Card, Evidence Card, Spatial Panel, SLD Viewer, Timeline, Dependency Graph, Notification, Data Table, Command Palette, Jarvis Panel, Risk Indicator, Provenance Drawer, Work Stepper.  
* Accessibility: keyboard, screen-reader, contrast, reduced motion, large controls, error prevention, consequential confirmations, safe undo, plain-language explanation.

### **Design token closure**

The shared design system MUST define semantic tokens for trust/finality, hazard severity, operational state, uncertainty/conflict, approval requirement, connectivity/sync, and data sensitivity so that the same status has the same visual meaning across modules.

## **38\. Infrastructure, Edge-Cloud Runtime, and One-Click Validator Packaging**

* Control, data, consensus, evidence, Spatial, AI, and integration planes remain logically separated.  
* Vercel/event-driven validators and persistent installed nodes are distinct runtime profiles but participate through the same protocol rules.  
* Portable validator runtime should be compact, with Go preferred for packaging; Rust is also suitable. Java/Besu/EVM/Docker/Kubernetes/Redis are not mandatory.  
* Platforms: Windows MSI/EXE, macOS signed/notarized PKG/DMG, Linux DEB/RPM/generic, Raspberry Pi ARM64 package/image, optional Docker, VPS/cloud VM, industrial edge, compatible NAS/home-lab.  
* Normal UX: Install → Enter enrollment code → local key generation → health/network checks → sync → CANDIDATE → governance → ACTIVE.  
* Installer handles architecture/runtime detection, directories, local keys, networking, bootstrap, service auto-start/restart, health.  
* One-click installation never grants vote authority.  
* Universal package manifest: packageId, validatorVersion, protocolVersion, platform, architecture, binaryHash, SBOMHash, publisherSignature, minimumResources, supportedFeatures, releaseChannel.  
* Validator migration preserves identity through authorized key/identity migration.  
* Persistent nodes store crash-safe consensus state locally; event-driven/serverless nodes must have equivalent durable state semantics before full PoVI conformance.  
* Service discovery supports direct peers, relays, private networks/VPN, bootstrap endpoints, and offline/manual paths.  
* NAT/firewall traversal and endpoint change are availability mechanisms, not trust roots.  
* Health/observability includes peer connectivity, sync status, finality latency, resource pressure, last signed state, key/certificate status.  
* Upgrades are signed, staged, governed where consensus-affecting, and support rollback only where protocol safety permits.  
* Application services may use blue/green/canary; consensus-rule activation follows future-height governance rather than ordinary canary semantics.  
* Multi-region/high-availability designs preserve quorum assumptions.  
* Edge nodes buffer NDIRs/work offline and reconcile semantically when connectivity returns.  
* Power/network loss must not cause silent history loss or double signing.  
* Snapshots/proof archives support fast bootstrap.  
* Minimal hardware targets are benchmark-driven and hardware-neutral.

**LOCKED — A normal operator should not need blockchain/container/certificate/networking expertise to install a validator.**

## **39\. Governance, Legal Authority, IP, Certification, and Commercialization**

* Governance domains: PROTOCOL, VALIDATOR, ORGANIZATION, PROJECT, SAFETY, CERTIFICATION, COMMERCIAL, DATA, AI.  
* Every governance authority has authorityId/type/org/jurisdiction/scope/members/voting policy/threshold/effective dates/status.  
* Protocol changes carry versions, change hash, rationale, security/compatibility impact, migration, test evidence, future activation height.  
* Validator admission/activation/quarantine/reinstatement/key rotation/retirement/revocation are governed canonical actions.  
* Project governance maps design, QA, commissioning, commercial, safety, and substitution authorities.  
* Delegation is bounded and cannot amplify authority.  
* Threshold classes may include simple, dual, majority, supermajority, multi-party high assurance.  
* Emergency governance may suspend modules/event types/connectors/machine-command paths or revoke compromised keys, but is scoped, expiring, attributable, and cannot rewrite finalized history.  
* Disputes/appeals are append-only.  
* Cryptographic finality, engineering approval, contractual approval, regulatory acceptance, and legal effect remain distinct.  
* Digital signatures carry signer, intent, document/action hash, jurisdiction, verification method; legal sufficiency remains context-dependent.  
* IP classes: STRATUM\_PROPRIETARY, CUSTOMER\_OWNED, OEM\_PROPRIETARY, OPEN\_SOURCE, LICENSED\_THIRD\_PARTY, JOINTLY\_DEVELOPED, CONFIDENTIAL, PUBLIC.  
* Commercial licensing may be by organization/site/project/assets/users/modules/AI/storage/support and never invalidates finalized history.  
* Deployment models: STRATUM SaaS, customer cloud, private VPC, on-prem, air-gapped, sovereign, hybrid.  
* Certification is scoped/versioned/evidence-backed/revocable and includes STRATUM\_REVIEWED, STRATUM\_CERTIFIED, SAFETY\_CERTIFIED, OPC\_UA\_VERIFIED, SPATIAL\_READY.  
* Third-party marketplace packages carry publisher identity/signature/license/permissions/security/compatibility declarations; listing ≠ certification.  
* AI governance controls approved models/providers/data routes/tools/risk envelope/model updates.  
* Standards/policy updates are versioned reviewed changes with effective dates.  
* Commercial status cannot purchase votes, weaker safety, trust class, or certification.

**LOCKED — No pay-to-trust, pay-to-consensus, or pay-to-certification shortcut.**

## **40\. Deployment Profiles, SLO/SLA, Observability, and Platform Incident Management**

* Small: 3–6 ACTIVE validators, all-validator participation, compact individual signatures, mixed Vercel/PC/RPi/VPS.  
* Medium: 7–20 validators, multi-site/provider, relay support, archive separation, larger NDIR aggregation, rotating coordination.  
* Enterprise: 20+ validators, multi-organization/multi-region, dedicated archives, edge gateways, high key assurance, committee optimization only with security analysis.  
* Hybrid example: A/B/C Vercel, D Raspberry Pi, E customer server, F VPS—all equal when ACTIVE.  
* Edge profile may package EDGE\_GATEWAY, OPC\_UA\_BRIDGE, NDIR\_BUFFER, SPATIAL\_EDGE, optional VALIDATOR, optional LOCAL\_AI but preserves logical separation.  
* Offline site may capture evidence/NDIRs and prepare MDIR candidates but cannot fabricate global finality.  
* Air-gapped deployments have independent chainId/Genesis/validators/trust roots/Data Room/Jarvis as permitted.  
* Reference deployment manifests are machine-readable.

### **SLO/SLA and observability closure**

The Redbook distinguishes protocol guarantees from commercial service objectives. Consensus safety assumptions, quorum requirements, deterministic finality conditions, and proof verification are protocol properties. Availability, latency, support response, backup frequency, and hosted-service uptime are deployment/SLA properties and MUST be separately declared.

Observability SHOULD capture validator health, peer connectivity, chain height, round/finality latency, queue depth, NDIR/MDIR rates, evidence/source availability, database health, Data Room artifact status, OPC UA sessions/quality, Spatial processing, AI/tool failures, authentication anomalies, deployment versions, and resource saturation. Logs/metrics/traces are derived observability and are never consensus authority.

### **STRATUM platform incident management**

DETECTED → TRIAGED → CONTAINED → SERVICE SAFE STATE → ROOT CAUSE → REMEDIATION → RECOVERY VERIFICATION → POST-INCIDENT ACTIONS

Platform incidents include validator outage/chain halt, data leakage, compromised key/package, connector failure, AI malfunction, schema defect, deployment failure, and storage/provider outage.

# **Part VII — Normative Closure Audit: All 60 Recommendations Pre-Approved and Locked**

The following sixty recommendations were identified during a completeness audit. The user pre-approved all sixty in advance. Each is therefore incorporated as a conceptually locked requirement. These items close specification gaps and do not imply current implementation.

## **41–47. Locked Closure Recommendations**

### **1\. Master data-class mapping**

Create and maintain an authoritative matrix mapping every major information type to primary data class, authority source, storage, NDIR/MDIR/DIR treatment, retention, privacy, and reconstruction path.

**LOCKED — Create and maintain an authoritative matrix mapping every major information type to primary data class, authority source, storage, NDIR/MDIR/DIR treatment, retention, privacy, and reconstruction path.**

### **2\. Executable PoVI formalism**

Provide state-machine pseudocode covering PROPOSE, VERIFY, LOCK, COMMIT, FINALIZE, rounds, NIL, locks, unlocks, persistence, PFC, catch-up, set changes, and protocol activation.

**LOCKED — Provide state-machine pseudocode covering PROPOSE, VERIFY, LOCK, COMMIT, FINALIZE, rounds, NIL, locks, unlocks, persistence, PFC, catch-up, set changes, and protocol activation.**

### **3\. Wire-message schemas**

Define normative PROPOSAL, VERIFY, COMMIT, ROUND\_CHANGE, PLC, PFC, EQUIVOCATION\_EVIDENCE, enrollment, snapshot, and health envelopes.

**LOCKED — Define normative PROPOSAL, VERIFY, COMMIT, ROUND\_CHANGE, PLC, PFC, EQUIVOCATION\_EVIDENCE, enrollment, snapshot, and health envelopes.**

### **4\. Exact Genesis DIR schema**

Define deterministic Genesis serialization, roots, validator registry, governance roots, modules, network parameters, and Genesis hash.

**LOCKED — Define deterministic Genesis serialization, roots, validator registry, governance roots, modules, network parameters, and Genesis hash.**

### **5\. Normative NDIR/MDIR/DIR schemas**

Define required/optional fields, canonical datatypes, IDs, signature payloads, canonicalization, proof format, size/resource envelopes, and schema evolution.

**LOCKED — Define required/optional fields, canonical datatypes, IDs, signature payloads, canonicalization, proof format, size/resource envelopes, and schema evolution.**

### **6\. Complete event registry**

Create master typed registry across lifecycle, installation, QA, testing, commissioning, maintenance, incidents, safety, Spatial, procurement, governance, validators, cybersecurity, OPC UA, cost/change, documents, AI, and project controls.

**LOCKED — Create master typed registry across lifecycle, installation, QA, testing, commissioning, maintenance, incidents, safety, Spatial, procurement, governance, validators, cybersecurity, OPC UA, cost/change, documents, AI, and project controls.**

### **7\. Canonical asset taxonomy**

Define complete infrastructure/electrical hierarchy and OEM extensions for switchgear, switchboards, breakers, transformers, UPS, generators, ATS, busway, conductors, trays, panels, meters, PLCs, sensors, EVSE, mission-critical/cooling interfaces, and future classes.

**LOCKED — Define complete infrastructure/electrical hierarchy and OEM extensions for switchgear, switchboards, breakers, transformers, UPS, generators, ATS, busway, conductors, trays, panels, meters, PLCs, sensors, EVSE, mission-critical/cooling interfaces, and future classes.**

### **8\. Engineering calculation services**

Lock versioned services for load flow, short circuit, coordination, voltage drop, arc-flash data/results, selective coordination, capacity, redundancy, grounding/bonding, conductor sizing, transformer loading, generator/UPS autonomy, and power quality, with HITL authority.

**LOCKED — Lock versioned services for load flow, short circuit, coordination, voltage drop, arc-flash data/results, selective coordination, capacity, redundancy, grounding/bonding, conductor sizing, transformer loading, generator/UPS autonomy, and power quality, with HITL authority.**

### **9\. Mission-critical operating model**

Consolidate utility→generator→ATS→switchgear→UPS→PDU/RPP→rack topology, N/N+1/2N, failure domains, capacity, bypass, concurrent maintainability, fault propagation, and IST.

**LOCKED — Consolidate utility→generator→ATS→switchgear→UPS→PDU/RPP→rack topology, N/N+1/2N, failure domains, capacity, bypass, concurrent maintainability, fault propagation, and IST.**

### **10\. Semantic-drift controls**

Govern glossary meanings for Verified, Approved, Commissioned, Finalized, Live, Field Verified, AI Inferred, PoVI Verified, etc.

**LOCKED — Govern glossary meanings for Verified, Approved, Commissioned, Finalized, Live, Field Verified, AI Inferred, PoVI Verified, etc.**

### **11\. Unified trust model**

Formalize provenance confidence, observation confidence, engineering approval, operational status, physical verification, and consensus finality as separate dimensions.

**LOCKED — Formalize provenance confidence, observation confidence, engineering approval, operational status, physical verification, and consensus finality as separate dimensions.**

### **12\. Master HITL matrix**

Map exact actions to H0–H5 for engineering, procurement, energization, machine control, safety, LOTO, commissioning, validator governance, AI, Spatial verification, standards interpretation, and cost.

**LOCKED — Map exact actions to H0–H5 for engineering, procurement, energization, machine control, safety, LOTO, commissioning, validator governance, AI, Spatial verification, standards interpretation, and cost.**

### **13\. Formal JARVIS agent registry**

Define specialist agents, inputs/outputs, tools, maximum authority, HITL level, data route, and collaboration rules.

**LOCKED — Define specialist agents, inputs/outputs, tools, maximum authority, HITL level, data route, and collaboration rules.**

### **14\. AI provenance schemas**

Define AIRecommendation, AgentRun, JarvisContext, AIActionRequest, AIConflict, AISourceCitation, AIApprovalEscalation.

**LOCKED — Define AIRecommendation, AgentRun, JarvisContext, AIActionRequest, AIConflict, AISourceCitation, AIApprovalEscalation.**

### **15\. Knowledge licensing policy**

Distinguish licensed sources, customer-provided documents, public standards, metadata indexing, interpreted rules, OEM material, and generated knowledge; prohibit unauthorized cloning.

**LOCKED — Distinguish licensed sources, customer-provided documents, public standards, metadata indexing, interpreted rules, OEM material, and generated knowledge; prohibit unauthorized cloning.**

### **16\. Jurisdiction resolution engine**

Model country→state/province→municipality→AHJ→adopted edition→project specification→EOR direction→approved deviation.

**LOCKED — Model country→state/province→municipality→AHJ→adopted edition→project specification→EOR direction→approved deviation.**

### **17\. OT certificate lifecycle**

Formalize certificate issuance, trust store, renewal, OPC UA approval, device replacement, firmware signing, and compromised-device recovery.

**LOCKED — Formalize certificate issuance, trust store, renewal, OPC UA approval, device replacement, firmware signing, and compromised-device recovery.**

### **18\. Secrets management**

Formalize API/OAuth/database/connector/service secrets, rotation, references, audit, and prohibition from SIR/MDIR/DIR/log payloads.

**LOCKED — Formalize API/OAuth/database/connector/service secrets, rotation, references, audit, and prohibition from SIR/MDIR/DIR/log payloads.**

### **19\. Portable-validator networking**

Specify peer discovery, NAT/firewall, relay, bootstrap, endpoint changes, trust establishment, VPN/private and air-gapped exchange.

**LOCKED — Specify peer discovery, NAT/firewall, relay, bootstrap, endpoint changes, trust establishment, VPN/private and air-gapped exchange.**

### **20\. Serverless vs persistent validator model**

Specify what PoVI behavior is safe on event-driven platforms versus persistent nodes and how durable signing/lock state is preserved.

**LOCKED — Specify what PoVI behavior is safe on event-driven platforms versus persistent nodes and how durable signing/lock state is preserved.**

### **21\. Validator software supply chain**

Signed installers, release channels, checksums, manifests, rollback protection, architecture detection, unattended enterprise deployment, RPi packaging.

**LOCKED — Signed installers, release channels, checksums, manifests, rollback protection, architecture detection, unattended enterprise deployment, RPi packaging.**

### **22\. Protocol upgrade compatibility**

Define mixed-version window, readiness, minimum supported versions, activation failure, rollback limits, and future-height migration.

**LOCKED — Define mixed-version window, readiness, minimum supported versions, activation failure, rollback limits, and future-height migration.**

### **23\. Observability/SRE model**

Define metrics/logs/traces, validator/finality health, queues, evidence/OPC/AI status, SLOs, and non-authoritative monitoring.

**LOCKED — Define metrics/logs/traces, validator/finality health, queues, evidence/OPC/AI status, SLOs, and non-authoritative monitoring.**

### **24\. STRATUM platform incident management**

Separate application/platform incidents from physical infrastructure incidents.

**LOCKED — Separate application/platform incidents from physical infrastructure incidents.**

### **25\. Catastrophic recovery ceremonies**

Define dormant recovery authorities, key generation/distribution/testing/rotation/activation/audit.

**LOCKED — Define dormant recovery authorities, key generation/distribution/testing/rotation/activation/audit.**

### **26\. Data rights vs evidence retention**

Resolve deletion requests, legal hold, crypto-shredding, regulatory retention, and permanent DIR commitments.

**LOCKED — Resolve deletion requests, legal hold, crypto-shredding, regulatory retention, and permanent DIR commitments.**

### **27\. Cross-tenant shared assets**

Formalize ownership, custody, operator, maintainer, utility/OEM access, and shared canonical object semantics.

**LOCKED — Formalize ownership, custody, operator, maintainer, utility/OEM access, and shared canonical object semantics.**

### **28\. Inter-project asset migration**

Preserve asset identity/history through site/project/owner transfer using explicit custody/ownership/location transitions.

**LOCKED — Preserve asset identity/history through site/project/owner transfer using explicit custody/ownership/location transitions.**

### **29\. Replacement and supersession**

Define REPLACED\_BY, component swaps, serial changes, refurbishment, remanufacturing, and identity-continuity thresholds.

**LOCKED — Define REPLACED\_BY, component swaps, serial changes, refurbishment, remanufacturing, and identity-continuity thresholds.**

### **30\. Offline conflict examples**

Provide deterministic rules for competing field updates, inspections, incident duplicates, late telemetry, Spatial edits, and disconnected approvals.

**LOCKED — Provide deterministic rules for competing field updates, inspections, incident duplicates, late telemetry, Spatial edits, and disconnected approvals.**

### **31\. Spatial coordinate normative appendix**

Define frames, transforms, units, precision, orientation, origin, EPSG/GIS, BIM transforms, XR registration, uncertainty, and revision transforms.

**LOCKED — Define frames, transforms, units, precision, orientation, origin, EPSG/GIS, BIM transforms, XR registration, uncertainty, and revision transforms.**

### **32\. Spatial source conflict resolution**

Formalize precedence/review when LiDAR, BIM, survey, field, OEM, and AI geometry disagree.

**LOCKED — Formalize precedence/review when LiDAR, BIM, survey, field, OEM, and AI geometry disagree.**

### **33\. Reality-capture quality metrics**

Define accuracy, density, calibration, provenance, completeness, alignment residual, and acceptance tolerance.

**LOCKED — Define accuracy, density, calibration, provenance, completeness, alignment residual, and acceptance tolerance.**

### **34\. IFC/AAS mapping tables**

Publish explicit canonical translation mappings rather than conceptual compatibility only.

**LOCKED — Publish explicit canonical translation mappings rather than conceptual compatibility only.**

### **35\. Data Room records management**

Formalize versions, lock/check-out, review, supersession, transmittals, packages, metadata inheritance, retention, and relationships.

**LOCKED — Formalize versions, lock/check-out, review, supersession, transmittals, packages, metadata inheritance, retention, and relationships.**

### **36\. DIR proof package**

Normative portable proof format enabling external verification.

**LOCKED — Normative portable proof format enabling external verification.**

### **37\. Independent STRATUM Proof Verifier**

Offline tool verifies hashes, signatures, PFCs, NDIR inclusion, schemas, and historical validator keys.

**LOCKED — Offline tool verifies hashes, signatures, PFCs, NDIR inclusion, schemas, and historical validator keys.**

### **38\. Canonical cost taxonomy**

Standardize labor, material, equipment, subcontract, freight, tax, escalation, risk, contingency, general conditions, overhead, profit, allowance, lifecycle cost.

**LOCKED — Standardize labor, material, equipment, subcontract, freight, tax, escalation, risk, contingency, general conditions, overhead, profit, allowance, lifecycle cost.**

### **39\. Costing/project-controls reconciliation**

Formalize Estimate→Budget→Commitment→Actual→Forecast→Change→EAC lineage.

**LOCKED — Formalize Estimate→Budget→Commitment→Actual→Forecast→Change→EAC lineage.**

### **40\. Procurement authenticity chain**

Unify serial/lot/CoC/FAT/shipping/receiving/OEM verification/gray-market/substitution history.

**LOCKED — Unify serial/lot/CoC/FAT/shipping/receiving/OEM verification/gray-market/substitution history.**

### **41\. Contract management model**

Add Contract, Subcontract, PO, ChangeOrder, claim/notice, invoice/payment references, authority, parties, approvals, document hash.

**LOCKED — Add Contract, Subcontract, PO, ChangeOrder, claim/notice, invoice/payment references, authority, parties, approvals, document hash.**

### **42\. Schedule semantics**

Formalize activities, milestones, predecessors, calendars, constraints, baseline/current/lookahead/actual dates, and accepted vs forecast.

**LOCKED — Formalize activities, milestones, predecessors, calendars, constraints, baseline/current/lookahead/actual dates, and accepted vs forecast.**

### **43\. ITP workflow objects**

Make inspection/test plans, criteria, hold/witness points, evidence and signoff first-class.

**LOCKED — Make inspection/test plans, criteria, hold/witness points, evidence and signoff first-class.**

### **44\. Executable commissioning scripts**

Represent FPT/IST procedures in SIR with prerequisites, expected results, evidence, approvals, holds, commands, and recovery.

**LOCKED — Represent FPT/IST procedures in SIR with prerequisites, expected results, evidence, approvals, holds, commands, and recovery.**

### **45\. Physical LOTO objects**

Model locks, tags, isolation points, authorized/affected employees, group LOTO, lockboxes, transfer, removal, zero-energy verification.

**LOCKED — Model locks, tags, isolation points, authorized/affected employees, group LOTO, lockboxes, transfer, removal, zero-energy verification.**

### **46\. Emergency degraded operation**

Define safe behavior when normal STRATUM services are unavailable during emergencies.

**LOCKED — Define safe behavior when normal STRATUM services are unavailable during emergencies.**

### **47\. Safety responsibility boundary**

Explicitly state AI/STRATUM assistance does not transfer statutory safety duties.

**LOCKED — Explicitly state AI/STRATUM assistance does not transfer statutory safety duties.**

### **48\. Accessibility acceptance criteria**

Define measurable requirements for keyboard, screen reader, touch, reduced motion, mobile/offline and conflict visibility.

**LOCKED — Define measurable requirements for keyboard, screen reader, touch, reduced motion, mobile/offline and conflict visibility.**

### **49\. Design-system semantic tokens**

Standardize trust, hazard, finality, uncertainty, operational, sync, approval, and privacy visual tokens.

**LOCKED — Standardize trust, hazard, finality, uncertainty, operational, sync, approval, and privacy visual tokens.**

### **50\. Deployment SKUs**

Formalize Pilot, Project, Facility, Enterprise, Sovereign, Air-Gapped, Mission-Critical reference architectures.

**LOCKED — Formalize Pilot, Project, Facility, Enterprise, Sovereign, Air-Gapped, Mission-Critical reference architectures.**

### **51\. SLO/SLA tiers**

Separate protocol guarantees from commercial service uptime/support objectives.

**LOCKED — Separate protocol guarantees from commercial service uptime/support objectives.**

### **52\. Benchmark-derived numeric targets**

Use explicit TBD-by-benchmark tables until reproducible measurements justify limits.

**LOCKED — Use explicit TBD-by-benchmark tables until reproducible measurements justify limits.**

### **53\. Consolidated threat-model table**

Gather Byzantine threshold, keys, malicious sources, cloud outage, compromised quorum, device spoofing, AI manipulation, insider threats.

**LOCKED — Gather Byzantine threshold, keys, malicious sources, cloud outage, compromised quorum, device spoofing, AI manipulation, insider threats.**

### **54\. XR/Jarvis privacy impact assessment**

Add DPIA-style analysis for camera, voice, Spatial tracking, retention, consent/authorization, minimization, and worker privacy.

**LOCKED — Add DPIA-style analysis for camera, voice, Spatial tracking, retention, consent/authorization, minimization, and worker privacy.**

### **55\. Legal/evidentiary positioning**

Keep immutability, engineering approval, regulatory acceptance, certification, legal admissibility distinct.

**LOCKED — Keep immutability, engineering approval, regulatory acceptance, certification, legal admissibility distinct.**

### **56\. Open-source/proprietary boundary**

Define which protocol/spec/proof-verifier/SDK components should be open versus proprietary Spatial/Jarvis/commercial modules.

**LOCKED — Define which protocol/spec/proof-verifier/SDK components should be open versus proprietary Spatial/Jarvis/commercial modules.**

### **57\. Protocol namespaces/versioning**

Define POVI/1-style stable version IDs, schema namespaces, domain-separation strings, and compatibility rules.

**LOCKED — Define POVI/1-style stable version IDs, schema namespaces, domain-separation strings, and compatibility rules.**

### **58\. Network lifecycle**

Define network creation, ACTIVE, planned shutdown, archival, successor network, migration, and fork-prevention policy.

**LOCKED — Define network creation, ACTIVE, planned shutdown, archival, successor network, migration, and fork-prevention policy.**

### **59\. Cross-chain policy**

Production external anchoring is prohibited by default; import/export proof interoperability may exist without dependency.

**LOCKED — Production external anchoring is prohibited by default; import/export proof interoperability may exist without dependency.**

### **60\. Terminology migration appendix**

Map STRATUM Twin→STRATUM Spatial Verified, block→DIR, genesis block→Genesis DIR, and document legacy internal chain/API/table names.

**LOCKED — Map STRATUM Twin→STRATUM Spatial Verified, block→DIR, genesis block→Genesis DIR, and document legacy internal chain/API/table names.**

# **Part VIII — Implementation Baseline**

## **48\. Evidence-Based Implementation Audit**

A source-level audit verified that the current implementation already contains useful foundations. The architecture MUST therefore evolve by convergence rather than by discarding existing work.

| Capability | Status | Evidence / interpretation |
| :---- | :---- | :---- |
| Validators A/B/C deployed | IMPLEMENTED FOUNDATION | Three separate validator repositories/services exist and are deployed. |
| Canonical hashing / signed peer votes | IMPLEMENTED | Current validator code canonicalizes records, hashes them, signs with local asymmetric keys, and verifies peer signatures. |
| Hash-linked ledger persistence | IMPLEMENTED FOUNDATION | Current code stores chain transactions, heights, previous hash, proposer, votes, and finalization state in PostgreSQL. |
| Current 2-of-3 serverless quorum | IMPLEMENTED BUT NON-CONFORMING TO PoVI TARGET | Current code accepts two of three signatures; locked PoVI quorum for N=3 is three. |
| Full PoVI PROPOSE/VERIFY/LOCK/COMMIT/FINALIZE | PLANNED | Current implementation does not implement the full locked BFT state machine. |
| PLC / PFC formal objects | PLANNED / PARTIAL PRECURSOR | Validator signatures exist but formal certificates/state machine do not. |
| VRF proposer selection | PLANNED | Current anchor caller acts as proposer. |
| Dynamic validator registry / governed activation | PLANNED | A/B/C are configuration-defined. |
| One-click portable validator / Raspberry Pi | PLANNED | Packaging and persistent portable runtime remain to be built. |
| STRATUM Spatial Verified asset APIs/access | IMPLEMENTED FOUNDATION / PARTIAL | Repository includes organizations/projects/assets/access policies and lifecycle workflows. |
| Cryptographic approvals / passkeys / separation of duties | IMPLEMENTED FOUNDATION / PARTIAL | Approval workflow verifies signing keys or WebAuthn grants, requires role/policy/evidence, and blocks performer self-approval. |
| Lifecycle-to-ledger anchoring | PARTIAL | Approved lifecycle records can be anchored to the current serverless ledger. |
| STRATUM AI Costing core | IMPLEMENTED / PARTIAL | Existing application includes multi-tenant architecture, estimates, RFIs/RFQs, suppliers, migrations, drawing/Spatial-related work. |
| AI Costing canonical STRATUM integration | PARTIAL / PLANNED | Requires convergence to shared asset/Spatial/Data Room/DIR schemas. |
| MyJarvis | IMPLEMENTED / PARTIAL STANDALONE | Repository contains agent/admin/evaluation/model-routing and application infrastructure. |
| JARVIS as unified STRATUM orchestrator | PARTIAL | Requires shared context, PoVI awareness, agent authority, Spatial/Data Room/Costing/OPC integration. |
| Data Room | PARTIAL | Deployed projects exist; canonical Artifact/Evidence Service and proof integration remain to converge. |
| OPC UA Bridge / edge runtime | PLANNED | Architecture specified; implementation not verified. |
| SIR / Studio / WASM | PLANNED | Architecture specified; implementation not verified. |
| Testing/conformance suite | PARTIAL / PLANNED | Some CI/smoke testing exists; formal PoVI/adversarial/conformance program remains. |

## **49\. Implemented / Partial / Planned Matrix**

This matrix is the canonical baseline until superseded by a deeper repository-by-repository audit. Planned architecture is never to be presented as already built.

### **Implemented foundations**

* Validators A/B/C services  
* canonical hashing  
* asymmetric signing and peer signature verification  
* hash-linked ledger persistence  
* asset/project/organization access foundation  
* cryptographic approval/passkey flow  
* separation of duties foundation  
* AI Costing application foundations  
* MyJarvis application foundation

### **Partial / convergence required**

* STRATUM Spatial Verified lifecycle/evidence/provenance  
* Data Room  
* AI Costing Spatial integration  
* unified identity/RBAC/ABAC  
* JARVIS orchestration  
* lifecycle anchoring  
* commercial/project workflows  
* Spatial ingestion/reconstruction

### **Planned / not yet verified**

* full PoVI state machine  
* PFC/PLC  
* VRF proposer  
* dynamic validator governance  
* one-click portable validators  
* Raspberry Pi validator  
* full NDIR/MDIR/DIR pipeline  
* OPC UA bridge  
* machine-control governance  
* SIR/Studio/WASM  
* mission-critical engineering services  
* formal conformance/Byzantine harness  
* certified snapshots/recovery  
* proof verifier  
* full interoperability connector suite

## **50\. Dependency Graph and Recommended Build Order**

P0 — CANONICAL TRUST FOUNDATION  
Canonical schemas \+ terminology package  
→ Full PoVI consensus engine  
→ NDIR / MDIR / DIR implementation  
→ PFC / PLC / Genesis  
→ Dynamic validator registry  
→ One-click portable validator

P1 — PLATFORM CONVERGENCE  
STRATUM Spatial Verified convergence  
→ Data Room Artifact/Evidence Service  
→ AI Costing canonical integration  
→ Unified JARVIS context/orchestrator

P2 — FIELD / ENGINEERING / OT  
OPC UA \+ edge runtime  
→ Spatial reconstruction  
→ engineering \+ mission-critical power services  
→ QA / Safety / Commissioning / Operations

P3 — ECOSYSTEM / SCALE  
External connectors  
→ Studio / SIR / WASM  
→ enterprise certification  
→ large-scale validator topology / sovereign deployments

**LOCKED — Further feature expansion should not outrun protocol/schema convergence and implementation verification.**

# **Appendix A — Master Data Classification Matrix**

| Object / Data | Primary Class | Authority | Storage | NDIR/MDIR/DIR | Retention | Privacy |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Raw sensor sample | OPC\_UA\_TELEMETRY / NANO\_DIR | Source signature \+ quality; not canonical lifecycle | Time-series / edge / Data Room | NDIR; root may feed MDIR | R0–R3 | OT-sensitive as applicable |
| Alarm / protection trip | MICRO\_DIR \+ source NDIRs | Source \+ event validation \+ PoVI when finalized | Operational DB \+ Data Room \+ ledger refs | MDIR→DIR | R2–R4 | OT/Safety |
| Design drawing / SLD | DOCUMENT / EVIDENCE | Source/revision/approval | Data Room | Hash/evidence ref; change MDIR if trust-critical | R2–R4 | Project confidential |
| BIM/IFC model | DOCUMENT / SPATIAL\_MODEL | Source/revision \+ review | Data Room / Spatial object store | Manifest/hash via MDIR as needed | R2–R4 | Project confidential |
| Reality scan / point cloud | REALITY\_CAPTURE / SPATIAL\_MODEL | Capture provenance \+ calibration \+ review | Spatial object store / Data Room | Capture hash/root; Spatial verify MDIR | R2–R4 | Restricted/Personal possible |
| Asset identity | APPLICATION\_STATE \+ canonical state | Stable assetId \+ governed provenance | Operational DB \+ ledger projection | Registration MDIR→DIR | R3–R4 | Project |
| Asset lifecycle state | CONSENSUS\_STATE | Finalized event history | Validator state \+ projections | MDIR→DIR | R4 | Project |
| Work task activity | APPLICATION\_STATE | Workflow state; evidence-backed milestones | Operational DB | Milestone MDIR where required | R1–R3 | Internal |
| Approval | AUDIT / EVIDENCE | Authorized signature/credential | Operational DB \+ Data Room | Approval MDIR where trust-critical | R3–R4 | Restricted |
| Incident | APPLICATION\_STATE / EVIDENCE / AUDIT | Confirmed facts \+ evidence \+ approvals | Operational DB \+ Data Room | Major transitions MDIR→DIR | R2–R4 | Safety/Personal possible |
| Maintenance record | APPLICATION\_STATE / EVIDENCE | Work/evidence/approval | DB \+ Data Room | Completion MDIR→DIR when required | R3–R4 | Project |
| Commissioning result | EVIDENCE / CONSENSUS\_STATE | Test \+ witness \+ approval | Data Room \+ ledger projection | MDIR→DIR | R4 | Project |
| Estimate | APPLICATION\_STATE | Commercial approval/version | AI Costing DB | Optional MDIR for approved trust-relevant revision | R2–R3 | Commercial confidential |
| AI recommendation | AI\_DERIVED | Model/provenance; advisory | DB / Data Room as needed | Not canonical unless human/governed action creates MDIR | R0–R3 | Policy-dependent |
| Search index / embedding | SEARCH\_INDEX / CACHE | None—derived | Search/vector store | None | R0–R1 | Mirrors source restrictions |
| DIR / PFC | DIR\_HISTORY / CONSENSUS\_STATE | PoVI | Validators \+ archives | DIR | R4 | Proof metadata; payload refs controlled |

# **Appendix B — Master Event and State Registry**

| Event | Subject | Precondition | Required evidence | HITL | Priority | Effect |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| ASSET\_REGISTERED | Asset | None/unique identity | Asset metadata \+ provenance | H2/H3 as project policy | P2 | REGISTERED |
| ASSET\_RECEIVED | Asset | REGISTERED | Receiving evidence / authenticity | H2 | P2 | RECEIVED |
| ASSET\_INSTALLED | Asset | REGISTERED/RECEIVED | Installation evidence | H2/H3 | P2 | INSTALLED |
| INSPECTION\_COMPLETED | Asset/Work | Applicable work complete | Inspection evidence \+ inspector | H3 | P2 | INSPECTED |
| TEST\_PASSED | Asset/System | Test prerequisites | Raw test/instrument/calibration | H3/H4 | P2 | TESTED |
| COMMISSIONING\_COMPLETED | Asset/System | Required tests/deficiencies closed | Commissioning package | H3/H4 | P2 | COMMISSIONED |
| ASSET\_VERIFIED | Asset | Required lifecycle evidence | Approval \+ evidence \+ state validation | H3/H4 | P1/P2 | VERIFIED |
| MAINTENANCE\_COMPLETED | Asset/WO | Approved WO | Work/evidence/parts/instrument | H2/H3 | P3 | MAINTAINED |
| CONFIGURATION\_CHANGED | Asset/System | Authorized current config | Change evidence \+ approvals | H3/H4 | P2 | MODIFIED |
| ASSET\_RETIRED | Asset | Policy conditions | Retirement reason/evidence | H3 | P2 | RETIRED |
| SPATIAL\_POSITION\_VERIFIED | Asset/Spatial | Evidence hierarchy | Survey/scan/field evidence | H3 | P2 | Spatial trust update |
| INCIDENT\_REPORTED | Incident | None | Reporter/source/evidence | H1/H2 | P1 | OPEN |
| INCIDENT\_CONFIRMED | Incident | Reported \+ evidence | Qualified confirmation | H3 | P1 | CONFIRMED |
| LOTO\_APPLIED | Safety/Asset | Permit/JHA | Lock/tag/isolation evidence | H3/H4 | P1 | ISOLATED |
| ZERO\_ENERGY\_VERIFIED | Safety/Asset | LOTO applied | Instrument/result/calibration | H3/H4 | P1 | ZERO\_ENERGY\_VERIFIED |
| ENERGIZATION\_AUTHORIZED | Asset/System | Safety/commissioning prerequisites | Exact action approval | H4/H5 | P1 | AUTHORIZED |
| PROTECTION\_TRIP | Asset/System | Source event | OPC/source NDIRs | H0 observation; H2+ interpretation | P1 | Operational event |
| VALIDATOR\_ADMISSION\_PROPOSED | Validator | Candidate synced | Identity/health/package | H5 governance | P0 | CANDIDATE |
| VALIDATOR\_ACTIVATED | Validator | Governed admission | Governance proof | H5 | P0 | ACTIVE |
| VALIDATOR\_QUARANTINED | Validator | Objective evidence/emergency policy | Fault/equivocation evidence | H5/defined emergency | P0 | QUARANTINED |
| PROTOCOL\_VERSION\_SCHEDULED | Protocol | Conformance/governance | Change/test/security package | H5 | P0 | SCHEDULED |
| POLICY\_EXCEPTION\_APPROVED | Compliance | Exception request | Reason/evidence/expiry/compensating control | H3/H4 | P1/P2 | APPROVED\_EXCEPTION |
| PROCUREMENT\_SUBSTITUTION\_APPROVED | Commercial/Asset | Comparison complete | Technical/commercial evidence | H3/H4 | P2 | APPROVED\_SUBSTITUTION |

The complete machine-readable registry must expand this starter catalog to every event family identified in the Redbook. No untyped event may mutate canonical state.

# **Appendix C — Master Implementation Status Matrix**

## **Validators A/B/C deployed — IMPLEMENTED FOUNDATION**

Three separate validator repositories/services exist and are deployed.

### **Canonical hashing / signed peer votes — IMPLEMENTED**

Current validator code canonicalizes records, hashes them, signs with local asymmetric keys, and verifies peer signatures.

### **Hash-linked ledger persistence — IMPLEMENTED FOUNDATION**

Current code stores chain transactions, heights, previous hash, proposer, votes, and finalization state in PostgreSQL.

### **Current 2-of-3 serverless quorum — IMPLEMENTED BUT NON-CONFORMING TO PoVI TARGET**

Current code accepts two of three signatures; locked PoVI quorum for N=3 is three.

### **Full PoVI PROPOSE/VERIFY/LOCK/COMMIT/FINALIZE — PLANNED**

Current implementation does not implement the full locked BFT state machine.

### **PLC / PFC formal objects — PLANNED / PARTIAL PRECURSOR**

Validator signatures exist but formal certificates/state machine do not.

### **VRF proposer selection — PLANNED**

Current anchor caller acts as proposer.

### **Dynamic validator registry / governed activation — PLANNED**

A/B/C are configuration-defined.

### **One-click portable validator / Raspberry Pi — PLANNED**

Packaging and persistent portable runtime remain to be built.

### **STRATUM Spatial Verified asset APIs/access — IMPLEMENTED FOUNDATION / PARTIAL**

Repository includes organizations/projects/assets/access policies and lifecycle workflows.

### **Cryptographic approvals / passkeys / separation of duties — IMPLEMENTED FOUNDATION / PARTIAL**

Approval workflow verifies signing keys or WebAuthn grants, requires role/policy/evidence, and blocks performer self-approval.

### **Lifecycle-to-ledger anchoring — PARTIAL**

Approved lifecycle records can be anchored to the current serverless ledger.

### **STRATUM AI Costing core — IMPLEMENTED / PARTIAL**

Existing application includes multi-tenant architecture, estimates, RFIs/RFQs, suppliers, migrations, drawing/Spatial-related work.

### **AI Costing canonical STRATUM integration — PARTIAL / PLANNED**

Requires convergence to shared asset/Spatial/Data Room/DIR schemas.

### **MyJarvis — IMPLEMENTED / PARTIAL STANDALONE**

Repository contains agent/admin/evaluation/model-routing and application infrastructure.

### **JARVIS as unified STRATUM orchestrator — PARTIAL**

Requires shared context, PoVI awareness, agent authority, Spatial/Data Room/Costing/OPC integration.

### **Data Room — PARTIAL**

Deployed projects exist; canonical Artifact/Evidence Service and proof integration remain to converge.

### **OPC UA Bridge / edge runtime — PLANNED**

Architecture specified; implementation not verified.

### **SIR / Studio / WASM — PLANNED**

Architecture specified; implementation not verified.

### **Testing/conformance suite — PARTIAL / PLANNED**

Some CI/smoke testing exists; formal PoVI/adversarial/conformance program remains.

This appendix must be regenerated after each implementation audit and release candidate. Status claims require evidence.

# **Appendix D — Normative Protocol Schema Catalog**

## **Canonical Envelope**

objectId, objectType, schemaVersion, tenantId, organizationId, projectId, createdAt, createdBy, updatedAt, status, trustClass, sourceRefs, DIRRefs

### **NDIR**

nanoDirId, schemaVersion, sourceId, sourceSequence, eventOccurredAt, recordedAt, dataType, engineeringUnit, valueHash/payloadHash, payloadRef, quality, contextRefs, sourceSignature, optional gatewaySignature, aggregationRef

### **MDIR**

microDirId, eventType, eventVersion, subjectRefs, actorRef, eventOccurredAt, submittedAt, acceptedSequence, priorityClass, dependencies, evidenceRefs, NDIR roots/refs, payloadHash, proposedStateTransition, signatures, status

### **DIR**

chainId, height, round, previousDIRHash, orderedMicroDIRRoot, stateRoot, validatorSetRoot, protocolVersion, proposerId, entropy/VRF evidence, finalizedAt, PFC, DIRHash

### **PROPOSAL**

domain, chainId, height, round, validatorSetRoot, protocolVersion, proposalHash, DIR candidate/header, proposerId, VRFProof, signature

### **VERIFY**

domain, chainId, height, round, step=VERIFY, proposalHash|NIL, validatorId, validatorSetRoot, protocolVersion, signature

### **PLC**

chainId, height, round, proposalHash, signer set/bitmap, VERIFY signatures or aggregate proof, validatorSetRoot, protocolVersion

### **COMMIT**

domain, chainId, height, round, step=COMMIT, proposalHash, stateRoot, validatorId, validatorSetRoot, protocolVersion, signature

### **PFC**

chainId, height, round, DIRHash, stateRoot, validatorSetRoot, protocolVersion, signer set/bitmap, COMMIT signatures/aggregate proof

### **ROUND\_CHANGE**

chainId, height, newRound, validatorId, lockedDIR/lockedRound if any, validDIR/validRound if any, evidence refs, signature

### **EquivocationEvidence**

validatorId, chainId, height, round, step, messageA, signatureA, messageB, signatureB, detectedAt

### **Validator Identity**

validatorId, friendlyLabel, consensusPublicKey/version, vrfPublicKey/version, transportPublicKey/version, operatorOrg, state, activation/retirement heights, assurance

### **Enrollment**

enrollmentId/code hash, candidate validatorId, public keys, package/build attestation, network, issuedBy, issuedAt, expiresAt, consumedAt

### **Genesis DIR**

chainId, networkName, environment, genesisTime, protocolVersion, initialValidatorSet, trustRoots, governanceAuthorities, moduleRegistry, resourcePolicy, schemaRegistry, genesisStateRoot, GenesisDIRHash

### **Snapshot Certificate**

snapshotHeight, DIRHash, stateRoot, validatorSetRoot, protocolVersion, stateManifestRoot, SpatialManifestRoot, evidenceManifestRoot, signer proof

### **DIR Proof Package**

manifestVersion, chainId, target refs, canonical object/hash, Merkle path, containing DIR, PFC, validator/key history refs, schema/protocol versions, artifact hashes, verifier hints

Exact canonical datatypes, binary/JSON encoding, field optionality, signature domain strings, maximum resource envelopes, and test vectors are mandatory engineering follow-ons. RFC 8785-style canonical JSON is the initial deterministic encoding baseline (Rundgren et al., 2020).

# **Appendix E — HITL Authority Matrix**

| Level | Meaning | Typical examples | Boundary |
| :---- | :---- | :---- | :---- |
| H0 | Automated observation | Sensor ingestion, low-risk classification, telemetry aggregation | No physical/engineering approval |
| H1 | Recommendation | AI recommendation, maintenance suggestion, nonbinding warning | Human not required to view, but output is advisory |
| H2 | Human confirmation | Routine field acknowledgement, low-risk evidence confirmation | Named authenticated human |
| H3 | Qualified approval | Inspection, engineering review, commissioning acceptance, substitution approval where policy allows | Credentialed role \+ action-bound approval |
| H4 | Multi-party approval | Energization, high-risk commissioning/safety/commercial/engineering actions | Two or more required authorities / separation of duties |
| H5 | Safety / governance high assurance | Validator/protocol governance, exceptional safety-critical control, catastrophic recovery | Defined governance or highest-assurance authority |

**LOCKED — Every high-consequence action declares a HITL level; AI/automation cannot downgrade it.**

# **Appendix F — Trust-State and Terminology Migration Glossary**

| Legacy/Ambiguous | Canonical | Rule |
| :---- | :---- | :---- |
| STRATUM Twin | STRATUM Spatial Verified / Spatial model | Deprecated user-facing term; may remain in legacy repo/table/API names. |
| STRATUM Verified Twin | STRATUM Spatial Verified | Deprecated. |
| block | DIR | User-facing STRATUM terminology. |
| genesis block | Genesis DIR | User-facing STRATUM terminology. |
| transaction / chain record | MDIR / DIR-linked record as appropriate | Internal historical naming may remain until migrated. |
| digital twin | Spatial model | Avoid in canonical product definition. |
| Verified | Must specify Field Verified, PoVI Verified, OEM Verified, Source Verified, etc. | Generic 'verified' alone is ambiguous. |
| Approved | Human/governance authorization state | Does not equal PoVI finality. |
| Finalized | PoVI finality with PFC | Does not automatically equal engineering/legal approval. |
| Live | Current source observation | Does not equal verified/canonical truth. |
| Inferred / Predicted | Derived/AI or model output | Never represented as observed fact. |

# **Appendix G — Reference Deployment Profiles**

## **Pilot**

3 validators; small project; Vercel/PC/RPi mix; app database; Data Room; basic archive; no assumption of serverless full-PoVI until crash-safe lock/vote semantics verified.

## **Project**

3–6 validators across at least two failure domains; edge gateway; Data Room; Spatial; Costing; Jarvis; project identity/approval policies.

## **Facility**

5–9 validators; site edge/OPC UA; archive; Spatial archive; higher availability; maintenance/commissioning/safety workflows.

## **Mission-Critical**

7+ validators across independent power/network/provider failure domains; redundant edge/relays; strong key custody; high-assurance commissioning/safety; rigorous SLOs and recovery drills.

## **Enterprise**

Multi-site/multi-org; dedicated archives/analytics; connector fabric; centralized governance with project-specific sub-authorities; scale policy.

## **Sovereign / Customer Cloud**

Customer-controlled data/key residency; private VPC/on-prem options; signed packages; provider-neutral proof/recovery.

## **Air-Gapped**

Independent chainId/Genesis/trust roots; offline package transfer/proof verification; no public internet dependency.

# **Appendix J — References**

buildingSMART International. (2024). Industry Foundation Classes (IFC): An introduction. https\://technical.buildingsmart.org/standards/ifc/

Castro, M., & Liskov, B. (1999). Practical Byzantine fault tolerance. In Proceedings of the Third Symposium on Operating Systems Design and Implementation (OSDI '99) (pp. 173–186). USENIX Association.

Industrial Digital Twin Association. (2026). Asset Administration Shell specifications. https\://industrialdigitaltwin.org/en/content-hub/aasspecifications

National Fire Protection Association. (2026). NFPA LiNK. https\://link.nfpa.org/

National Institute of Standards and Technology. (2024). The NIST Cybersecurity Framework (CSF) 2.0 (NIST CSWP 29). https\://doi.org/10.6028/NIST.CSWP.29

OPC Foundation. (n.d.). OPC Unified Architecture core specifications. https\://profiles.opcfoundation.org/document/1

Rose, S., Borchert, O., Mitchell, S., & Connelly, S. (2020). Zero trust architecture (NIST Special Publication 800-207). National Institute of Standards and Technology. https\://doi.org/10.6028/NIST.SP.800-207

Rundgren, A., Jordan, B., & Erdtman, S. (2020). JSON Canonicalization Scheme (JCS) (RFC 8785). RFC Editor. https\://doi.org/10.17487/RFC8785

World Wide Web Consortium. (2026). Web Authentication: An API for accessing Public Key Credentials—Level 3\. https\://www\.w3.org/TR/webauthn-3/

STRATUM Power. (2026). STRATUM Spatial Verified implementation repositories and deployment records \[Internal software artifacts\].

STRATUM Power. (2026). STRATUM Chain validator A/B/C implementation and serverless ledger source \[Internal software artifacts\].

STRATUM Power. (2026). STRATUM AI Costing product architecture and database migrations \[Internal software artifacts\].

STRATUM Power. (2026). MyJarvis implementation repository and deployment configuration \[Internal software artifacts\].

## **Updated Standards and Technical References**

buildingSMART International. (2024). IFC 4.3 formally approved and published as an ISO standard. https\://www\.buildingsmart.org/ifc-4-3-formally-approved-and-published-as-an-iso-standard/

buildingSMART International. (2026). Industry Foundation Classes (IFC): Latest official release 4.3.2.0 (ISO 16739-1:2024). https\://www\.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/

National Institute of Standards and Technology. (2024, August 13). Announcing approval of three Federal Information Processing Standards (FIPS) for post-quantum cryptography: FIPS 203, FIPS 204, and FIPS 205\. https\://csrc.nist.gov/News/2024/postquantum-cryptography-fips-approved

OPC Foundation. (n.d.). OPC Unified Architecture Core (Document 10000 series). https\://profiles.opcfoundation.org/document/1

World Wide Web Consortium. (2026, May 26). Web Authentication: An API for accessing Public Key Credentials—Level 3 (Candidate Recommendation Snapshot). https\://www\.w3.org/TR/webauthn-3/

## **Reference and Citation Convention**

External standards references are formatted in APA style to the extent practical for standards/web publications. STRATUM-specific architecture, internal repositories, and implementation artifacts are identified as internal software/architecture sources. Standards are referenced for interoperability, security, terminology, and established practice; STRATUM-specific constructs such as PoVI, NDIR/MDIR/DIR terminology, JARVIS orchestration policy, and the STRATUM Spatial trust model remain STRATUM architecture decision

REDBOOK v1.1 — INTEGRATED EPC LIFECYCLE & REALITY VALIDATION AMENDMENT

Revision date: 23 September 2026

Status: Conceptually Locked / Normative architectural amendment. Where this amendment conflicts with Version 1.0 wording, this amendment governs. Implementation status remains independently evidenced.

1\. Canonical Product Thesis

STRATUM Spatial Verified is a governed infrastructure lifecycle system, not merely a visualization engine. Its purpose is to convert project and operational evidence into an explicit, revisioned representation of infrastructure that can be compared against field reality and carried continuously from preconstruction through design, construction, commissioning, handover and operations.

The canonical customer lifecycle is:

Opportunity / RFP / RFQ → Project Setup → Multi-Discipline Source Ingestion → Engineering Comprehension → Spatial Compilation → Design Validation → Governed Design Revision → Construction → Field Reality Capture → Reality Validation → Discrepancy / RFI / Change / Incident → Engineering Decision → Governed Revision → Commissioning → As-Built Compilation → Audit / Closeout → Handover → Operations / Maintenance → Continuous Lifecycle Revision.

2\. Locked Truth Separation

Designed, Observed and Verified are permanently distinct semantic classes.

Designed:

A governed representation of intended infrastructure derived from approved project sources.

Observed:

A field-captured condition derived from a person, image, video, scan, measurement, device, inspection, markup or other source with provenance.

Verified:

A governed conclusion supported by the required evidence, authority and policy.

No visual match, model placement, QR scan, telemetry stream, AI inference, blockchain anchor, hash or database record alone converts Designed or Observed into Verified physical truth.

3\. Multi-Discipline Engineering Comprehension

STRATUM SHALL reason across architectural, electrical, mechanical, structural, civil, SLD, schedule, specification, OEM and authorized historical sources.

Comprehension SHALL be staged, explainable and source-linked.

The system MAY use AI, rules and specialized agents for extraction, reconciliation and recommendations, but uncertain assertions SHALL retain confidence/trust labels and SHALL NOT silently become canonical truth.

4\. Cross-Discipline Expected Power

The architecture SHALL support identification of powered equipment outside electrical drawings.

Examples include HVAC units, pumps, controls, lighting, roof equipment, mechanical-room equipment and other facility/process loads.

For such equipment, STRATUM MAY determine an expected electrical requirement from source/OEM/rule context, search the electrical model for corresponding provision, and create an explicit finding when the feed is missing or ambiguous.

Expected power is an inference unless and until governed review establishes a stronger status.

STRATUM SHALL NOT fabricate an electrical design or professional approval.

5\. Component / OEM Library Doctrine

The Component Library is a governed knowledge asset, not an uncontrolled graphics catalog.

A component entry SHALL retain identity, family, manufacturer/model where known, aliases, dimensions, connection points, technical attributes, source provenance, geometry/model references, version and approval status.

Representative geometry SHALL be labeled representative.

When project ingestion encounters an unknown component, the approved lifecycle is:

candidate → source/OEM research → specification/dimension validation → optional 3D creation/acquisition → human approval → versioned library registration → reuse.

Project-specific manufacturer CAD/as-built geometry MAY supersede representative geometry without erasing registry history.

6\. Spatial Placement Doctrine

The Spatial model SHALL distinguish known, inferred, approximate and unknown placement.

Scale, X, Y, Z, floor, elevation, alignment and coordinate frame SHALL be supported by explicit evidence or retain uncertainty.

A schedule row may create a canonical asset candidate without creating false XYZ coordinates.

Visualization is a projection of canonical identity/semantics and does not become authority by appearance.

7\. One Canonical Asset Across Representations

A physical asset has one canonical identity across:

2D drawings;

SLD/logical topology;

3D Spatial representation;

asset tables;

timeline/history;

dependency graph;

QR;

Asset Passport;

field work;

maintenance;

incident;

commissioning;

costing;

audit and closeout.

View-specific representations SHALL NOT create duplicate authoritative assets.

8\. Construction Reality Loop

Construction is a governed feedback loop rather than a one-way handoff.

Governed Design Revision

→ Construction / Installation

→ Field Capture

→ Reality Validation

→ Match or Discrepancy

→ Impact / Recommendation

→ RFI / Change / Incident / Corrective Work

→ Engineering / Owner Decision

→ ChangeSet

→ New Governed Revision

→ Return to Field.

A confirmed RFI response does not overwrite history. It creates a decision event and, when approved, a new governed revision.

9\. Field / Reality Application Boundary

A dedicated field application or focused mobile surface is approved as part of the architecture.

Its canonical purpose is My Work, Scan, Capture, Report and Verify.

It MAY use camera, photo, video, QR, annotations, measurements and scans.

It SHALL connect through authenticated typed APIs/events to shared Identity, Asset, Work, Evidence, Annotation, Incident, RFI, HITL and revision services.

It SHALL NOT maintain an independent conflicting source of truth.

10\. Field-Marked Drawing Doctrine

Redlines, field-marked drawings, revised specifications, approved submittals, RFI responses and change documents are new governed sources.

They SHALL pass through source registration, provenance, comparison and review.

They MAY contribute to a new spatial revision after approval; they SHALL NOT bypass governance because they originated in the field.

11\. Governed Revision Doctrine

Published project/spatial revisions are immutable historical states.

Corrections and approved changes create new revisions.

Canonical current state is a projection of the latest valid/superseding governed events.

The system SHALL preserve:

predecessor/successor relationships;

source revisions;

affected entities;

ChangeSets;

approval events;

evidence;

supersession;

trust/finality state.

No user or service silently rewrites finalized project history.

12\. As-Built Doctrine

“As-Built” is a governed accepted installed-state compilation, not merely a folder label.

The As-Built state SHOULD be derived from the latest governed revision plus approved changes, validated field evidence and accepted commissioning results.

The output SHALL remain traceable to prior design states.

The target handover package may include:

final 2D documentation;

final Spatial model;

canonical asset registry and Asset Passports;

SLD/logical topology;

installation and revision history;

approved RFI/change records;

field/inspection evidence;

commissioning/test records;

OEM records;

maintenance baseline;

QR identifiers;

proof/provenance package;

audit/closeout report.

13\. Lifecycle Identity Continuity

Asset identity SHOULD persist from design through procurement, installation, verification, commissioning, turnover, operations, maintenance, repair, replacement and retirement.

Lifecycle state changes and replacements are events/lineage, not reasons to create disconnected shadow assets.

14\. Codes, Standards, Specifications and OEM Authority

Codes, standards, specifications, OEM material and historical data MAY inform design checks and recommendations.

Every such input SHALL preserve edition/version, source and applicability context.

The system SHALL distinguish:

source requirement;

rule interpretation;

AI inference;

human judgment;

AHJ/owner/professional approval.

STRATUM SHALL NOT claim automatic regulatory compliance merely because a rule was evaluated.

15\. Reality Validation and RFI Semantics

A discrepancy is a canonical object linking designed references, observed evidence, affected assets/location, type, impact, confidence, owner, status and resolution.

An RFI is a governed communication/decision workflow that may be created from a discrepancy.

JARVIS MAY draft, summarize, compare and propose alternatives, but accountable humans retain issuance and approval authority according to policy.

16\. Integration Invariants

STRATUM Spatial Verified, STRATUM Data Room, AI Costing, JARVIS, OPC UA/edge, Field/Reality surfaces and STRATUM Chain exchange typed canonical objects/events.

Modules SHALL NOT obtain authority by directly mutating another module’s database.

Storage location remains non-authoritative.

Spatial-to-Costing SHALL retain the project/source revision that produced each quantity so commercial change can be reconciled to governed scope.

17\. Trust Layer Continuity

L0 Source → L1 Architectural → L2 Physical → L3 Logical → L4 STRATUM Assets → L5 Installation → L6 Evidence → L7 Operations → L8 Trust remains canonical.

The newly expanded EPC lifecycle does not collapse these layers.

NDIR/MDIR/DIR/PoVI provide integrity, provenance, governance and finality where applicable; they do not independently prove the accuracy of physical claims.

18\. Release and Conformance Additions

A release claiming support for the revised lifecycle SHALL include evidence for:

multi-discipline ingestion;

source provenance;

cross-discipline expected-power findings;

component registry matching/versioning;

no-invented-XYZ behavior;

reality capture;

Designed/Observed/Verified separation;

discrepancy and RFI workflow;

approved change to governed revision;

historical revision preservation;

field redline re-ingestion;

commissioning exception closure;

as-built compilation;

handover completeness;

canonical identity consistency across representations;

RBAC/HITL enforcement;

mobile QR/camera and Spatial WebGL device acceptance where applicable.

19\. Updated Constitutional Summary

The system's value proposition is now locked as:

Source-to-Spatial intelligence \+ construction reality validation \+ governed decision/revision management \+ evidence-backed as-built handover \+ continuous asset lifecycle operations, with STRATUM Chain/PoVI serving as the trust/finality layer beneath—not as a substitute for engineering truth.

s.