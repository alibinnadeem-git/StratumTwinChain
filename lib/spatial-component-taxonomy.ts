/**
 * A10 P0-03: Source-faithful class catalogue extracted from the finalized Oct 9 specification.
 * Registry CANDIDATES only: IFC mappings require buildingSMART review and sources do NOT
 * establish licences or the existence of downloadable geometry.
 * Do not activate or auto-resolve models from this list alone.
 */
export const SPATIAL_COMPONENT_TAXONOMY=[
  {
    "id": "E-01",
    "discipline": "ELE",
    "name": "Pad-mount transformer",
    "drawingCues": "Rectangle with coil symbol on the site plan; PMT, XFMR, UTILITY XFMR",
    "ifcCandidate": "IfcTransformer (VOLTAGE)",
    "sourceCandidates": "OEM: ABB, Eaton (Cooper Power), Siemens"
  },
  {
    "id": "E-02",
    "discipline": "ELE",
    "name": "Medium-voltage switchgear",
    "drawingCues": "Long rectangle with line-up sections; MVSWGR, MV SWGR, 15KV",
    "ifcCandidate": "IfcElectricDistributionBoard (SWITCHBOARD)",
    "sourceCandidates": "OEM: Eaton, Siemens, ABB, Schneider Electric"
  },
  {
    "id": "E-03",
    "discipline": "ELE",
    "name": "Low-voltage switchgear",
    "drawingCues": "Rectangle with breaker cells; SWGR, LVSWGR, drawout",
    "ifcCandidate": "IfcElectricDistributionBoard (SWITCHBOARD)",
    "sourceCandidates": "OEM: Eaton, Square D (Schneider Electric), Siemens, ABB"
  },
  {
    "id": "E-04",
    "discipline": "ELE",
    "name": "Main switchboard",
    "drawingCues": "Large rectangle; MSB, MDP, SWBD, MDB",
    "ifcCandidate": "IfcElectricDistributionBoard (SWITCHBOARD)",
    "sourceCandidates": "OEM: Eaton, Square D, Siemens, ABB"
  },
  {
    "id": "E-05",
    "discipline": "ELE",
    "name": "Distribution panelboard",
    "drawingCues": "Rectangle with panel name; DP, DP-1, PNL",
    "ifcCandidate": "IfcElectricDistributionBoard (DISTRIBUTIONBOARD)",
    "sourceCandidates": "OEM: Square D, Eaton, Siemens"
  },
  {
    "id": "E-06",
    "discipline": "ELE",
    "name": "Branch panelboard or load center",
    "drawingCues": "Filled rectangle with panel name; LP, LP-1, PP, RP, PNL",
    "ifcCandidate": "IfcElectricDistributionBoard (DISTRIBUTIONBOARD)",
    "sourceCandidates": "OEM: Square D, Eaton, Siemens"
  },
  {
    "id": "E-07",
    "discipline": "ELE",
    "name": "Motor control center",
    "drawingCues": "Rectangle divided into buckets; MCC",
    "ifcCandidate": "IfcElectricDistributionBoard (MOTORCONTROLCENTRE)",
    "sourceCandidates": "OEM: Eaton, Square D, Siemens, ABB"
  },
  {
    "id": "E-08",
    "discipline": "ELE",
    "name": "Busway segment",
    "drawingCues": "Double line with tap-off boxes; BD, BUSWAY, BUS DUCT",
    "ifcCandidate": "IfcCableSegment (BUSBARSEGMENT)",
    "sourceCandidates": "OEM: Eaton (Pow-R-Way), Siemens (Sentron), Schneider Electric (Canalis, I-Line)"
  },
  {
    "id": "E-09",
    "discipline": "ELE",
    "name": "Dry-type transformer",
    "drawingCues": "Square with two coils; XFMR, T-1, TR",
    "ifcCandidate": "IfcTransformer (VOLTAGE)",
    "sourceCandidates": "OEM: Eaton, Square D, ABB, Hammond Power Solutions"
  },
  {
    "id": "E-10",
    "discipline": "ELE",
    "name": "Meter and CT cabinet",
    "drawingCues": "Circle with M, or box with CT; M, MTR, CT CAB",
    "ifcCandidate": "IfcFlowMeter (ENERGYMETER)",
    "sourceCandidates": "OEM: Eaton, Milbank, Siemens"
  },
  {
    "id": "E-11",
    "discipline": "ELE",
    "name": "Disconnect switch",
    "drawingCues": "Switch blade with fuse mark and rating such as 60A/3P; DS, DISC, SW",
    "ifcCandidate": "IfcSwitchingDevice (SWITCHDISCONNECTOR)",
    "sourceCandidates": "OEM: Eaton, Square D, Siemens"
  },
  {
    "id": "E-12",
    "discipline": "ELE",
    "name": "Enclosed circuit breaker",
    "drawingCues": "Breaker symbol in a box with frame and trip such as 100AF/80AT; CB, MCCB",
    "ifcCandidate": "IfcProtectiveDevice (CIRCUITBREAKER)",
    "sourceCandidates": "OEM: Eaton, Square D, Siemens, ABB"
  },
  {
    "id": "E-13",
    "discipline": "ELE",
    "name": "Automatic transfer switch",
    "drawingCues": "Box with ATS",
    "ifcCandidate": "IfcSwitchingDevice (SWITCHDISCONNECTOR)",
    "sourceCandidates": "OEM: ASCO, Eaton, Cummins, Generac"
  },
  {
    "id": "E-14",
    "discipline": "ELE",
    "name": "Surge protective device",
    "drawingCues": "Box with SPD or TVSS",
    "ifcCandidate": "IfcProtectiveDevice (VARISTOR)",
    "sourceCandidates": "OEM: Eaton, Square D, Siemens"
  },
  {
    "id": "E-15",
    "discipline": "ELE",
    "name": "Standby generator",
    "drawingCues": "Circle with G; GEN, EG",
    "ifcCandidate": "IfcElectricGenerator (ENGINEGENERATOR)",
    "sourceCandidates": "OEM: Cummins, Generac, Caterpillar, Kohler"
  },
  {
    "id": "E-16",
    "discipline": "ELE",
    "name": "UPS",
    "drawingCues": "Box with UPS",
    "ifcCandidate": "IfcElectricFlowStorageDevice (UPS)",
    "sourceCandidates": "OEM: Eaton, Schneider Electric (APC), Vertiv"
  },
  {
    "id": "E-17",
    "discipline": "ELE",
    "name": "Battery energy storage system",
    "drawingCues": "Box or enclosure with BESS, BAT",
    "ifcCandidate": "IfcElectricFlowStorageDevice (BATTERY)",
    "sourceCandidates": "OEM: Tesla, Fluence, Eaton. Confirm per SKU"
  },
  {
    "id": "E-18",
    "discipline": "ELE",
    "name": "Solar PV inverter",
    "drawingCues": "Box with INV, PVI",
    "ifcCandidate": "IfcBuildingElementProxy (no native IFC4 class)",
    "sourceCandidates": "OEM: Enphase, SolarEdge, SMA"
  },
  {
    "id": "E-19",
    "discipline": "ELE",
    "name": "VFD or motor starter",
    "drawingCues": "Box with VFD, MS, MCP",
    "ifcCandidate": "IfcSwitchingDevice (STARTER)",
    "sourceCandidates": "OEM: ABB, Danfoss, Eaton, Siemens"
  },
  {
    "id": "E-20",
    "discipline": "ELE",
    "name": "EV charger",
    "drawingCues": "Box or pedestal on the site plan; EVSE, EV",
    "ifcCandidate": "IfcBuildingElementProxy (no native IFC4 class)",
    "sourceCandidates": "OEM: ChargePoint, ABB, Tesla (Wall Connector)"
  },
  {
    "id": "E-21",
    "discipline": "ELE",
    "name": "Cable tray segment",
    "drawingCues": "Double line along its path with width such as 12\"; CT, CBL TRAY, LADDER, TROUGH",
    "ifcCandidate": "IfcCableCarrierSegment (CABLETRAYSEGMENT, CABLELADDERSEGMENT)",
    "sourceCandidates": "OEM: Eaton (B-Line), Legrand (Cablofil)"
  },
  {
    "id": "E-22",
    "discipline": "ELE",
    "name": "Cable tray fitting",
    "drawingCues": "Elbow, tee, cross, reducer or riser at a change in the run",
    "ifcCandidate": "IfcCableCarrierFitting (BEND, TEE, CROSS, REDUCER)",
    "sourceCandidates": "OEM: Eaton (B-Line), Legrand (Cablofil)"
  },
  {
    "id": "E-23",
    "discipline": "ELE",
    "name": "Wire basket tray",
    "drawingCues": "Narrow double line; WB, BASKET",
    "ifcCandidate": "IfcCableCarrierSegment (CABLETRAYSEGMENT)",
    "sourceCandidates": "OEM: Legrand (Cablofil), Eaton (B-Line)"
  },
  {
    "id": "E-24",
    "discipline": "ELE",
    "name": "Wireway",
    "drawingCues": "Thin box line with size such as 4x4; WW, WIREWAY",
    "ifcCandidate": "IfcCableCarrierSegment (CABLETRUNKINGSEGMENT)",
    "sourceCandidates": "OEM: nVent (Hoffman), Eaton, Schneider Electric (Square D)"
  },
  {
    "id": "E-25",
    "discipline": "ELE",
    "name": "Conduit riser or stub-up",
    "drawingCues": "Circle with arrow; UP, DN, STUB-UP, size such as 2\"C",
    "ifcCandidate": "IfcCableCarrierSegment (CONDUITSEGMENT)",
    "sourceCandidates": "RVT, NBS; OEM: Atkore, Allied Tube (Atkore)"
  },
  {
    "id": "E-26",
    "discipline": "ELE",
    "name": "Conduit body",
    "drawingCues": "Fitting at a turn; LB, LL, LR, T, C",
    "ifcCandidate": "IfcCableCarrierFitting (JUNCTION)",
    "sourceCandidates": "OEM: Crouse-Hinds (Eaton), Appleton (Emerson), ABB (Thomas & Betts)"
  },
  {
    "id": "E-27",
    "discipline": "ELE",
    "name": "Junction or pull box",
    "drawingCues": "Square with J and size such as 12x12x6; J, JB, PB",
    "ifcCandidate": "IfcJunctionBox",
    "sourceCandidates": "OEM: nVent (Hoffman), Hubbell, ABB (Thomas & Betts)"
  },
  {
    "id": "E-28",
    "discipline": "ELE",
    "name": "Handhole",
    "drawingCues": "Small square on the site plan; HH, PB",
    "ifcCandidate": "IfcJunctionBox",
    "sourceCandidates": "OEM: Hubbell (Quazite), Oldcastle Infrastructure"
  },
  {
    "id": "E-29",
    "discipline": "ELE",
    "name": "Manhole or electrical vault",
    "drawingCues": "Circle or rectangle on the site plan; MH, EMH, VAULT",
    "ifcCandidate": "IfcBuildingElementProxy",
    "sourceCandidates": "OEM: Oldcastle Infrastructure, Hubbell (Quazite)"
  },
  {
    "id": "E-30",
    "discipline": "ELE",
    "name": "Ground rod",
    "drawingCues": "Ground symbol on a rod; GR, GND ROD, size such as 3/4\" x 10'",
    "ifcCandidate": "IfcBuildingElementProxy (no native IFC4 class)",
    "sourceCandidates": "OEM: nVent (ERICO), Harger Lightning & Grounding"
  },
  {
    "id": "E-31",
    "discipline": "ELE",
    "name": "Ground test well",
    "drawingCues": "Circle with G inside a square; GW, TW, GRD WELL",
    "ifcCandidate": "IfcBuildingElementProxy (no native IFC4 class)",
    "sourceCandidates": "OEM: nVent (ERICO), Hubbell (Quazite)"
  },
  {
    "id": "E-32",
    "discipline": "ELE",
    "name": "Grounding bus bar",
    "drawingCues": "Thin rectangle with ground symbol; MGB, TMGB, TGB, GB",
    "ifcCandidate": "IfcBuildingElementProxy (no native IFC4 class)",
    "sourceCandidates": "OEM: Panduit, Chatsworth, nVent (ERICO)"
  },
  {
    "id": "E-33",
    "discipline": "ELE",
    "name": "Air terminal",
    "drawingCues": "Vertical dash with circle on the roof plan; AT, LP, AIR TERM",
    "ifcCandidate": "IfcBuildingElementProxy (no native IFC4 class)",
    "sourceCandidates": "OEM: nVent (ERICO), Harger Lightning & Grounding"
  },
  {
    "id": "E-34",
    "discipline": "ELE",
    "name": "Duplex receptacle",
    "drawingCues": "Circle with two parallel lines; R, DUP, REC, NEMA 5-20R",
    "ifcCandidate": "IfcOutlet (POWEROUTLET)",
    "sourceCandidates": "NBS, RVT; OEM: Leviton, Hubbell, Legrand"
  },
  {
    "id": "E-35",
    "discipline": "ELE",
    "name": "GFCI receptacle",
    "drawingCues": "Duplex symbol with GFI or GFCI; WP for weatherproof",
    "ifcCandidate": "IfcOutlet (POWEROUTLET)",
    "sourceCandidates": "NBS, RVT; OEM: Leviton, Hubbell"
  },
  {
    "id": "E-36",
    "discipline": "ELE",
    "name": "240 V receptacle (range, dryer, welder)",
    "drawingCues": "Circle with three lines; 240V, 220V, NEMA 14-50",
    "ifcCandidate": "IfcOutlet (POWEROUTLET)",
    "sourceCandidates": "NBS; OEM: Leviton, Hubbell"
  },
  {
    "id": "E-37",
    "discipline": "ELE",
    "name": "Floor box",
    "drawingCues": "Rectangle or circle in the floor; FB, FLR BOX",
    "ifcCandidate": "IfcOutlet (POWEROUTLET)",
    "sourceCandidates": "OEM: Legrand (Wiremold), Hubbell"
  },
  {
    "id": "E-38",
    "discipline": "ELE",
    "name": "Light switch (single-pole, 3-way, 4-way)",
    "drawingCues": "S with subscript 3 or 4; S, S3, S4",
    "ifcCandidate": "IfcSwitchingDevice (TOGGLESWITCH)",
    "sourceCandidates": "NBS, RVT; OEM: Leviton, Lutron, Legrand"
  },
  {
    "id": "E-39",
    "discipline": "ELE",
    "name": "Dimmer",
    "drawingCues": "S with a D subscript; SD, DIM",
    "ifcCandidate": "IfcSwitchingDevice (DIMMERSWITCH)",
    "sourceCandidates": "OEM: Lutron, Leviton"
  },
  {
    "id": "E-40",
    "discipline": "ELE",
    "name": "Occupancy or vacancy sensor",
    "drawingCues": "Circle or wall box with OS; OS, OCC, VS",
    "ifcCandidate": "IfcSensor (MOVEMENTSENSOR)",
    "sourceCandidates": "OEM: Lutron, Acuity (nLight), Leviton"
  },
  {
    "id": "E-41",
    "discipline": "ELE",
    "name": "Photocell or daylight sensor",
    "drawingCues": "Circle with PC; PC, PE, PHOTOCELL",
    "ifcCandidate": "IfcSensor (LIGHTSENSOR)",
    "sourceCandidates": "OEM: Intermatic, Tork, Acuity (nLight), Lutron"
  },
  {
    "id": "E-42",
    "discipline": "ELE",
    "name": "Lighting control panel",
    "drawingCues": "Rectangle with LCP, RP",
    "ifcCandidate": "IfcUnitaryControlElement (CONTROLPANEL)",
    "sourceCandidates": "OEM: Lutron, Acuity (nLight), Eaton"
  },
  {
    "id": "E-43",
    "discipline": "ELE",
    "name": "Emergency stop or pushbutton station",
    "drawingCues": "Circle with PB or ES; PB, ES, E-STOP",
    "ifcCandidate": "IfcSwitchingDevice (EMERGENCYSTOP)",
    "sourceCandidates": "OEM: Eaton, Siemens, ABB"
  },
  {
    "id": "E-44",
    "discipline": "ELE",
    "name": "Data outlet",
    "drawingCues": "Triangle; D, DATA, RJ45",
    "ifcCandidate": "IfcOutlet (DATAOUTLET)",
    "sourceCandidates": "OEM: Leviton, Panduit, Legrand"
  },
  {
    "id": "E-45",
    "discipline": "ELE",
    "name": "Network rack or IDF/MDF cabinet",
    "drawingCues": "Rectangle; IDF, MDF, TR, RACK",
    "ifcCandidate": "IfcBuildingElementProxy",
    "sourceCandidates": "OEM: Chatsworth, Panduit, Schneider Electric (APC NetShelter)"
  },
  {
    "id": "E-46",
    "discipline": "ELE",
    "name": "Wireless access point",
    "drawingCues": "Circle with signal arcs; WAP, AP",
    "ifcCandidate": "IfcCommunicationsAppliance (NETWORKAPPLIANCE)",
    "sourceCandidates": "OEM: Cisco, HPE Aruba, Ubiquiti. Confirm per SKU"
  },
  {
    "id": "E-47",
    "discipline": "ELE",
    "name": "CCTV camera",
    "drawingCues": "Triangle or dome; CAM, CCTV",
    "ifcCandidate": "IfcAudioVisualAppliance (CAMERA)",
    "sourceCandidates": "OEM: Axis, Hanwha, Bosch"
  },
  {
    "id": "E-48",
    "discipline": "ELE",
    "name": "Card reader",
    "drawingCues": "Small box; CR, RDR, AC",
    "ifcCandidate": "IfcSensor (IDENTIFIERSENSOR)",
    "sourceCandidates": "OEM: HID, Allegion, ASSA ABLOY"
  },
  {
    "id": "E-49",
    "discipline": "ELE",
    "name": "Recessed downlight",
    "drawingCues": "Circle with cross; DL, fixture-type letter such as A, B",
    "ifcCandidate": "IfcLightFixture (POINTSOURCE)",
    "sourceCandidates": "NBS; OEM: Lithonia (Acuity), Halo (Eaton), Signify"
  },
  {
    "id": "E-50",
    "discipline": "ELE",
    "name": "Troffer (2x4 and 2x2)",
    "drawingCues": "Rectangle with diagonal or cross lines; 2X4, 2X2, fixture tag",
    "ifcCandidate": "IfcLightFixture",
    "sourceCandidates": "NBS; OEM: Lithonia, Metalux (Eaton), Signify"
  },
  {
    "id": "E-51",
    "discipline": "ELE",
    "name": "Linear pendant or strip",
    "drawingCues": "Long thin rectangle; LIN, L1",
    "ifcCandidate": "IfcLightFixture",
    "sourceCandidates": "OEM: Lithonia, Signify, Eaton"
  },
  {
    "id": "E-52",
    "discipline": "ELE",
    "name": "Wall pack or sconce",
    "drawingCues": "Semicircle against a wall; WP, WS",
    "ifcCandidate": "IfcLightFixture",
    "sourceCandidates": "OEM: Lithonia, Eaton"
  },
  {
    "id": "E-53",
    "discipline": "ELE",
    "name": "High-bay luminaire",
    "drawingCues": "Circle with filled quadrants; HB",
    "ifcCandidate": "IfcLightFixture",
    "sourceCandidates": "OEM: Lithonia, Eaton, Signify"
  },
  {
    "id": "E-54",
    "discipline": "ELE",
    "name": "Pole luminaire",
    "drawingCues": "Circle on a pole with arm on the site plan; PL, POLE, SL",
    "ifcCandidate": "IfcLightFixture",
    "sourceCandidates": "OEM: Lithonia, Eaton, Signify, Hubbell"
  },
  {
    "id": "E-55",
    "discipline": "ELE",
    "name": "Bollard",
    "drawingCues": "Circle with a filled quarter; BOL, BOLLARD",
    "ifcCandidate": "IfcLightFixture",
    "sourceCandidates": "OEM: Lithonia, Eaton, Signify"
  },
  {
    "id": "E-56",
    "discipline": "ELE",
    "name": "Exit sign",
    "drawingCues": "Box with X or arrow; EXIT",
    "ifcCandidate": "IfcLightFixture (SECURITYLIGHTING)",
    "sourceCandidates": "OEM: Lithonia, Cooper (Sure-Lites)"
  },
  {
    "id": "E-57",
    "discipline": "ELE",
    "name": "Emergency light unit",
    "drawingCues": "Twin shaded heads; EM, EL",
    "ifcCandidate": "IfcLightFixture (SECURITYLIGHTING)",
    "sourceCandidates": "OEM: Lithonia, Cooper (Sure-Lites)"
  },
  {
    "id": "E-58",
    "discipline": "ELE",
    "name": "Fire alarm control panel",
    "drawingCues": "Rectangle with FACP, FA, FCP",
    "ifcCandidate": "IfcUnitaryControlElement (ALARMPANEL)",
    "sourceCandidates": "OEM: Notifier (Honeywell), Siemens, Edwards"
  },
  {
    "id": "E-59",
    "discipline": "ELE",
    "name": "Smoke detector",
    "drawingCues": "Circle with S; SD",
    "ifcCandidate": "IfcSensor (SMOKESENSOR)",
    "sourceCandidates": "OEM: System Sensor, Notifier, Siemens"
  },
  {
    "id": "E-60",
    "discipline": "ELE",
    "name": "Heat detector",
    "drawingCues": "Circle with H; HD",
    "ifcCandidate": "IfcSensor (HEATSENSOR)",
    "sourceCandidates": "OEM: System Sensor, Notifier"
  },
  {
    "id": "E-61",
    "discipline": "ELE",
    "name": "Manual pull station",
    "drawingCues": "Square with F; PS, MPS",
    "ifcCandidate": "IfcAlarm (MANUALPULLBOX)",
    "sourceCandidates": "OEM: System Sensor, Notifier"
  },
  {
    "id": "E-62",
    "discipline": "ELE",
    "name": "Horn or strobe",
    "drawingCues": "Box or trapezoid; H/S, HS, S, NA",
    "ifcCandidate": "IfcAlarm (SIREN)",
    "sourceCandidates": "OEM: System Sensor, Wheelock (Eaton), Gentex"
  },
  {
    "id": "A-01",
    "discipline": "ARC",
    "name": "Single swing door",
    "drawingCues": "Quarter-circle swing arc in a wall opening; door tag D-101, 101A; DR",
    "ifcCandidate": "IfcDoor",
    "sourceCandidates": "NBS, RVT, BSM; OEM: Masonite, ASSA ABLOY, Allegion (hardware)"
  },
  {
    "id": "A-02",
    "discipline": "ARC",
    "name": "Double swing door",
    "drawingCues": "Two opposing swing arcs; PR, DBL",
    "ifcCandidate": "IfcDoor",
    "sourceCandidates": "NBS, RVT, BSM; OEM: ASSA ABLOY"
  },
  {
    "id": "A-03",
    "discipline": "ARC",
    "name": "Sliding, pocket or bi-fold door",
    "drawingCues": "Leaf beside the opening with arrow, dashed leaf in the wall, or zig-zag leaves; SLDG, PKT, BF",
    "ifcCandidate": "IfcDoor",
    "sourceCandidates": "NBS, RVT, BSM"
  },
  {
    "id": "A-04",
    "discipline": "ARC",
    "name": "Overhead or rolling door",
    "drawingCues": "Dashed door outline above the opening; OHD, O.H., RSD, ROLL-UP",
    "ifcCandidate": "IfcDoor",
    "sourceCandidates": "OEM: Clopay, Overhead Door Company, Wayne Dalton (BO, BSM)"
  },
  {
    "id": "A-05",
    "discipline": "ARC",
    "name": "Storefront or glazed entrance",
    "drawingCues": "Thin glazing lines with door swing; SF, STOREFRONT, ENT",
    "ifcCandidate": "IfcDoor",
    "sourceCandidates": "OEM: Kawneer, YKK AP (BO)"
  },
  {
    "id": "A-06",
    "discipline": "ARC",
    "name": "Fixed window",
    "drawingCues": "Triple line in the wall; tag W-1, FX",
    "ifcCandidate": "IfcWindow",
    "sourceCandidates": "NBS, RVT, BSM"
  },
  {
    "id": "A-07",
    "discipline": "ARC",
    "name": "Operable window",
    "drawingCues": "Triple line with sash marks; CSMT, DH, SL, AWN",
    "ifcCandidate": "IfcWindow",
    "sourceCandidates": "NBS, RVT; OEM: Andersen, Pella, Marvin"
  },
  {
    "id": "A-08",
    "discipline": "ARC",
    "name": "Stair",
    "drawingCues": "Parallel treads; UP, DN, riser count such as 14 R",
    "ifcCandidate": "IfcStair",
    "sourceCandidates": "RVT, NBS. Parametric from run and rise"
  },
  {
    "id": "A-09",
    "discipline": "ARC",
    "name": "Guardrail or handrail",
    "drawingCues": "Line with HR, GR, 42\" GR",
    "ifcCandidate": "IfcRailing",
    "sourceCandidates": "RVT, NBS"
  },
  {
    "id": "A-10",
    "discipline": "ARC",
    "name": "Elevator",
    "drawingCues": "Box with diagonal X; ELEV, EL-1",
    "ifcCandidate": "IfcTransportElement (ELEVATOR)",
    "sourceCandidates": "RVT; OEM: KONE, Otis, Schindler"
  },
  {
    "id": "A-11",
    "discipline": "ARC",
    "name": "Ceiling grid and tile",
    "drawingCues": "2x2 or 2x4 grid hatch on the reflected ceiling plan; ACT",
    "ifcCandidate": "IfcCovering (CEILING)",
    "sourceCandidates": "NBS, RVT; OEM: Armstrong, USG"
  },
  {
    "id": "A-12",
    "discipline": "ARC",
    "name": "Casework (base and wall cabinets)",
    "drawingCues": "Rectangles along a wall, dashed uppers; BC, WC, CAB",
    "ifcCandidate": "IfcFurniture",
    "sourceCandidates": "RVT, NBS, ARCAT"
  },
  {
    "id": "A-13",
    "discipline": "ARC",
    "name": "Furniture (desk, table, chair)",
    "drawingCues": "Outlines on furniture plans; DESK, TBL, CH",
    "ifcCandidate": "IfcFurniture",
    "sourceCandidates": "KEN, QUA, PPZ; OEM: Steelcase, Herman Miller (BO)"
  },
  {
    "id": "A-14",
    "discipline": "ARC",
    "name": "Kitchen and laundry appliances",
    "drawingCues": "Rectangles with R, REF, RNG, OVEN, DW, W, D, W/D",
    "ifcCandidate": "IfcElectricAppliance (REFRIGERATOR, ELECTRICCOOKER, DISHWASHER, WASHINGMACHINE, TUMBLEDRYER)",
    "sourceCandidates": "KEN, BSM, BO"
  },
  {
    "id": "M-01",
    "discipline": "MEC",
    "name": "Air handling unit",
    "drawingCues": "Large rectangle; AHU, AHU-1, AC-1",
    "ifcCandidate": "IfcUnitaryEquipment (AIRHANDLER)",
    "sourceCandidates": "OEM: Trane, Carrier, Daikin, Johnson Controls (York)"
  },
  {
    "id": "M-02",
    "discipline": "MEC",
    "name": "Rooftop unit",
    "drawingCues": "Rectangle on the roof plan; RTU, RTU-1",
    "ifcCandidate": "IfcUnitaryEquipment (ROOFTOPUNIT)",
    "sourceCandidates": "OEM: Trane, Carrier, Lennox, Daikin"
  },
  {
    "id": "M-03",
    "discipline": "MEC",
    "name": "Fan coil or mini-split indoor unit",
    "drawingCues": "Small rectangle with coil lines; FCU, FC-1, IDU, MS",
    "ifcCandidate": "IfcUnitaryEquipment (AIRCONDITIONINGUNIT, SPLITSYSTEM)",
    "sourceCandidates": "OEM: Trane, Carrier, Daikin, Mitsubishi Electric"
  },
  {
    "id": "M-04",
    "discipline": "MEC",
    "name": "VAV box",
    "drawingCues": "Rectangle in a duct run; VAV, VAV-1",
    "ifcCandidate": "IfcAirTerminalBox",
    "sourceCandidates": "OEM: Titus, Price, Nailor, Trane"
  },
  {
    "id": "M-05",
    "discipline": "MEC",
    "name": "Exhaust fan",
    "drawingCues": "Circle with blades; EF, EF-1",
    "ifcCandidate": "IfcFan",
    "sourceCandidates": "OEM: Greenheck, Loren Cook"
  },
  {
    "id": "M-06",
    "discipline": "MEC",
    "name": "Ceiling diffuser",
    "drawingCues": "Square with X and size/CFM tag such as 12x12 / 250; SD, SA, CD",
    "ifcCandidate": "IfcAirTerminal (DIFFUSER)",
    "sourceCandidates": "NBS; OEM: Titus, Price, Krueger"
  },
  {
    "id": "M-07",
    "discipline": "MEC",
    "name": "Return or exhaust grille",
    "drawingCues": "Square or rectangle with a single diagonal; RG, EG, TG",
    "ifcCandidate": "IfcAirTerminal (GRILLE)",
    "sourceCandidates": "NBS; OEM: Titus, Price"
  },
  {
    "id": "M-08",
    "discipline": "MEC",
    "name": "Fire or smoke damper",
    "drawingCues": "Duct with diagonal and label; FD, SD, FSD",
    "ifcCandidate": "IfcDamper (FIREDAMPER, SMOKEDAMPER, FIRESMOKEDAMPER)",
    "sourceCandidates": "OEM: Ruskin, Greenheck, Nailor"
  },
  {
    "id": "M-09",
    "discipline": "MEC",
    "name": "Outdoor condensing or heat-pump unit",
    "drawingCues": "Square on the site or roof plan; CU, ODU, HP",
    "ifcCandidate": "IfcUnitaryEquipment (SPLITSYSTEM)",
    "sourceCandidates": "OEM: Trane, Carrier, Daikin"
  },
  {
    "id": "M-10",
    "discipline": "MEC",
    "name": "Boiler",
    "drawingCues": "Rectangle or circle with flame mark; B, BLR, B-1",
    "ifcCandidate": "IfcBoiler",
    "sourceCandidates": "OEM: Lochinvar, AERCO, Cleaver-Brooks, Burnham"
  },
  {
    "id": "M-11",
    "discipline": "MEC",
    "name": "Chiller",
    "drawingCues": "Rectangle with CH, CH-1",
    "ifcCandidate": "IfcChiller",
    "sourceCandidates": "OEM: Trane, Carrier, Johnson Controls (York), Daikin"
  },
  {
    "id": "M-12",
    "discipline": "MEC",
    "name": "Pump",
    "drawingCues": "Circle with a flow arrow; P, P-1, CHWP, HWP",
    "ifcCandidate": "IfcPump",
    "sourceCandidates": "OEM: Grundfos, Bell & Gossett (Xylem), Armstrong Fluid Technology, Taco"
  },
  {
    "id": "P-01",
    "discipline": "PLB",
    "name": "Water closet",
    "drawingCues": "Oval bowl with tank; WC, WC-1",
    "ifcCandidate": "IfcSanitaryTerminal (TOILETPAN)",
    "sourceCandidates": "NBS, RVT; OEM: Kohler, American Standard, TOTO"
  },
  {
    "id": "P-02",
    "discipline": "PLB",
    "name": "Lavatory or sink",
    "drawingCues": "Oval basin or rectangle with one or two bowls; LAV, L-1, SK, S-1",
    "ifcCandidate": "IfcSanitaryTerminal (WASHHANDBASIN, SINK)",
    "sourceCandidates": "NBS, RVT; OEM: Kohler, American Standard, Elkay"
  },
  {
    "id": "P-03",
    "discipline": "PLB",
    "name": "Floor drain",
    "drawingCues": "Circle with square or X; FD",
    "ifcCandidate": "IfcWasteTerminal (FLOORTRAP)",
    "sourceCandidates": "OEM: Zurn, Watts, Jay R. Smith, Sioux Chief"
  },
  {
    "id": "P-04",
    "discipline": "PLB",
    "name": "Storage water heater",
    "drawingCues": "Circle with WH; WH, WH-1",
    "ifcCandidate": "IfcBoiler (WATER)",
    "sourceCandidates": "OEM: A. O. Smith, Rheem, Bradford White"
  },
  {
    "id": "P-05",
    "discipline": "PLB",
    "name": "Backflow preventer",
    "drawingCues": "Valve symbol with RPZ or DCVA; BFP",
    "ifcCandidate": "IfcValve (CHECK)",
    "sourceCandidates": "OEM: Watts, Zurn Wilkins, Febco"
  },
  {
    "id": "P-06",
    "discipline": "PLB",
    "name": "Isolation, check or pressure-reducing valve",
    "drawingCues": "Bow-tie (gate), filled bow-tie (ball), check arrow, PRV; GV, BV, CV, PRV",
    "ifcCandidate": "IfcValve (ISOLATING, CHECK, PRESSUREREDUCING)",
    "sourceCandidates": "OEM: NIBCO, Apollo (Conbraco), Victaulic, Watts"
  },
  {
    "id": "FP-01",
    "discipline": "FPR",
    "name": "Sprinkler head",
    "drawingCues": "Small circle with cross; SP, PEND, UPRT, SW (sidewall)",
    "ifcCandidate": "IfcFireSuppressionTerminal (SPRINKLER)",
    "sourceCandidates": "OEM: Viking, Tyco (Johnson Controls), Reliable, Victaulic"
  },
  {
    "id": "FP-02",
    "discipline": "FPR",
    "name": "Riser or alarm check valve assembly",
    "drawingCues": "Vertical pipe with valve symbols; FR, RISER, ACV",
    "ifcCandidate": "IfcValve (CHECK)",
    "sourceCandidates": "OEM: Viking, Tyco, Victaulic"
  },
  {
    "id": "FP-03",
    "discipline": "FPR",
    "name": "Fire pump",
    "drawingCues": "Circle with FP; FP, FP-1",
    "ifcCandidate": "IfcPump",
    "sourceCandidates": "OEM: Patterson, Aurora (Pentair), Armstrong, Clarke"
  },
  {
    "id": "FP-04",
    "discipline": "FPR",
    "name": "Fire hydrant",
    "drawingCues": "Circle with cross and arms on the site plan; FH, HYD",
    "ifcCandidate": "IfcFireSuppressionTerminal (FIREHYDRANT)",
    "sourceCandidates": "OEM: Mueller, American AVK, Clow"
  },
  {
    "id": "FP-05",
    "discipline": "FPR",
    "name": "Fire extinguisher or cabinet",
    "drawingCues": "Triangle or rectangle; FE, FEC",
    "ifcCandidate": "IfcFireSuppressionTerminal (FIREEXTINGUISHER)",
    "sourceCandidates": "OEM: JL Industries, Larsen's, Potter Roemer"
  },
  {
    "id": "FP-06",
    "discipline": "FPR",
    "name": "Flow or tamper switch",
    "drawingCues": "Small box on a sprinkler pipe labelled FS, TS",
    "ifcCandidate": "IfcSensor (FLOWSENSOR)",
    "sourceCandidates": "OEM: System Sensor, Potter Electric Signal"
  }
] as const;

export type SpatialTaxonomyEntry=(typeof SPATIAL_COMPONENT_TAXONOMY)[number];
export type SpatialTaxonomyDiscipline=SpatialTaxonomyEntry['discipline'];
export function findSpatialTaxonomyEntry(typeId:string):SpatialTaxonomyEntry|undefined{
 return SPATIAL_COMPONENT_TAXONOMY.find(entry=>entry.id===typeId);
}
