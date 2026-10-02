import type {OemCadCandidate} from './oem-cad-candidates.ts';

/** Acquisition evidence, never active geometry. */
export const OEM_RESEARCH_CANDIDATES:OemCadCandidate[]=
[
  {
    "id": "chargepoint-cp6323b-l5-5",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CP6323B-L5.5",
    "product": "CP6000 dual wall mount with CMK",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "STEP (manufacturer ZIP)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Downloaded and inspected STEP signature, ending and SHA-256. Configuration is identified by archive filename; no geometry, units or dimensional validation performed. Exact installed configuration and reuse rights remain unverified. Source is not persisted in the tenant vault and is not a viewer model.",
    "cadUrl": "https://www.chargepoint.com/download-file/step-cp6000-commerical",
    "downloadInspection": {
      "filename": "CP6323B-L5.5-WallMountCMK.STEP",
      "bytes": 147875487,
      "sha256": "ae29ce59ce657c08c79d37b599cc6cb363b878e50d56acfc040df906c9bf3c5e",
      "checkedAt": "2026-09-29",
      "result": "STEP signature and terminator checked; geometry and units not validated."
    }
  },
  {
    "id": "chargepoint-cp6321b-l5-5",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CP6321B-L5.5",
    "product": "CP6000 dual pedestal with 6 ft CMK",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "STEP (manufacturer ZIP)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Downloaded and inspected STEP signature, ending and SHA-256. Configuration is identified by archive filename; no geometry, units or dimensional validation performed. Exact installed configuration and reuse rights remain unverified. Source is not persisted in the tenant vault and is not a viewer model.",
    "cadUrl": "https://www.chargepoint.com/download-file/step-cp6000-commerical",
    "downloadInspection": {
      "filename": "CP6321B-L5.5-6ftCMK.STEP",
      "bytes": 131734711,
      "sha256": "3fb8fcfee546b6f2da85862c99b628c9edd23e08c0c4808390ff378ea96952ca",
      "checkedAt": "2026-09-29",
      "result": "STEP signature and terminator checked; geometry and units not validated."
    }
  },
  {
    "id": "chargepoint-cpe250",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CPE250",
    "product": "Express 250 two-arm North America exterior assembly",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "STEP (manufacturer ZIP)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Downloaded and inspected STEP signature, ending and SHA-256. Configuration is identified by archive filename; no geometry, units or dimensional validation performed. Exact installed configuration and reuse rights remain unverified. Source is not persisted in the tenant vault and is not a viewer model.",
    "cadUrl": "https://www.chargepoint.com/download-file/3d-cad-model-step-express",
    "downloadInspection": {
      "filename": "CPE250_2-arm_ID_Master_Skins_NA_01102020.STEP",
      "bytes": 457902273,
      "sha256": "784ea50faba345c37d26d97f8a1e71e2e5a059ee2e2fb1ffa2e45c181b769e2c",
      "checkedAt": "2026-09-29",
      "result": "STEP signature and terminator checked; geometry and units not validated."
    }
  },
  {
    "id": "chargepoint-ct4011",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CT4011",
    "product": "CT4000 6 ft bollard single",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "Manufacturer CAD package; exact contents pending",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official guide lists this exact mounting variant and a family Revit package. Individual file format, revision and license not inspected; do not substitute another CT4000 mounting variant."
  },
  {
    "id": "chargepoint-ct4013",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CT4013",
    "product": "CT4000 6 ft wall mount single",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "Manufacturer CAD package; exact contents pending",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official guide lists this exact mounting variant and a family Revit package. Individual file format, revision and license not inspected; do not substitute another CT4000 mounting variant."
  },
  {
    "id": "chargepoint-ct4021",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CT4021",
    "product": "CT4000 6 ft bollard dual",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "Manufacturer CAD package; exact contents pending",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official guide lists this exact mounting variant and a family Revit package. Individual file format, revision and license not inspected; do not substitute another CT4000 mounting variant."
  },
  {
    "id": "chargepoint-ct4023",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CT4023",
    "product": "CT4000 6 ft wall mount dual",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "Manufacturer CAD package; exact contents pending",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official guide lists this exact mounting variant and a family Revit package. Individual file format, revision and license not inspected; do not substitute another CT4000 mounting variant."
  },
  {
    "id": "chargepoint-ct4025",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CT4025",
    "product": "CT4000 8 ft bollard dual",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "Manufacturer CAD package; exact contents pending",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official guide lists this exact mounting variant and a family Revit package. Individual file format, revision and license not inspected; do not substitute another CT4000 mounting variant."
  },
  {
    "id": "chargepoint-ct4027",
    "sourceId": "chargepoint-design",
    "componentKey": "evse",
    "manufacturer": "ChargePoint",
    "sku": "CT4027",
    "product": "CT4000 8 ft wall mount dual",
    "productUrl": "https://www.chargepoint.com/products/guides",
    "cadFormat": "Manufacturer CAD package; exact contents pending",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official guide lists this exact mounting variant and a family Revit package. Individual file format, revision and license not inspected; do not substitute another CT4000 mounting variant."
  },
  {
    "id": "eaton-bspd48rj45",
    "sourceId": "eaton-bussmann-cad",
    "componentKey": "spd",
    "manufacturer": "Eaton",
    "sku": "BSPD48RJ45",
    "product": "DIN-rail RJ45/Ethernet surge protector",
    "productUrl": "https://www.eaton.com/us/en-us/products/electrical-circuit-protection/fuses/cad-drawing-library.html",
    "cadFormat": "STEP AP214",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "IDENTITY REVIEW: Eaton publishes this file under BSPD48RJ45, but the STEP header names DEHN+SOEHNE and a DPA M CLE RJ45B file. Do not assert an exact OEM identity match from the download label. File downloaded; redistribution rights, units and geometry not validated.",
    "cadUrl": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/cad-drawing-library/bus-ele-cd-bspd48rj45.stp",
    "downloadInspection": {
      "checkedAt": "2026-09-29",
      "filename": "bus-ele-cd-bspd48rj45.stp",
      "bytes": 1697045,
      "sha256": "8242f595a6d5d21e814a05487a0790f12e20bdb91e563af2018735bd7c204398",
      "result": "STEP signature inspected; internal DEHN identity requires reconciliation with Eaton SKU."
    }
  },
  {
    "id": "eaton-bspd5bncsi",
    "sourceId": "eaton-bussmann-cad",
    "componentKey": "spd",
    "manufacturer": "Eaton",
    "sku": "BSPD5BNCSI",
    "product": "Inline BNC coax surge protector",
    "productUrl": "https://www.eaton.com/us/en-us/products/electrical-circuit-protection/fuses/cad-drawing-library.html",
    "cadFormat": "STEP",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Manufacturer lists CAD for this product. File identity, revision, units, geometry and reuse rights require verification before registry activation.",
    "cadUrl": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/cad-drawing-library/bus-ele-cd-bspd5bncsi.stp"
  },
  {
    "id": "eaton-ccp-3-30cc",
    "sourceId": "eaton-bussmann-cad",
    "componentKey": "fused-switch",
    "manufacturer": "Eaton",
    "sku": "CCP-3-30CC",
    "product": "Compact Circuit Protector",
    "productUrl": "https://www.eaton.com/us/en-us/products/electrical-circuit-protection/fuses/cad-drawing-library.html",
    "cadFormat": "IGES (ZIP)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Manufacturer legacy CAD listing dated 2008. Download target identified; current product lifecycle, revision, contents and license need review.",
    "cadUrl": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/cad-drawing-library/bus-cad-igs-ccp-3-30cc.zip"
  },
  {
    "id": "abb-l1318-50",
    "sourceId": "abb-baldor-motor-cad",
    "componentKey": "motor",
    "manufacturer": "ABB",
    "sku": "L1318-50",
    "product": "Baldor-Reliance general purpose motor",
    "productUrl": "https://www.abb.com/global/en/products/7bl1318-50",
    "cadFormat": "Parasolid X_B: 35LYM497_12.94.x_b",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Manufacturer lists CAD for this product. File identity, revision, units, geometry and reuse rights require verification before registry activation."
  },
  {
    "id": "socomec-48290506",
    "sourceId": "socomec-current-sensor",
    "componentKey": "current-sensor",
    "manufacturer": "Socomec",
    "sku": "48290506",
    "product": "TE-90 solid current sensor",
    "productUrl": "https://www.socomec.us/en-us/reference/48290506",
    "cadFormat": "3D CAD (selected export format pending)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Manufacturer lists CAD for this product. File identity, revision, units, geometry and reuse rights require verification before registry activation."
  },
  {
    "id": "socomec-21153402",
    "sourceId": "socomec-como-disconnect",
    "componentKey": "disconnect",
    "manufacturer": "Socomec",
    "sku": "21153402",
    "product": "COMO enclosed load-break switch 3P 25 A",
    "productUrl": "https://apac.socomec.com/en/reference/21153402",
    "cadFormat": "3D CAD (selected export format pending)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Manufacturer lists CAD for this product. File identity, revision, units, geometry and reuse rights require verification before registry activation."
  },
  {
    "id": "littelfuse-dcnlr100nb12",
    "sourceId": "littelfuse-contactor-cad",
    "componentKey": "contactor",
    "manufacturer": "Littelfuse",
    "sku": "DCNLR100NB12",
    "product": "DCNLR contactor relay",
    "productUrl": "https://info.littelfuse.com/cvp-dcnlr-contactor-relays-3d-models-landing-page",
    "cadFormat": "3D CAD (form-gated; export format unverified)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official form lists this part number. No form submitted, account created, or download acquired. Request the model through the manufacturer workflow and review its reuse terms."
  },
  {
    "id": "littelfuse-dcnlr100nb24",
    "sourceId": "littelfuse-contactor-cad",
    "componentKey": "contactor",
    "manufacturer": "Littelfuse",
    "sku": "DCNLR100NB24",
    "product": "DCNLR contactor relay",
    "productUrl": "https://info.littelfuse.com/cvp-dcnlr-contactor-relays-3d-models-landing-page",
    "cadFormat": "3D CAD (form-gated; export format unverified)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official form lists this part number. No form submitted, account created, or download acquired. Request the model through the manufacturer workflow and review its reuse terms."
  },
  {
    "id": "littelfuse-dcnlr100nb48",
    "sourceId": "littelfuse-contactor-cad",
    "componentKey": "contactor",
    "manufacturer": "Littelfuse",
    "sku": "DCNLR100NB48",
    "product": "DCNLR contactor relay",
    "productUrl": "https://info.littelfuse.com/cvp-dcnlr-contactor-relays-3d-models-landing-page",
    "cadFormat": "3D CAD (form-gated; export format unverified)",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Official form lists this part number. No form submitted, account created, or download acquired. Request the model through the manufacturer workflow and review its reuse terms."
  },
  {
    "id": "lovato-bf3200d024",
    "sourceId": "lovato-cad",
    "componentKey": "contactor",
    "manufacturer": "LOVATO Electric",
    "sku": "BF3200D024",
    "product": "BF contactor",
    "productUrl": "https://catalogue.lovatoelectric.com/ca_en/Three-pole-contactor-IEC-operating-current-Ie-AC3-32A-DC-coil-24VDC/BF3200D024/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/ca_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF3200D024.stp",
    "cadFormat": "STEP AP214",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: FILE_STP_CAD_DRAWING_3d_BF26_38_D_L_prt.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_BF3200D024.stp",
      "bytes": 12405453,
      "sha256": "799d5b7c6fcb198d50f4a86869943d4e9c3b52654fb0bf797d47b2f3f10ef5ca",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: FILE_STP_CAD_DRAWING_3d_BF26_38_D_L_prt.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation."
    }
  },
  {
    "id": "lovato-bf2501d110",
    "sourceId": "lovato-cad",
    "componentKey": "contactor",
    "manufacturer": "LOVATO Electric",
    "sku": "BF2501D110",
    "product": "BF contactor",
    "productUrl": "https://catalogue.lovatoelectric.com/gl_en/BF2501D110/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF2501D110.stp",
    "cadFormat": "STEP AP214",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: 3d_BF09_25_D_L.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation. BF2501D110 and BF1801D024 downloads have identical SHA-256; these are two acquisition records, not two unique geometries. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_BF2501D110.stp",
      "bytes": 12745384,
      "sha256": "122ad0a0c69987b7c0cab16edb0a7626f6a09e870f23ec149baccee821ebecc8",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: 3d_BF09_25_D_L.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation. BF2501D110 and BF1801D024 downloads have identical SHA-256; these are two acquisition records, not two unique geometries."
    }
  },
  {
    "id": "lovato-bf2501a110",
    "sourceId": "lovato-cad",
    "componentKey": "contactor",
    "manufacturer": "LOVATO Electric",
    "sku": "BF2501A110",
    "product": "BF contactor",
    "productUrl": "https://catalogue.lovatoelectric.com/gl_en/BF2501A110/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF2501A110.stp",
    "cadFormat": "STEP AP214",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: 3d_BF09_25_A.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_BF2501A110.stp",
      "bytes": 11367812,
      "sha256": "c4bbb97d3cc476830c88c52565e161e9d4db1cfc3824ddd3b64fd23f87654f24",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: 3d_BF09_25_A.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation."
    }
  },
  {
    "id": "lovato-bf1801d024",
    "sourceId": "lovato-cad",
    "componentKey": "contactor",
    "manufacturer": "LOVATO Electric",
    "sku": "BF1801D024",
    "product": "BF contactor",
    "productUrl": "https://catalogue.lovatoelectric.com/it_it/BF1801D024/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/it_it/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_BF1801D024.stp",
    "cadFormat": "STEP AP214",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: 3d_BF09_25_D_L.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation. BF2501D110 and BF1801D024 downloads have identical SHA-256; these are two acquisition records, not two unique geometries. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_BF1801D024.stp",
      "bytes": 12745384,
      "sha256": "122ad0a0c69987b7c0cab16edb0a7626f6a09e870f23ec149baccee821ebecc8",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: 3d_BF09_25_D_L.stp. Manufacturer serves a family CAD file; exact coil/contact variant still needs reconciliation. BF2501D110 and BF1801D024 downloads have identical SHA-256; these are two acquisition records, not two unique geometries."
    }
  },
  {
    "id": "lovato-ga025ary",
    "sourceId": "lovato-cad",
    "componentKey": "disconnect",
    "manufacturer": "LOVATO Electric",
    "sku": "GA025ARY",
    "product": "GA switch disconnector",
    "productUrl": "https://catalogue.lovatoelectric.com/es_es/GA025ARY/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/es_es/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_GA025ARY.stp",
    "cadFormat": "STEP AP203",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: 3d_GA016A.stp. Header names a different model; reconcile manufacturer mapping before exact-identity approval. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_GA025ARY.stp",
      "bytes": 380560,
      "sha256": "7e0f5b3f715e3f6f3bf983e66de9da76bc0b97e8992215a81eb0a2b535ed7a06",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: 3d_GA016A.stp. Header names a different model; reconcile manufacturer mapping before exact-identity approval."
    }
  },
  {
    "id": "lovato-dmg110",
    "sourceId": "lovato-cad",
    "componentKey": "power-meter",
    "manufacturer": "LOVATO Electric",
    "sku": "DMG110",
    "product": "DMG digital multimeter / power analyzer",
    "productUrl": "https://catalogue.lovatoelectric.com/gl_en/DMG110/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_DMG110.stp",
    "cadFormat": "STEP AP203",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: 3d_DMG200.stp. Header names a different model; reconcile manufacturer mapping before exact-identity approval. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_DMG110.stp",
      "bytes": 201485,
      "sha256": "c5e3d337b058751bdafd269d2231502425ba769763184a98d191d5025f7cfe70",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: 3d_DMG200.stp. Header names a different model; reconcile manufacturer mapping before exact-identity approval."
    }
  },
  {
    "id": "lovato-dmg210l01",
    "sourceId": "lovato-cad",
    "componentKey": "power-meter",
    "manufacturer": "LOVATO Electric",
    "sku": "DMG210L01",
    "product": "DMG digital multimeter / power analyzer",
    "productUrl": "https://catalogue.lovatoelectric.com/gl_en/DMG210L01/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/gl_en/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_DMG210L01.stp",
    "cadFormat": "STEP AP203",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: 3d_DMG210L01.stp. Header includes the product code; exact geometry, revision and configuration still require validation. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_DMG210L01.stp",
      "bytes": 201488,
      "sha256": "e41b1a2caea5afc4f145893ca520f5d161246a75e4620e61bbee352cca62f881",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: 3d_DMG210L01.stp. Header includes the product code; exact geometry, revision and configuration still require validation."
    }
  },
  {
    "id": "lovato-dmg8000",
    "sourceId": "lovato-cad",
    "componentKey": "power-meter",
    "manufacturer": "LOVATO Electric",
    "sku": "DMG8000",
    "product": "DMG digital multimeter / power analyzer",
    "productUrl": "https://catalogue.lovatoelectric.com/de_de/DMG8000/snp",
    "cadUrl": "https://catalogue.lovatoelectric.com/de_de/Product/GetDocument?doc=CAD%5C3D%20Drawings%5C3d_DMG8000.stp",
    "cadFormat": "STEP AP214",
    "status": "CAD_DOWNLOAD_IDENTIFIED",
    "notes": "Internal STEP filename: FILE_STP_CAD_DRAWING_3D_DMG8000_prt.stp. Header includes the product code; exact geometry, revision and configuration still require validation. Units, dimensions, conversion and reuse rights are not approved. No project installed-state claim.",
    "downloadInspection": {
      "checkedAt": "2026-10-02",
      "filename": "3d_DMG8000.stp",
      "bytes": 7981841,
      "sha256": "dba28fc44806b1dc1700401725df4557f61f591592ae0981db584c7451a3cfbd",
      "result": "ISO-10303-21 signature and SHA-256 inspected. Internal filename: FILE_STP_CAD_DRAWING_3D_DMG8000_prt.stp. Header includes the product code; exact geometry, revision and configuration still require validation."
    }
  }
];
