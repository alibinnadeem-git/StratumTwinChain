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
  }
];
