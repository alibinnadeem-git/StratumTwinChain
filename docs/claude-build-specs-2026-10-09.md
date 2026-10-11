# STRATUM Spatial Verified — Build Specs (FINALIZED)
**Source:** Claude, Oct 9, 2026 · delivered by @Ali Bin Nadeem
**Status:** FINAL October 9 source; October 10 doctrine amendments APPROVED as an unmerged, separately reviewable proposal in this PR. The original finalized source is preserved in PRs #211/#212.

---

## Briefing

These three specs let the 32-agent team build the component library, the asset records and the ops memory vault without further clarification. The four decisions that were open are now locked, and they are recorded at the end of this section.

**Electrical first.** Electrical is the lead discipline in the pipeline, the taxonomy and the overlay. Sheets are processed in this order: electrical (power, grounding, lighting, fire alarm and low voltage), then architectural as the host and reference layer, then mechanical, then plumbing and fire protection. Mechanical and plumbing equipment is included mainly because it is an electrical load or a monitored point, so every motor, heater and flow switch can be tied back to the circuit that feeds it.

**Design rules taken from the doctrine** (every spec below is built on these):
1. Evidence or UNRESOLVED. Every asset record carries at least one evidence item (sheet, page, bounding box). No evidence, no record.
2. AI proposes, humans promote. No agent may write a status of Verified or higher. Agents write only Inferred-Predicted or UNRESOLVED.
3. Never fill a gap with a plausible default. A missing voltage, mounting height or drawing scale is stored as null plus a reason code, never as a guess.
4. One coordinate frame per twin. Metres, right-handed, Z-up (IFC/BIM convention), with exactly one glTF +Y-up conversion at the viewer/model boundary. A sheet-to-world transform is a separately reviewed proposal, not an automatic operation; absence of a transform does not erase independently established metric coordinates.

**What is not in the library.** Walls, slabs, roofs, columns and beams, plus the linear runs (conduit, cable, ground ring and bonding conductors, duct, pipe), are generated procedurally from extracted geometry. The library covers the discrete pieces on those runs: equipment, devices, boxes, bodies, fittings and tray sections. Grounding and bonding connections are stored as relations (bonded_to, grounded_by) rather than geometry.

**Sourcing caveat.** The sources in Deliverable 1 are libraries and manufacturer programmes that publish each product category. I could not open them from this session, so no individual model URL, licence or file availability is confirmed. The first task for the library agents is to run the Intake Gate (Deliverable 1) on every row and mark it passed or replace it.

**Locked decisions.** These are final and applied throughout:
1. OEM model licensing. Ship CC0 or in-house generic models by default. Use OEM models only with written permission. This is the default policy of the Intake Gate (Deliverable 1).
2. No auto-verification. Even a deterministic triple match (symbol, tag and schedule row all agree) goes to human review. No rule or automation may write Verified or higher (Deliverable 2).
3. Axis convention. Z-up metres is the canonical frame, with one Y-up conversion at the viewer root.
4. Confidence thresholds. Starting values are a top candidate score of at least 0.85, a margin of at least 0.15 over the second candidate, and at least two independent evidence kinds agreeing. They are calibrated on 20 to 30 hand-labelled sheets.

---

## 1. Component library taxonomy

The library is 100 discrete components, weighted toward electrical: Electrical (62), Architectural (14), Mechanical/HVAC (12) and Plumbing & Fire Protection (12). Each row maps the component to its drawing symbols, an IFC4 class and named sources. Electrical is split into service and distribution, raceway and cable management, grounding and bonding, wiring devices and controls, lighting, and fire alarm.

**Reading the tables.** The symbols column lists graphic cues first, then text callouts. IFC4 classes are best-fit and must be validated against the buildingSMART Data Dictionary before they are frozen. The same abbreviation means different things across disciplines, so the resolver must rank evidence in this order: legend sheet, then sheet prefix (A-, E-, M-, P-, FP-), then layer name, then abbreviation. Known collisions:
- SD: smoke detector, supply diffuser, sliding door or dimmer switch
- FD: floor drain or fire damper
- CT: cable tray or cooling tower
- LP: lighting panelboard or lightning protection
- PB: pull box or pushbutton
- MS: motor starter or mini-split
- GR: ground rod or guardrail
- WC: water closet or wall cabinet

**Source key.**

| Code | Source | Formats | Licence posture |
|------|--------|---------|-----------------|
| KEN | Kenney | GLB, FBX, OBJ | CC0, ship as-is |
| QUA | Quaternius | glTF, FBX | CC0, ship as-is |
| PPZ | Poly Pizza | GLB | CC0 or CC-BY, check each model |
| SKF | Sketchfab downloadable models | glTF | Filter to CC0 or CC-BY, check each model |
| NBS | NBS National BIM Library | IFC, RVT, ArchiCAD | Generic objects, read terms before embedding |
| BSM | BIMsmith Market | RVT, IFC and others | OEM content, permission needed to redistribute |
| BO | BIMobject | RVT, IFC and others | OEM content, permission needed to redistribute |
| ARCAT | ARCAT | RVT, CAD | OEM content, permission needed to redistribute |
| TP | TraceParts | STEP and others | OEM CAD, permission needed to redistribute |
| CC | 3D ContentCentral | STEP, SolidWorks | Supplier and community, check each model |
| RVT | Autodesk Revit default content | RFA | Licensed for use inside Revit models, do not assume it can be redistributed |
| OEM | Manufacturer's own CAD/BIM download page | Varies | Written permission or link-out only |

**Licence policy (locked).** The default is to ship CC0 or in-house generic models. An OEM model is used only with written permission from the manufacturer, filed under raw/vendor/permissions/ and logged in wiki/library/licence-register.md. Without that permission an OEM model is never loaded: the asset resolves to the generic model of the same class and is marked FALLBACK, and the OEM name stays as a reference only. Do not trace, convert or re-mesh OEM geometry into an in-house model. In-house models may follow manufacturer-published dimensions. CC-BY and other attribution licences are not covered by this decision, so they are held out of the shipped set until a decision is logged.

| Tier | Code | Rule |
|------|------|------|
| T1 | CC0_OR_INHOUSE | Ships by default. |
| T2 | OEM_PERMITTED | Ships only with the permission file referenced in the registry entry. |
| T3 | LINK_OUT | Never shipped or loaded. The viewer shows the manufacturer link and the generic stand-in. |

**Authoring plan.** Expect most of the 62 electrical rows to be in-house. The CC0 libraries cover furniture, appliances and simple props, not switchgear, tray, conduit fittings or grounding hardware. Build parametric generators per family (enclosures, tray and fittings, boxes, luminaires, wiring devices) so one generator covers many rows.

**Intake Gate.** No model enters the registry until it passes all seven checks:
1. Licence tier set to T1, T2 or T3 under the policy above. T2 needs the permission file reference. No file, no T2 entry.
2. Converted to GLB. IFC and STEP go through IfcConvert (IfcOpenShell), FreeCAD or Blender. RVT goes through IFC export first.
3. Normalised. Real-world metres, +Y up (glTF convention), origin at the host contact (floor for floor-standing, ceiling plane for ceiling-mounted, wall face for wall-mounted), front along +Z. The viewer root applies the single conversion from the canonical Z-up frame.
4. Anchored. Named empty nodes for connection and mounting points, such as mount_face, power_in, ground_lug, conduit_entry, duct_supply, pipe_in.
5. Optimised. At most 50,000 triangles for equipment and 5,000 for small devices (receptacles, detectors), compressed with glTF-Transform using meshopt or Draco.
6. Validated. Zero errors from the Khronos glTF-Validator.
7. Registered. extras carries type_id, ifc_class, source, licence_tier, permission_ref (T2 only), sha256, bounding dimensions and a scale rule (fixed, uniform or per-axis).

### Electrical (62)

*The Intake Gate runs on these rows first.*

**Service and distribution (20)**

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| E-01 | Pad-mount transformer | Rectangle with coil symbol on the site plan; PMT, XFMR, UTILITY XFMR | IfcTransformer (VOLTAGE) | OEM: ABB, Eaton (Cooper Power), Siemens |
| E-02 | Medium-voltage switchgear | Long rectangle with line-up sections; MVSWGR, MV SWGR, 15KV | IfcElectricDistributionBoard (SWITCHBOARD) | OEM: Eaton, Siemens, ABB, Schneider Electric |
| E-03 | Low-voltage switchgear | Rectangle with breaker cells; SWGR, LVSWGR, drawout | IfcElectricDistributionBoard (SWITCHBOARD) | OEM: Eaton, Square D (Schneider Electric), Siemens, ABB |
| E-04 | Main switchboard | Large rectangle; MSB, MDP, SWBD, MDB | IfcElectricDistributionBoard (SWITCHBOARD) | OEM: Eaton, Square D, Siemens, ABB |
| E-05 | Distribution panelboard | Rectangle with panel name; DP, DP-1, PNL | IfcElectricDistributionBoard (DISTRIBUTIONBOARD) | OEM: Square D, Eaton, Siemens |
| E-06 | Branch panelboard or load center | Filled rectangle with panel name; LP, LP-1, PP, RP, PNL | IfcElectricDistributionBoard (DISTRIBUTIONBOARD) | OEM: Square D, Eaton, Siemens |
| E-07 | Motor control center | Rectangle divided into buckets; MCC | IfcElectricDistributionBoard (MOTORCONTROLCENTRE) | OEM: Eaton, Square D, Siemens, ABB |
| E-08 | Busway segment | Double line with tap-off boxes; BD, BUSWAY, BUS DUCT | IfcCableSegment (BUSBARSEGMENT) | OEM: Eaton (Pow-R-Way), Siemens (Sentron), Schneider Electric (Canalis, I-Line) |
| E-09 | Dry-type transformer | Square with two coils; XFMR, T-1, TR | IfcTransformer (VOLTAGE) | OEM: Eaton, Square D, ABB, Hammond Power Solutions |
| E-10 | Meter and CT cabinet | Circle with M, or box with CT; M, MTR, CT CAB | IfcFlowMeter (ENERGYMETER) | OEM: Eaton, Milbank, Siemens |
| E-11 | Disconnect switch | Switch blade with fuse mark and rating such as 60A/3P; DS, DISC, SW | IfcSwitchingDevice (SWITCHDISCONNECTOR) | OEM: Eaton, Square D, Siemens |
| E-12 | Enclosed circuit breaker | Breaker symbol in a box with frame and trip such as 100AF/80AT; CB, MCCB | IfcProtectiveDevice (CIRCUITBREAKER) | OEM: Eaton, Square D, Siemens, ABB |
| E-13 | Automatic transfer switch | Box with ATS | IfcSwitchingDevice (SWITCHDISCONNECTOR) | OEM: ASCO, Eaton, Cummins, Generac |
| E-14 | Surge protective device | Box with SPD or TVSS | IfcProtectiveDevice (VARISTOR) | OEM: Eaton, Square D, Siemens |
| E-15 | Standby generator | Circle with G; GEN, EG | IfcElectricGenerator (ENGINEGENERATOR) | OEM: Cummins, Generac, Caterpillar, Kohler |
| E-16 | UPS | Box with UPS | IfcElectricFlowStorageDevice (UPS) | OEM: Eaton, Schneider Electric (APC), Vertiv |
| E-17 | Battery energy storage system | Box or enclosure with BESS, BAT | IfcElectricFlowStorageDevice (BATTERY) | OEM: Tesla, Fluence, Eaton. Confirm per SKU |
| E-18 | Solar PV inverter | Box with INV, PVI | IfcBuildingElementProxy (no native IFC4 class) | OEM: Enphase, SolarEdge, SMA |
| E-19 | VFD or motor starter | Box with VFD, MS, MCP | IfcSwitchingDevice (STARTER) | OEM: ABB, Danfoss, Eaton, Siemens |
| E-20 | EV charger | Box or pedestal on the site plan; EVSE, EV | IfcBuildingElementProxy (no native IFC4 class) | OEM: ChargePoint, ABB, Tesla (Wall Connector) |

**Raceway and cable management (9)**

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| E-21 | Cable tray segment | Double line along its path with width such as 12"; CT, CBL TRAY, LADDER, TROUGH | IfcCableCarrierSegment (CABLETRAYSEGMENT, CABLELADDERSEGMENT) | OEM: Eaton (B-Line), Legrand (Cablofil) |
| E-22 | Cable tray fitting | Elbow, tee, cross, reducer or riser at a change in the run | IfcCableCarrierFitting (BEND, TEE, CROSS, REDUCER) | OEM: Eaton (B-Line), Legrand (Cablofil) |
| E-23 | Wire basket tray | Narrow double line; WB, BASKET | IfcCableCarrierSegment (CABLETRAYSEGMENT) | OEM: Legrand (Cablofil), Eaton (B-Line) |
| E-24 | Wireway | Thin box line with size such as 4x4; WW, WIREWAY | IfcCableCarrierSegment (CABLETRUNKINGSEGMENT) | OEM: nVent (Hoffman), Eaton, Schneider Electric (Square D) |
| E-25 | Conduit riser or stub-up | Circle with arrow; UP, DN, STUB-UP, size such as 2"C | IfcCableCarrierSegment (CONDUITSEGMENT) | RVT, NBS; OEM: Atkore, Allied Tube (Atkore) |
| E-26 | Conduit body | Fitting at a turn; LB, LL, LR, T, C | IfcCableCarrierFitting (JUNCTION) | OEM: Crouse-Hinds (Eaton), Appleton (Emerson), ABB (Thomas & Betts) |
| E-27 | Junction or pull box | Square with J and size such as 12x12x6; J, JB, PB | IfcJunctionBox | OEM: nVent (Hoffman), Hubbell, ABB (Thomas & Betts) |
| E-28 | Handhole | Small square on the site plan; HH, PB | IfcJunctionBox | OEM: Hubbell (Quazite), Oldcastle Infrastructure |
| E-29 | Manhole or electrical vault | Circle or rectangle on the site plan; MH, EMH, VAULT | IfcBuildingElementProxy | OEM: Oldcastle Infrastructure, Hubbell (Quazite) |

**Grounding and bonding (4)**

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| E-30 | Ground rod | Ground symbol on a rod; GR, GND ROD, size such as 3/4" x 10' | IfcBuildingElementProxy (no native IFC4 class) | OEM: nVent (ERICO), Harger Lightning & Grounding |
| E-31 | Ground test well | Circle with G inside a square; GW, TW, GRD WELL | IfcBuildingElementProxy (no native IFC4 class) | OEM: nVent (ERICO), Hubbell (Quazite) |
| E-32 | Grounding bus bar | Thin rectangle with ground symbol; MGB, TMGB, TGB, GB | IfcBuildingElementProxy (no native IFC4 class) | OEM: Panduit, Chatsworth, nVent (ERICO) |
| E-33 | Air terminal | Vertical dash with circle on the roof plan; AT, LP, AIR TERM | IfcBuildingElementProxy (no native IFC4 class) | OEM: nVent (ERICO), Harger Lightning & Grounding |

**Wiring devices and controls (15)**

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| E-34 | Duplex receptacle | Circle with two parallel lines; R, DUP, REC, NEMA 5-20R | IfcOutlet (POWEROUTLET) | NBS, RVT; OEM: Leviton, Hubbell, Legrand |
| E-35 | GFCI receptacle | Duplex symbol with GFI or GFCI; WP for weatherproof | IfcOutlet (POWEROUTLET) | NBS, RVT; OEM: Leviton, Hubbell |
| E-36 | 240 V receptacle (range, dryer, welder) | Circle with three lines; 240V, 220V, NEMA 14-50 | IfcOutlet (POWEROUTLET) | NBS; OEM: Leviton, Hubbell |
| E-37 | Floor box | Rectangle or circle in the floor; FB, FLR BOX | IfcOutlet (POWEROUTLET) | OEM: Legrand (Wiremold), Hubbell |
| E-38 | Light switch (single-pole, 3-way, 4-way) | S with subscript 3 or 4; S, S3, S4 | IfcSwitchingDevice (TOGGLESWITCH) | NBS, RVT; OEM: Leviton, Lutron, Legrand |
| E-39 | Dimmer | S with a D subscript; SD, DIM | IfcSwitchingDevice (DIMMERSWITCH) | OEM: Lutron, Leviton |
| E-40 | Occupancy or vacancy sensor | Circle or wall box with OS; OS, OCC, VS | IfcSensor (MOVEMENTSENSOR) | OEM: Lutron, Acuity (nLight), Leviton |
| E-41 | Photocell or daylight sensor | Circle with PC; PC, PE, PHOTOCELL | IfcSensor (LIGHTSENSOR) | OEM: Intermatic, Tork, Acuity (nLight), Lutron |
| E-42 | Lighting control panel | Rectangle with LCP, RP | IfcUnitaryControlElement (CONTROLPANEL) | OEM: Lutron, Acuity (nLight), Eaton |
| E-43 | Emergency stop or pushbutton station | Circle with PB or ES; PB, ES, E-STOP | IfcSwitchingDevice (EMERGENCYSTOP) | OEM: Eaton, Siemens, ABB |
| E-44 | Data outlet | Triangle; D, DATA, RJ45 | IfcOutlet (DATAOUTLET) | OEM: Leviton, Panduit, Legrand |
| E-45 | Network rack or IDF/MDF cabinet | Rectangle; IDF, MDF, TR, RACK | IfcBuildingElementProxy | OEM: Chatsworth, Panduit, Schneider Electric (APC NetShelter) |
| E-46 | Wireless access point | Circle with signal arcs; WAP, AP | IfcCommunicationsAppliance (NETWORKAPPLIANCE) | OEM: Cisco, HPE Aruba, Ubiquiti. Confirm per SKU |
| E-47 | CCTV camera | Triangle or dome; CAM, CCTV | IfcAudioVisualAppliance (CAMERA) | OEM: Axis, Hanwha, Bosch |
| E-48 | Card reader | Small box; CR, RDR, AC | IfcSensor (IDENTIFIERSENSOR) | OEM: HID, Allegion, ASSA ABLOY |

**Lighting (9)**

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| E-49 | Recessed downlight | Circle with cross; DL, fixture-type letter such as A, B | IfcLightFixture (POINTSOURCE) | NBS; OEM: Lithonia (Acuity), Halo (Eaton), Signify |
| E-50 | Troffer (2x4 and 2x2) | Rectangle with diagonal or cross lines; 2X4, 2X2, fixture tag | IfcLightFixture | NBS; OEM: Lithonia, Metalux (Eaton), Signify |
| E-51 | Linear pendant or strip | Long thin rectangle; LIN, L1 | IfcLightFixture | OEM: Lithonia, Signify, Eaton |
| E-52 | Wall pack or sconce | Semicircle against a wall; WP, WS | IfcLightFixture | OEM: Lithonia, Eaton |
| E-53 | High-bay luminaire | Circle with filled quadrants; HB | IfcLightFixture | OEM: Lithonia, Eaton, Signify |
| E-54 | Pole luminaire | Circle on a pole with arm on the site plan; PL, POLE, SL | IfcLightFixture | OEM: Lithonia, Eaton, Signify, Hubbell |
| E-55 | Bollard | Circle with a filled quarter; BOL, BOLLARD | IfcLightFixture | OEM: Lithonia, Eaton, Signify |
| E-56 | Exit sign | Box with X or arrow; EXIT | IfcLightFixture (SECURITYLIGHTING) | OEM: Lithonia, Cooper (Sure-Lites) |
| E-57 | Emergency light unit | Twin shaded heads; EM, EL | IfcLightFixture (SECURITYLIGHTING) | OEM: Lithonia, Cooper (Sure-Lites) |

**Fire alarm (5)**

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| E-58 | Fire alarm control panel | Rectangle with FACP, FA, FCP | IfcUnitaryControlElement (ALARMPANEL) | OEM: Notifier (Honeywell), Siemens, Edwards |
| E-59 | Smoke detector | Circle with S; SD | IfcSensor (SMOKESENSOR) | OEM: System Sensor, Notifier, Siemens |
| E-60 | Heat detector | Circle with H; HD | IfcSensor (HEATSENSOR) | OEM: System Sensor, Notifier |
| E-61 | Manual pull station | Square with F; PS, MPS | IfcAlarm (MANUALPULLBOX) | OEM: System Sensor, Notifier |
| E-62 | Horn or strobe | Box or trapezoid; H/S, HS, S, NA | IfcAlarm (SIREN) | OEM: System Sensor, Wheelock (Eaton), Gentex |

### Architectural (14)

*These are the hosts and reference geometry that electrical devices attach to.*

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| A-01 | Single swing door | Quarter-circle swing arc in a wall opening; door tag D-101, 101A; DR | IfcDoor | NBS, RVT, BSM; OEM: Masonite, ASSA ABLOY, Allegion (hardware) |
| A-02 | Double swing door | Two opposing swing arcs; PR, DBL | IfcDoor | NBS, RVT, BSM; OEM: ASSA ABLOY |
| A-03 | Sliding, pocket or bi-fold door | Leaf beside the opening with arrow, dashed leaf in the wall, or zig-zag leaves; SLDG, PKT, BF | IfcDoor | NBS, RVT, BSM |
| A-04 | Overhead or rolling door | Dashed door outline above the opening; OHD, O.H., RSD, ROLL-UP | IfcDoor | OEM: Clopay, Overhead Door Company, Wayne Dalton (BO, BSM) |
| A-05 | Storefront or glazed entrance | Thin glazing lines with door swing; SF, STOREFRONT, ENT | IfcDoor | OEM: Kawneer, YKK AP (BO) |
| A-06 | Fixed window | Triple line in the wall; tag W-1, FX | IfcWindow | NBS, RVT, BSM |
| A-07 | Operable window | Triple line with sash marks; CSMT, DH, SL, AWN | IfcWindow | NBS, RVT; OEM: Andersen, Pella, Marvin |
| A-08 | Stair | Parallel treads; UP, DN, riser count such as 14 R | IfcStair | RVT, NBS. Parametric from run and rise |
| A-09 | Guardrail or handrail | Line with HR, GR, 42" GR | IfcRailing | RVT, NBS |
| A-10 | Elevator | Box with diagonal X; ELEV, EL-1 | IfcTransportElement (ELEVATOR) | RVT; OEM: KONE, Otis, Schindler |
| A-11 | Ceiling grid and tile | 2x2 or 2x4 grid hatch on the reflected ceiling plan; ACT | IfcCovering (CEILING) | NBS, RVT; OEM: Armstrong, USG |
| A-12 | Casework (base and wall cabinets) | Rectangles along a wall, dashed uppers; BC, WC, CAB | IfcFurniture | RVT, NBS, ARCAT |
| A-13 | Furniture (desk, table, chair) | Outlines on furniture plans; DESK, TBL, CH | IfcFurniture | KEN, QUA, PPZ; OEM: Steelcase, Herman Miller (BO) |
| A-14 | Kitchen and laundry appliances | Rectangles with R, REF, RNG, OVEN, DW, W, D, W/D | IfcElectricAppliance (REFRIGERATOR, ELECTRICCOOKER, DISHWASHER, WASHINGMACHINE, TUMBLEDRYER) | KEN, BSM, BO |

### Mechanical / HVAC (12)

*These are the equipment and air terminals that draw electrical power or sit on electrical circuits.*

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| M-01 | Air handling unit | Large rectangle; AHU, AHU-1, AC-1 | IfcUnitaryEquipment (AIRHANDLER) | OEM: Trane, Carrier, Daikin, Johnson Controls (York) |
| M-02 | Rooftop unit | Rectangle on the roof plan; RTU, RTU-1 | IfcUnitaryEquipment (ROOFTOPUNIT) | OEM: Trane, Carrier, Lennox, Daikin |
| M-03 | Fan coil or mini-split indoor unit | Small rectangle with coil lines; FCU, FC-1, IDU, MS | IfcUnitaryEquipment (AIRCONDITIONINGUNIT, SPLITSYSTEM) | OEM: Trane, Carrier, Daikin, Mitsubishi Electric |
| M-04 | VAV box | Rectangle in a duct run; VAV, VAV-1 | IfcAirTerminalBox | OEM: Titus, Price, Nailor, Trane |
| M-05 | Exhaust fan | Circle with blades; EF, EF-1 | IfcFan | OEM: Greenheck, Loren Cook |
| M-06 | Ceiling diffuser | Square with X and size/CFM tag such as 12x12 / 250; SD, SA, CD | IfcAirTerminal (DIFFUSER) | NBS; OEM: Titus, Price, Krueger |
| M-07 | Return or exhaust grille | Square or rectangle with a single diagonal; RG, EG, TG | IfcAirTerminal (GRILLE) | NBS; OEM: Titus, Price |
| M-08 | Fire or smoke damper | Duct with diagonal and label; FD, SD, FSD | IfcDamper (FIREDAMPER, SMOKEDAMPER, FIRESMOKEDAMPER) | OEM: Ruskin, Greenheck, Nailor |
| M-09 | Outdoor condensing or heat-pump unit | Square on the site or roof plan; CU, ODU, HP | IfcUnitaryEquipment (SPLITSYSTEM) | OEM: Trane, Carrier, Daikin |
| M-10 | Boiler | Rectangle or circle with flame mark; B, BLR, B-1 | IfcBoiler | OEM: Lochinvar, AERCO, Cleaver-Brooks, Burnham |
| M-11 | Chiller | Rectangle with CH, CH-1 | IfcChiller | OEM: Trane, Carrier, Johnson Controls (York), Daikin |
| M-12 | Pump | Circle with a flow arrow; P, P-1, CHWP, HWP | IfcPump | OEM: Grundfos, Bell & Gossett (Xylem), Armstrong Fluid Technology, Taco |

### Plumbing and fire protection (12)

*These are chosen for their electrical loads and monitored points, such as the water heater, the fire pump and the flow switch.*

| ID | Component | Drawing symbols and abbreviations | IFC4 class | Sources |
|----|-----------|-----------------------------------|------------|---------|
| P-01 | Water closet | Oval bowl with tank; WC, WC-1 | IfcSanitaryTerminal (TOILETPAN) | NBS, RVT; OEM: Kohler, American Standard, TOTO |
| P-02 | Lavatory or sink | Oval basin or rectangle with one or two bowls; LAV, L-1, SK, S-1 | IfcSanitaryTerminal (WASHHANDBASIN, SINK) | NBS, RVT; OEM: Kohler, American Standard, Elkay |
| P-03 | Floor drain | Circle with square or X; FD | IfcWasteTerminal (FLOORTRAP) | OEM: Zurn, Watts, Jay R. Smith, Sioux Chief |
| P-04 | Storage water heater | Circle with WH; WH, WH-1 | IfcBoiler (WATER) | OEM: A. O. Smith, Rheem, Bradford White |
| P-05 | Backflow preventer | Valve symbol with RPZ or DCVA; BFP | IfcValve (CHECK) | OEM: Watts, Zurn Wilkins, Febco |
| P-06 | Isolation, check or pressure-reducing valve | Bow-tie (gate), filled bow-tie (ball), check arrow, PRV; GV, BV, CV, PRV | IfcValve (ISOLATING, CHECK, PRESSUREREDUCING) | OEM: NIBCO, Apollo (Conbraco), Victaulic, Watts |
| FP-01 | Sprinkler head | Small circle with cross; SP, PEND, UPRT, SW (sidewall) | IfcFireSuppressionTerminal (SPRINKLER) | OEM: Viking, Tyco (Johnson Controls), Reliable, Victaulic |
| FP-02 | Riser or alarm check valve assembly | Vertical pipe with valve symbols; FR, RISER, ACV | IfcValve (CHECK) | OEM: Viking, Tyco, Victaulic |
| FP-03 | Fire pump | Circle with FP; FP, FP-1 | IfcPump | OEM: Patterson, Aurora (Pentair), Armstrong, Clarke |
| FP-04 | Fire hydrant | Circle with cross and arms on the site plan; FH, HYD | IfcFireSuppressionTerminal (FIREHYDRANT) | OEM: Mueller, American AVK, Clow |
| FP-05 | Fire extinguisher or cabinet | Triangle or rectangle; FE, FEC | IfcFireSuppressionTerminal (FIREEXTINGUISHER) | OEM: JL Industries, Larsen's, Potter Roemer |
| FP-06 | Flow or tamper switch | Small box on a sprinkler pipe labelled FS, TS | IfcSensor (FLOWSENSOR) | OEM: System Sensor, Potter Electric Signal |

---

## 2. Asset record schema

Every detected asset gets one record, the "passport", built from eight field groups. A record is immutable in its evidence and history and mutable only through status transitions and new versions. Types: string, number, bool, enum, ref (id of another record), [] (array), {} (object). Fields marked req must be present; everything else may be null, but a null must carry a reason code in nulls.

### 2.1 Fields

**Identity**

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| asset_id | string (ULID) | req | Stable across versions. |
| version | number | req | Starts at 1. A change to a Finalized record creates a new version, never an edit. |
| schema_version | string | req | Semantic version of this schema. |
| project_id, twin_id | string | req | Twin is the model build the record belongs to. |
| tag | string | | Tag as drawn, such as AHU-1 or LP-2. Null if none is legible. |
| type_id | string | | Taxonomy id from Deliverable 1, such as E-06. Null when UNRESOLVED. |
| ifc_class, ifc_predefined_type | string | | Copied from the taxonomy row. |
| discipline | enum | req | ARC, ELE, MEC, PLB, FPR. |
| canonical_asset_id | ref | | Set when the same physical object is detected in more than one discipline (for example an AHU on mechanical and electrical sheets). All duplicates point to one canonical record. |

**Evidence** (evidence[], at least one item, append-only)

| Field | Type | Notes |
|-------|------|-------|
| evidence_id | string | |
| source_file_id | string | SHA-256 of the source PDF. |
| sheet_number, sheet_title, revision | string | As printed in the title block. |
| page_index | number | Zero-based page in the PDF. |
| bbox_page | [x0, y0, x1, y1] | PDF points, origin at the page's lower-left. |
| crop_ref | string | Stored image crop of the detection, used by reviewers. |
| extraction_method | enum | vector, raster, hybrid. |
| detector | {} | Name, version, class label, detection_confidence (0 to 1). |
| ocr_text | string | Raw text near the symbol, with OCR confidence. |
| schedule_ref | {} | Sheet, table and row if matched to a schedule (for example a panel or equipment schedule). |
| legend_ref | {} | Legend entry that defined the symbol, if any. |
| evidence_kind | enum | symbol, tag, schedule, legend, dimension, note, human. |

**Spatial**

| Field | Type | Notes |
|-------|------|-------|
| frame_id | string | The twin's coordinate frame (metres, Z-up). |
| position | {x, y, z} | Canonical metres. Z defaults to null/UNRESOLVED even with known XY; keep nulls.reason. Source-observed Z, review-only Z candidates, and human-confirmed position are separate provenance, not silently coalesced. |
| rotation | {yaw_deg, quat} | Canonical right-handed Z-up; yaw_deg about +Z, quaternion component ordering (x,y,z,w), recorded source frame; apply the glTF Y-up conversion once at the loader/viewer boundary, never twice. |
| bounds | {min, max} | Axis-aligned box in metres. |
| level_id, level_elevation_m | string, number | |
| room_id | string | Room or space number if resolvable. |
| host_id | ref | Wall, ceiling or slab the asset is mounted on. |
| mount_height_m | number | Only from a schedule, note or dimension, never assumed. |
| position_source | enum | dimensioned, drawn, derived, scaled_from_sheet, human. A source label describes evidence, not automatically applied authority. `derived` requires explicit source plane/datum/reference point, equations, witnesses and physicalTruth:false/reviewRequired:true until human confirmation. |
| sheet_transform_id | ref | Nullable until an explicitly APPLIED transform. Each proposal records frame, manual XY correspondence pairs, independent printed-dimension/scale witnesses, residual_mm, proposed_by, reviewer, evidence and immutable application event; PROPOSED → HUMAN_CONFIRMED → APPLIED are distinct human-governed actions. No auto-apply; a missing transform does not invalidate separately corroborated native metric coordinates. |
| position_confidence | number | 0 to 1. |

**Resolution**

| Field | Type | Notes |
|-------|------|-------|
| resolution_state | enum | RESOLVED, FALLBACK, UNRESOLVED. FALLBACK means a generic stand-in model of the correct class, also used when an OEM model has no written permission on record. |
| model_ref | {} | library_id, component_id, glb_uri, glb_sha256, licence_tier, lod. Null unless RESOLVED or FALLBACK. |
| resolution_confidence | number | 0 to 1. |
| candidates[] | [] | Top-k library matches with score and the signals behind each. |
| resolution_method | enum | rule, embedding, schedule, human. |
| resolver_version | string | |

**Properties** (properties{}, each value is its own object)

Each property is { value, unit, source_evidence_id, confidence, state }, where state is stated (read from a drawing or schedule) or predicted (model output). Electrical keys come first: voltage, phase, amps, kva, bus_rating_a, breaker_frame_a, breaker_trip_a, short_circuit_rating_kaic, panel_id, circuit_number, wire_size, conduit_size, tray_width_in, ground_resistance_ohm, lumens, wattage, control_zone. General keys: manufacturer, model, cfm, gpm, capacity, mca, mocp, fire_rating. A predicted property can never be shown without its predicted flag.

**Relations** (relations[])

Each is { type, target_asset_id, evidence_id }. Electrical relations come first: fed_from, feeds, protected_by, bonded_to, grounded_by. Others: serves, served_by, hosted_by, same_physical_object, clashes_with, controls, part_of. Circuit and panel references from schedules live here, not in properties. The fed_from chain must be acyclic and end at a utility source or a generator; a break in the chain is itself a review item.

**Trust and lifecycle**

| Field | Type | Notes |
|-------|------|-------|
| status | enum | UNRESOLVED, INFERRED_PREDICTED, VERIFIED, APPROVED, FINALIZED, LIVE, REJECTED. |
| confidence | {} | overall plus the factors: detection, classification, tag, location, resolution, cross_discipline. overall is the minimum of the factors, not the average. |
| nulls{} | {} | Field name to reason code, for every null in the record. |
| supersedes, superseded_by | ref | Version chain. |
| release_id | string | Set at FINALIZED. |

**Passport** (passport{}, filled only as the lifecycle advances)

serial_number, installed_on, commissioned_on, commissioned_by, warranty_expires_on, documents[] (submittals, O&M manuals, test reports), maintenance_ref, telemetry_ref. Required at LIVE, absent before.

**Audit** (events[], append-only, hash-chained)

Each event is { event_id, at, actor {type: human | agent | system, id, role, agent_version}, from_status, to_status, evidence_ids[], note, prev_hash, hash }. The hash chain makes tampering detectable.

### 2.1A Approved positioning, authority, and provenance clarification (October 10)

**P1 — Missing Z/scale are unresolved by default.** A source observation without a defensible datum/AFF note/grade/floor label/section has canonical Z null, reason Z_NOT_STATED; printed scale or X/Y alone never generates a height. Independent corroboration of metric X/Y uses manual pairs and printed dimensions/graphic-scale witnesses; proposed transforms never auto-apply. Existing corroborated native metric XY remains available when an unrelated sheet transform is missing.

**P3 before P2 — Sheet transform lifecycle.** PROPOSED is a candidate only; HUMAN_CONFIRMED captures named reviewer, same-floor/discipline matching, original source points, metric witness pairs, residual_mm and source frames; APPLIED requires its own explicit human action and append-only application receipt. Disallow any use of unconfirmed proposals for physical measurements, exports, or canonical XY alignment.

**P2 — Z provenance tiers.** Keep three disjoint records: `source_z_observation` (datum/control label, sheet/hash/page/bbox, datum value, unit, reference point), `derived_z_candidate` (named source controls, triangulation/barycentric interpolation within verified control envelope, host-contact conversion, equations, confidence, physicalTruth:false, reviewRequired:true), and `human_confirmed_position` (reviewer, evidentiary references, applied transform ID if used, audit event). Only defensible source evidence produces a candidate; no default story spacing, no generic OEM-model mounting height as evidence, no hidden persistence of UI-only offsets. Derived source candidate is **not** physical truth and does not automatically populate canonical Z.

**P4 — Human-only lifecycle promotion.** VERIFIED, APPROVED, FINALIZED and LIVE require authenticated authorized humans; verification and approval by different people; all actions append-only with actor identity, role, UTC time, evidence and prior event hash. Field/telemetry integrations may propose LIVE and attach commissioning evidence, never execute a LIVE transition.

**P5 — Binding and visualization.** Class identity, geometry availability, and status remain separate. RESOLVED-but-unverified displays licensed 3D model labeled UNVERIFIED; FALLBACK requires all three locked thresholds and an Intake-Gate-approved generic model of the **exact** type_id; unavailable or failed OEM model candidates are never substituted as asset geometry. Unknown or unsupported class remains visible as a ghost/sheet pin. No unverified rendering confers measurement/takeoff/export authority.

**B6 — Electrical relations ownership.** Circuit and terminal IDs must be evidence-linked on `relations[]` with panel/feeder circuit identifiers and source evidence, not silently duplicated or inferred from a free-text `properties{}` field. Conflicts are review items; fed_from chains must not silently form cycles.

**B7 — Axis/placement contract.** Canonical project frame is metres, right-handed Z-up. glTF geometry is Y-up and converted exactly once into that frame. A model's authored host-contact origin/anchor and `mount_face` (if applicable) must be validated during Intake. Yaw rotates around +Z and quaternions have explicitly defined order and reference frame. A license-verified model is not proof of real-world size, location, or physical installation.

**B8 — Deferred SOP detail without blocking this cycle.** A00 may proceed only on expressly authorized reversible, low-risk slices. An unacknowledged grill-me question remains OPEN/ESCALATED, must not be inferred as consent, and stops dependent code or irreversible actions. A03 logs pending owner/ETA and carries it into the next human handoff. No timeout creates authority.

### 2.2 Status lifecycle

An agent may write only the first two statuses. Every later status requires a named human with the right role, and the approver must be a different person from the verifier. No rule or automation may write VERIFIED, including a deterministic triple match of symbol, tag and schedule row: that result is written as INFERRED_PREDICTED and goes to human review like any other.

| Status | Meaning | Entered by | Requires | Can move to |
|--------|---------|------------|----------|-------------|
| UNRESOLVED | The system could not resolve this asset with evidence. No model, no asserted properties. | Agent | Reason codes (2.3) and a review task | INFERRED_PREDICTED (human picks a match), VERIFIED (human resolves directly), REJECTED |
| INFERRED_PREDICTED | Machine result backed by evidence above threshold, or a predicted asset or property (for example an asset implied by a schedule but not drawn). Unreviewed. | Agent | At least one evidence item; resolution confidence at or above the threshold in 2.4 | VERIFIED, UNRESOLVED (reviewer cannot confirm), REJECTED |
| VERIFIED | A named human checked identity and location against the source drawing. | Human reviewer | Reviewer id, evidence ids viewed, optional correction | APPROVED, UNRESOLVED, REJECTED |
| APPROVED | An authorised second person accepts the asset as design intent for the project. | Human approver (role: engineer, project manager or discipline lead) | Approver is not the verifier | FINALIZED, VERIFIED (approval withdrawn) |
| FINALIZED | Frozen into a published model release. Immutable. | Human release manager | release_id; every required field present; zero open review tasks on the asset | LIVE, or a new version at VERIFIED after a change |
| LIVE | Linked to a real installed, commissioned instance. | **Authorized authenticated human only**; integrations submit evidence and proposals, never transitions | Human actor/role, passport fields, reviewed field/commissioning evidence, append-only actor event | A new version at VERIFIED after replacement or modification |
| REJECTED | False positive or duplicate. Kept for detector training, hidden from the twin. | Human reviewer | Reason code | Terminal |

**Rendering rule (approved October 10).** The viewer distinguishes authority from renderability. RESOLVED with lifecycle no higher than INFERRED_PREDICTED displays the approved class-specific 3D library geometry labeled **UNVERIFIED** both in viewport and inspector. FALLBACK displays a licensed Intake-Gate-approved generic class model, visibly labeled **FALLBACK · UNVERIFIED**, and never a failed/unlicensed OEM candidate. UNRESOLVED with a defensible class-matched generic model may show it as a non-authoritative translucent ghost, never as a resolved asset; without a model, use a ghost_marker at known XY or a source-sheet pin where XY is unknown. Every unverified, unresolved, fallback or review-only geometry is excluded from takeoffs, measurements, authoritative exports and compliance assertions until applicable human approval and scale/coordinate evidence. An unavailable model never makes the detected asset invisible.

### 2.3 What an UNRESOLVED record carries

An UNRESOLVED record states what was seen, why it stopped, and what would unblock it. It never carries a selected model_ref, guessed tag or asserted properties; a separate display-only class-matched generic review ghost may be shown but is not a resolved model binding or canonical placement.

| Field | Notes |
|-------|-------|
| evidence[] | The detection crop, bounding box, OCR text and sheet reference. At least one item. |
| detection | What the detector saw: class label and confidence. This is an observation, not a classification. |
| reason_codes[] | One or more of: NO_LIBRARY_MATCH, LOW_CLASSIFICATION_MARGIN, SYMBOL_NOT_IN_LEGEND, TAG_UNREADABLE, TAG_SYMBOL_CONFLICT, SCALE_UNKNOWN, SCALE_CONFLICT, LOCATION_AMBIGUOUS, SCHEDULE_MISSING, SCHEDULE_AMBIGUOUS, CROSS_DISCIPLINE_CONFLICT, SHEET_ILLEGIBLE, OCCLUDED_BY_ANNOTATION, DUPLICATE_SUSPECT, OUT_OF_SCOPE_SYMBOL. |
| candidates[] | Closest library matches with scores, each flagged selected: false. Shown to the reviewer as hints only. |
| missing_inputs[] | What would resolve it, such as the legend sheet, the equipment schedule, a scale bar or a higher-resolution scan. |
| location_state | known, approximate or unknown. If known or approximate, position is set with its confidence; otherwise null. |
| placeholder | Viewer geometry: ghost_marker at the position, or sheet_pin (a pin on the source sheet only) when location is unknown. |
| review_task | task_id, queue, priority, assigned_to, created_at, due_at. |
| attempts[] | Each resolver run: version, timestamp, outcome and which signals were tried. |

### 2.4 Resolution rules (starting values)

Resolve to INFERRED_PREDICTED only when all three hold. Otherwise write UNRESOLVED.
1. Top candidate score is at least 0.85.
2. The margin over the second candidate is at least 0.15.
3. At least two independent evidence kinds agree, for example symbol plus tag, or symbol plus schedule row.

**FALLBACK is not a threshold waiver.** A fallback is permitted only when **all three** rules above hold (score ≥0.85, margin ≥0.15, two independent evidence kinds) **and** the generic model passes the seven-check Intake Gate with CC0/in-house licensing or documented OEM written permission, is of the same specific `type_id` (not merely a broad IFC family), and has immutable registry provenance. Mark resolution_state FALLBACK and viewport/inspector FALLBACK · UNVERIFIED; never present unauthorized/failed OEM geometry as installed equipment. If no qualified generic class model exists, remain UNRESOLVED with a review task. Machine-written status is at most INFERRED_PREDICTED. Thresholds are calibrated on 20–30 hand-labelled real sheets; changes need a logged decision.

### 2.5 Example: UNRESOLVED record

```json
{
  "asset_id": "01K9ZQ4T8M2X7N5V3B6C1D0EFG",
  "version": 1,
  "schema_version": "1.0.0",
  "project_id": "prj_demo",
  "twin_id": "twn_demo_01",
  "discipline": "ELE",
  "tag": null,
  "type_id": null,
  "status": "UNRESOLVED",
  "resolution_state": "UNRESOLVED",
  "model_ref": null,
  "evidence": [{
    "evidence_id": "ev_001",
    "source_file_id": "sha256:9f2c...",
    "sheet_number": "E-201",
    "revision": "C",
    "page_index": 14,
    "bbox_page": [412.6, 233.1, 431.9, 252.4],
    "extraction_method": "vector",
    "detector": {"name": "sym-det", "version": "0.4", "class": "circle_with_letter", "detection_confidence": 0.91},
    "ocr_text": "?",
    "evidence_kind": "symbol"
  }],
  "reason_codes": ["SYMBOL_NOT_IN_LEGEND", "LOW_CLASSIFICATION_MARGIN"],
  "candidates": [
    {"type_id": "E-59", "score": 0.61, "selected": false},
    {"type_id": "E-60", "score": 0.55, "selected": false}
  ],
  "missing_inputs": ["legend sheet for E-series"],
  "location_state": "approximate",
  "position": {"x": 18.42, "y": 7.15, "z": null},
  "placeholder": "ghost_marker",
  "review_task": {"task_id": "rt_0192", "queue": "ele-symbols", "priority": "normal"},
  "nulls": {"tag": "TAG_UNREADABLE", "position.z": "MOUNT_HEIGHT_NOT_STATED"}
}
```

---

## 3. Memory architecture for the ops team

The ops team's memory is a three-layer vault of plain files: raw/ holds what came in, wiki/ holds what the team knows, output/ holds what the team produced. Information moves in one direction only, raw to wiki to output, so any statement in a deliverable can be traced back to a source file.

### 3.1 Vault layout

```
vault/
  raw/                          # write-once inputs, never edited
    inbox/                      # unsorted drops, triaged within 24h
    drawings/<project>/<set>-rev<X>/   # PDF sets, one folder per issued revision
    specs/  schedules/  rfis/  meetings/  vendor/  vendor/permissions/  field/
    _manifest.jsonl             # one line per file: path, sha256, source, received_at
  wiki/                         # processed, structured, cited
    index.md                    # map of the vault
    projects/<project>/         # overview.md, sheet-index.md, discipline-<x>.md
    library/                    # taxonomy mirror, sourcing-log.md, intake-results.md, licence-register.md
    symbols/                    # legend-to-symbol mappings per project
    decisions/                  # one file per decision: YYYY-MM-DD-<slug>.md
    glossary.md
    agents/                     # role cards: what each agent owns and may write
    runbooks/                   # how-to pages, SOPs
    open-questions.md
    _proposals/                 # edits to pages you do not own
  output/                       # deliverables, built from wiki only
    plans/                      # grill-me results: YYYY-MM-DD-<slug>.md
    specs/  reports/  releases/
    handoffs/                   # handoff files, plus LATEST.md per thread
```

### 3.2 Conventions

| Rule | Detail |
|------|--------|
| raw/ is write-once | Files are added, never edited or deleted. A corrected input is a new file with a new revision folder. Every file is listed in _manifest.jsonl. |
| Every wiki page cites raw | Frontmatter carries sources: [raw/...]. A claim with no source goes under a ## Unsourced heading, never in the body. |
| Wiki frontmatter | title, owner (agent id), status (draft, reviewed, stable), updated (ISO date), sources, confidence (stated or inferred). |
| Same trust vocabulary | Facts tagged [stated] come from a source file. Facts tagged [inferred] are the team's conclusions and must say so. This mirrors the doctrine: AI never equals authority. |
| Conflicts are kept | If two sources disagree, add a ## Conflicts section naming both. Never overwrite one with the other. |
| One writer per page | The owner agent edits the page. Everyone else drops a proposal in wiki/_proposals/<page>-<agent>.md, and the owner merges or rejects it. This prevents 32 agents overwriting each other. |
| Naming | kebab-case; ISO date prefix (2026-10-09-) for anything time-ordered; one topic per file; links as [[page-name]]. |
| output/ is derived | Every output file lists built_from: [wiki/...] in its frontmatter. |
| Lint pass | Run at each checkpoint: broken links, pages with no sources, pages not updated in 48 hours with open status, orphan files. |

**Ingest flow.** A file lands in raw/inbox/; the intake agent moves it to its folder, logs it in _manifest.jsonl, writes or updates the wiki page it affects, and links the two. Anything it cannot place stays in inbox/ and is listed in wiki/open-questions.md.

### 3.3 SOP: grill-me

**Purpose.** Interrogate a plan until it is crystal clear before any building starts.

**Trigger.** Any build task longer than two hours, any task that creates or changes a schema, interface or agent role, and any task a requester cannot state in two sentences.

**Time box.** At most 15 minutes and 10 questions per session. If it is still unclear after that, mark the plan BLOCKED and escalate to Ali.

**Steps.**
1. Restate the goal in one sentence and read it back to the requester.
2. Search before asking. Answer from wiki/ and the existing files whatever they can answer. Only ask what they cannot.
3. Ask one question at a time, most blocking first. Each question comes with a recommended answer, so the requester can reply "yes".
4. Cover these areas (skip none; write "n/a" with a reason): scope and out-of-scope; inputs and where they live; outputs and where they go; acceptance tests; constraints (time, licence, tooling); dependencies on other agents; failure modes; doctrine fit (what becomes UNRESOLVED, what trust state each output carries); owner; rollback.
5. Log every answer in wiki/decisions/ as it is given.
6. Check the stop condition. The plan is clear only when all of these are true: acceptance tests are written as pass or fail checks; inputs, outputs and owner are named; the out-of-scope list exists; each risk has a mitigation; no blocking question is open.
7. Write the plan to output/plans/YYYY-MM-DD-<slug>.md with status: READY or status: BLOCKED. The requester signs off by replying "go" in the thread.

**Rule.** No agent starts building against a plan that is not READY.

**Anti-patterns.** Asking several questions at once; asking what the vault already answers; accepting "as needed" or "standard" as an answer; ending without written acceptance tests.

### 3.4 SOP: handoff

**Purpose.** Summarise context into a file on every handoff, so nothing is lost between agents or sessions.

**Trigger.** An agent finishes or pauses a task; a session ends; work passes to another agent; a sub-agent is spawned; every 4 hours of continuous work as a checkpoint.

**Rules.**
1. The sender writes the handoff before the handover, never after.
2. File path: output/handoffs/YYYY-MM-DD-HHMM-<from>-to-<to>-<slug>.md, and output/handoffs/LATEST.md is updated to point to it for that task thread.
3. One page at most. Every claim names a file path or a decision id.
4. State what is verified and what is inferred. Never blur them.
5. The receiver's first action is to add an ack: line with its id and the time. A handoff without an ack is treated as not received.
6. Handoffs are never deleted. Durable facts in a handoff are promoted into wiki/ by the receiver.

**Template.**
```
---
from: <agent id>
to: <agent id or "next session">
task: <task id>
at: <ISO timestamp>
status: done | in-progress | blocked
plan: output/plans/<file>.md
ack:
---

## Goal
One sentence.

## State
What is finished, what is partly done, what has not started.

## Artefacts
- path: what it is, and whether it passed its acceptance test

## Decisions made
- decision id: one line, and why

## Open questions and blockers
- question: who can answer it

## Unresolved items
Count and queue pointer for anything marked UNRESOLVED.

## Next steps
1. The very first action the receiver should take.
2. ...

## Gotchas
Assumptions made, traps found, things that look done but are not.

## Verified vs inferred
- Verified: ...
- Inferred: ...
```

### 3.5 Demo and evidence separation (October 10)

Synthetic demos use immutable provenance_class DEMO, reserved demo_ identifiers, fictional demo: source references and `system:demo-seed` only. Neither agents nor a human may promote demo evidence, save it to real tenant projects, export/measure/count it, or train/calibrate detectors from demo assets. DEMO records remain UNRESOLVED or INFERRED_PREDICTED, and no demo content is treated as a wiki fact. Demo facilities compile only for verified previews, never production. A demo may be viewed without sign-in, but never writes to production stores. This operational section is downstream of the lifecycle and transform contracts, not a new source of verification authority.
