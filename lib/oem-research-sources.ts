import type {OemSource} from './oem-source-catalog.ts';

/** Official discovery sources checked on 2026-09-29; not imported geometry. */
export const OEM_RESEARCH_SOURCES:OemSource[]=
[
  {
    "id": "eaton-cospec",
    "manufacturer": "Eaton",
    "families": [
      "Crouse-Hinds",
      "B-Line cable support and enclosures"
    ],
    "componentKeys": [
      "cable-tray",
      "wireway",
      "junction-box"
    ],
    "url": "https://www.eaton.com/us/en-us/support/tools/crouse-hinds-b-line-drawing-design-library.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD",
      "Revit",
      "SP3D"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official CoSPEC and BIM entry point. Configure exact parts; export availability and terms vary by product.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "eaton-bussmann-cad",
    "manufacturer": "Eaton",
    "families": [
      "Bussmann surge protection",
      "compact circuit protectors"
    ],
    "componentKeys": [
      "spd",
      "fused-switch"
    ],
    "url": "https://www.eaton.com/us/en-us/products/electrical-circuit-protection/fuses/cad-drawing-library.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STEP",
      "IGES",
      "DWG"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Direct legacy CAD links are listed; some returned HTTP 403 during research. Check product lifecycle and internal CAD identity against the listed SKU before conversion.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "siemens-tip-bim",
    "manufacturer": "Siemens",
    "families": [
      "distribution boards",
      "LV switchboards",
      "MV switchgear",
      "busbar trunking",
      "transformers"
    ],
    "componentKeys": [
      "distribution-panel",
      "lv-switchboard",
      "utility-switchgear",
      "busduct",
      "dry-transformer"
    ],
    "url": "https://www.siemens.com/en-gb/products/tip-consultant-support/bim-data/",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "BIM"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official TIP BIM catalog; select region and equipment configuration. Individual files and rights remain unverified.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "schneider-traceparts",
    "manufacturer": "Schneider Electric",
    "families": [
      "electrical distribution CAD"
    ],
    "componentKeys": [
      "mccb",
      "mcb",
      "contactor",
      "disconnect"
    ],
    "url": "https://www.se.com/nz/en/work/support/cad-files-drawings/electrical-distribution-cad-files/",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STEP AP203/AP214/AP242",
      "IGES",
      "DWG 2D/3D",
      "OBJ",
      "STL",
      "COLLADA",
      "JT"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official route to TraceParts exports. Registration is advertised; formats are catalog options, not confirmation that every SKU offers every format.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "rittal-cad",
    "manufacturer": "Rittal",
    "families": [
      "enclosures",
      "IT cabinets"
    ],
    "componentKeys": [
      "data-cabinet"
    ],
    "url": "https://www.rittal.com/us-en_US/Software/CAD-data",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD",
      "native multiCAD"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official PARTcommunity entry point. Select exact cabinet and accessories; no exported file or redistribution permission verified.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "nvent-freestand-cad",
    "manufacturer": "nVent HOFFMAN",
    "families": [
      "free-standing electrical enclosures"
    ],
    "componentKeys": [],
    "url": "https://www.nvent.com/en-us/hoffman/products/enca722418fs",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STEP",
      "DXF 2D"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "A722418FS product listing advertises a 3D STEP file. Page retrieval returned 403; file not acquired. Electrical enclosure class mapping remains pending.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "panduit-revit",
    "manufacturer": "Panduit",
    "families": [
      "physical network infrastructure",
      "racks"
    ],
    "componentKeys": [
      "data-cabinet"
    ],
    "url": "https://www.panduit.com/en/about/panduit-partners/it-resellers-and-system-integrators/it-resellers-and-system-integrators-planning-tools.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official planning tools identify Autodesk Revit resources. Visio shapes on the same page are not 3D geometry; verify individual BIM packages.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "legrand-cablofil",
    "manufacturer": "Legrand",
    "families": [
      "Cablofil wire mesh tray",
      "G-Tray",
      "ITray",
      "cable bus"
    ],
    "componentKeys": [
      "cable-tray",
      "busduct"
    ],
    "url": "https://www.legrand.us/resources/bim%20models?q=%3Arelevance%3AlrProductLine%3ACablofil&text=",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "RFA",
      "BIM ZIP packages"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Manufacturer results list downloadable model packages. ZIP is a container; inspect its files, revision and terms before use.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "generac-bim",
    "manufacturer": "Generac",
    "families": [
      "diesel generators",
      "gaseous generators",
      "bi-fuel generators",
      "transfer switches"
    ],
    "componentKeys": [
      "generator",
      "ats"
    ],
    "url": "https://www.generac.com/industrial/tools-resources/engineering-resources/bim-documents/",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit/BIM"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official page provides family-specific and all-industrial-products BIM download routes. Select enclosure, rating and transfer-switch configuration.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "rehlko-bim",
    "manufacturer": "Rehlko",
    "families": [
      "diesel generators",
      "gaseous generators",
      "ATS",
      "exhaust silencers",
      "remote annunciators"
    ],
    "componentKeys": [
      "generator",
      "ats"
    ],
    "url": "https://www.powersystems.rehlko.com/bim",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit RFA"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Manufacturer directs users to BIMobject and states account registration is required for free downloads. No account or license acceptance performed.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "cat-specsizer-bim",
    "manufacturer": "Caterpillar",
    "families": [
      "generator sets"
    ],
    "componentKeys": [
      "generator"
    ],
    "url": "https://www.cat.com/en_US/articles/electric-power/electric-power-specsizer.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "BIM",
      "drawings"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official SpecSizer page documents BIM downloads. Registration/configuration workflow; exact export format and file remain to be checked.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "carrier-revit",
    "manufacturer": "Carrier",
    "families": [
      "commercial HVAC",
      "rooftop units",
      "split systems",
      "chillers"
    ],
    "componentKeys": [],
    "url": "https://www.carrier.com/us/en/commercial/software/revit-3d-templates/",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official template library and configurator. Match capacity, voltage and installed options; HVAC library classes remain pending.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "daikin-magnitude-bim",
    "manufacturer": "Daikin Applied",
    "families": [
      "Magnitude WMC-D chillers"
    ],
    "componentKeys": [],
    "url": "https://www.daikinapplied.com/products/chiller-products/magnitude",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit/BIM"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Product page links Revit files; family record only. Exact chiller configuration and HVAC class are required.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "daikin-rebel-bim",
    "manufacturer": "Daikin Applied",
    "families": [
      "Rebel DAH air handlers"
    ],
    "componentKeys": [],
    "url": "https://www.daikinapplied.com/products/air-handlers/rebel",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit/BIM"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official product Revit link; match unit configuration and electrical schedule. HVAC class pending.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "greenheck-fans",
    "manufacturer": "Greenheck",
    "families": [
      "fans",
      "ventilation equipment"
    ],
    "componentKeys": [],
    "url": "https://www.greenheck.com/resources/drawings/fans",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit",
      "DWG 3D"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official static drawings and configured content. Select exact fan size and accessories; ventilation class pending.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "xylem-pump-cad",
    "manufacturer": "Xylem",
    "families": [
      "Lowara pumps",
      "Bell & Gossett pumps",
      "Flygt pumps"
    ],
    "componentKeys": [
      "pump"
    ],
    "url": "https://www.xylem.com/en-150/support/interactive-tools-calculators/",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD",
      "BIM"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official tools route to Lowara Drawing Center and pump selection tools. Configure duty point, motor and connection geometry before acquisition.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "wilo-bim-cad",
    "manufacturer": "Wilo",
    "families": [
      "pumps",
      "pump systems"
    ],
    "componentKeys": [
      "pump"
    ],
    "url": "https://wilo.com/us/en_us/Solutions/Engineering-Tools/BIM-CAD-Catalogue/",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "DWG 2D/3D",
      "STEP",
      "Revit"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official CAD catalog and Revit plugin. Download specific configured pump; do not infer installed motor power from family data.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "belimo-cad-bim",
    "manufacturer": "Belimo",
    "families": [
      "control valves",
      "damper actuators"
    ],
    "componentKeys": [],
    "url": "https://www.belimo.com/us/en_US/support-am/sizing-and-selection-tools/product-cad-bim-models",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD",
      "BIM"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official PARTcommunity route. Valve and actuator classes pending; select exact valve/actuator assembly and export format.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "danfoss-bim",
    "manufacturer": "Danfoss",
    "families": [
      "HVAC control components"
    ],
    "componentKeys": [],
    "url": "https://www.danfoss.com/en/service-and-support/downloads/dcs/bim-tool-and-libraries",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "BIM",
      "Revit"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official BIM tool and Revit plugin. Export formats depend on selected component; mechanical class mapping pending.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "johnson-envirotec-bim",
    "manufacturer": "Johnson Controls",
    "families": [
      "ENVIRO-TEC HVAC equipment"
    ],
    "componentKeys": [],
    "url": "https://webselect.johnsoncontrols.com/ecatalog/revit.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit",
      "AutoCAD",
      "ZIP packages"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Manufacturer-hosted 3D file packages; inspect exact contents and HVAC product configuration. Mechanical class pending.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "wago-cad",
    "manufacturer": "WAGO",
    "families": [
      "terminal blocks",
      "electrical interconnections"
    ],
    "componentKeys": [
      "terminal-block"
    ],
    "url": "https://www.wago.com/us/digitalization/digital-engineering/design-cad-data",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD",
      "native multiCAD"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official PARTcommunity route and Smart Designer. Configure exact part or assembly; verify portal access and export terms.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "abb-baldor-motor-cad",
    "manufacturer": "ABB",
    "families": [
      "Baldor-Reliance general purpose motors"
    ],
    "componentKeys": [
      "motor"
    ],
    "url": "https://www.abb.com/global/en/products/7bl1318-50",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Parasolid X_B"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Exact L1318-50 product record lists 35LYM497_12.94.x_b. Manufacturer download metadata only; file and units not inspected.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "sew-drive-cad",
    "manufacturer": "SEW-EURODRIVE",
    "families": [
      "gearmotors",
      "drive systems"
    ],
    "componentKeys": [
      "motor"
    ],
    "url": "https://download.sew-eurodrive.com/download/html/27806162/en-EN/13576461579.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official Online Support CAD instructions. Configure exact drive and mounting position; export format and rights to verify.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "rockwell-cad-configurator",
    "manufacturer": "Rockwell Automation",
    "families": [
      "industrial controls",
      "drives",
      "motor controls"
    ],
    "componentKeys": [
      "vfd",
      "motor-starter",
      "contactor"
    ],
    "url": "https://www.rockwellautomation.com/en-pr/support/documentation/product-drawings.html",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "2D CAD",
      "3D CAD"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Manufacturer Product Configurator provides drawings. Confirm a file contains 3D geometry; a plan-view DWG or PDF is not sufficient.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "hubbell-bim",
    "manufacturer": "Hubbell Wiring Device-Kellems",
    "families": [
      "wiring devices",
      "receptacles",
      "lighting controls"
    ],
    "componentKeys": [
      "duplex-receptacle",
      "gfci",
      "industrial-receptacle",
      "lighting-control"
    ],
    "url": "https://www.hubbell.com/wiringdevice-kellems/en/technical-resources",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "BIM",
      "drawings"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official technical resources route to drawings/specifications/BIM and approved partners. Inspect each model and regional electrical rating.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "acuity-bim",
    "manufacturer": "Acuity Brands",
    "families": [
      "luminaires",
      "lighting controls"
    ],
    "componentKeys": [
      "lighting-control",
      "panel-light",
      "emergency-light",
      "exit-sign"
    ],
    "url": "https://www.acuitybrands.com/resources/technical-resources/bim-downloads",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "Revit",
      "BIM ZIP packages"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Manufacturer provides product/brand BIM downloads. IES photometry is supporting data, not a 3D model; match exact luminaire and options.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "socomec-current-sensor",
    "manufacturer": "Socomec",
    "families": [
      "TE-90 current sensors"
    ],
    "componentKeys": [
      "current-sensor"
    ],
    "url": "https://www.socomec.us/en-us/reference/48290506",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "3D CAD configurable export"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Exact 48290506 record advertises Download 3D Model. Selected output format, units, file hash and reuse terms remain unverified.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "socomec-como-disconnect",
    "manufacturer": "Socomec",
    "families": [
      "COMO enclosed load-break switches"
    ],
    "componentKeys": [
      "disconnect"
    ],
    "url": "https://apac.socomec.com/en/reference/21153402",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "3D CAD configurable export"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Exact 21153402 regional product exposes a 3D model selector. Match regional approval and product configuration before use.",
    "checkedAt": "2026-09-29"
  },
  {
    "id": "littelfuse-contactor-cad",
    "manufacturer": "Littelfuse",
    "families": [
      "DCNLR contactor relays"
    ],
    "componentKeys": [
      "contactor"
    ],
    "url": "https://info.littelfuse.com/cvp-dcnlr-contactor-relays-3d-models-landing-page",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "3D CAD (format not yet verified)"
    ],
    "fields": [
      "exact product/configuration",
      "document revision",
      "dimensions and units",
      "reuse terms",
      "source file hash"
    ],
    "access": "Official download landing page names DCNLR100NB12, DCNLR100NB24 and DCNLR100NB48. Form-gated; no contact details submitted and no file acquired.",
    "checkedAt": "2026-09-29"
  }
];
