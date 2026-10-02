import type {OemSource} from './oem-source-catalog.ts';
import type {OemCadCandidate} from './oem-cad-candidates.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';
import type {ElectricalComponent} from './electrical-component-library.ts';

/** Licensed, pinned catalog geometry. Approval is for visualization, not installed-state verification. */
export const ACTIVATED_OEM_COMPONENTS:ElectricalComponent[]=[
  {
    "key": "adafruit-mcp9808-1782",
    "name": "Adafruit MCP9808 Temperature Breakout (1782)",
    "category": "Sensors & Monitoring Devices",
    "aliases": [
      "adafruit mcp9808",
      "adafruit 1782"
    ],
    "twinShape": "sensor",
    "trackAsAsset": false,
    "manufacturer": "Adafruit",
    "modelFamily": "Adafruit MCP9808 Temperature Breakout (1782)"
  },
  {
    "key": "adafruit-lis3dh-2809",
    "name": "Adafruit LIS3DH Accelerometer STEMMA QT (2809)",
    "category": "Sensors & Monitoring Devices",
    "aliases": [
      "adafruit lis3dh",
      "adafruit 2809"
    ],
    "twinShape": "sensor",
    "trackAsAsset": false,
    "manufacturer": "Adafruit",
    "modelFamily": "Adafruit LIS3DH Accelerometer STEMMA QT (2809)"
  },
  {
    "key": "adafruit-ina219-904",
    "name": "Adafruit INA219 Current Sensor STEMMA QT (904)",
    "category": "Sensors & Monitoring Devices",
    "aliases": [
      "adafruit ina219",
      "adafruit 904"
    ],
    "twinShape": "sensor",
    "trackAsAsset": false,
    "manufacturer": "Adafruit",
    "modelFamily": "Adafruit INA219 Current Sensor STEMMA QT (904)"
  },
  {
    "key": "adafruit-enclosure-2230",
    "name": "Adafruit Aluminum Electronics Enclosure (2230)",
    "category": "Power Distribution Devices",
    "aliases": [
      "adafruit aluminum electronics enclosure",
      "adafruit enclosure 2230",
      "adafruit 2230"
    ],
    "twinShape": "junction",
    "trackAsAsset": false,
    "manufacturer": "Adafruit",
    "modelFamily": "Adafruit Aluminum Electronics Enclosure (2230)"
  }
];

export const ACTIVATED_OEM_SOURCES:OemSource[]=[
  {
    "id": "adafruit-mcp9808-1782-cad",
    "manufacturer": "Adafruit",
    "families": [
      "Adafruit MCP9808 Temperature Breakout (1782)"
    ],
    "componentKeys": [
      "adafruit-mcp9808-1782"
    ],
    "url": "https://www.adafruit.com/product/1782",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STL",
      "GLB conversion"
    ],
    "fields": [
      "catalog SKU",
      "pinned CAD revision",
      "CAD envelope",
      "file hash",
      "license"
    ],
    "access": "Licensed catalog CAD converted to an active meter-space GLB. Manufacturer CAD is 20.32 × 12.70 × 3.07 mm including board components; product page rounds the footprint to 21 × 13 mm and lists 2 mm thickness. Preserve CAD envelope; do not interpret it as an installed clearance. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation.",
    "checkedAt": "2026-10-02"
  },
  {
    "id": "adafruit-lis3dh-2809-cad",
    "manufacturer": "Adafruit",
    "families": [
      "Adafruit LIS3DH Accelerometer STEMMA QT (2809)"
    ],
    "componentKeys": [
      "adafruit-lis3dh-2809"
    ],
    "url": "https://www.adafruit.com/product/2809",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STL",
      "GLB conversion"
    ],
    "fields": [
      "catalog SKU",
      "pinned CAD revision",
      "CAD envelope",
      "file hash",
      "license"
    ],
    "access": "Licensed catalog CAD converted to an active meter-space GLB. STEMMA QT revision with connectors and four mounting holes. Board geometry only; excludes cable and loose pin headers. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation.",
    "checkedAt": "2026-10-02"
  },
  {
    "id": "adafruit-ina219-904-cad",
    "manufacturer": "Adafruit",
    "families": [
      "Adafruit INA219 Current Sensor STEMMA QT (904)"
    ],
    "componentKeys": [
      "adafruit-ina219-904"
    ],
    "url": "https://www.adafruit.com/product/904",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STL",
      "GLB conversion"
    ],
    "fields": [
      "catalog SKU",
      "pinned CAD revision",
      "CAD envelope",
      "file hash",
      "license"
    ],
    "access": "Licensed catalog CAD converted to an active meter-space GLB. Pinned STEMMA QT CAD board revision without the later pre-soldered terminal block. The catalog records a May 2024 terminal-block change; this model is the explicitly named bare-board configuration, not every shipped 904 assembly. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation.",
    "checkedAt": "2026-10-02"
  },
  {
    "id": "adafruit-enclosure-2230-cad",
    "manufacturer": "Adafruit",
    "families": [
      "Adafruit Aluminum Electronics Enclosure (2230)"
    ],
    "componentKeys": [
      "adafruit-enclosure-2230"
    ],
    "url": "https://www.adafruit.com/product/2230",
    "evidence": "CAD_BIM_PORTAL",
    "formats": [
      "STEP",
      "GLB conversion"
    ],
    "fields": [
      "catalog SKU",
      "pinned CAD revision",
      "CAD envelope",
      "file hash",
      "license"
    ],
    "access": "Licensed catalog CAD converted to an active meter-space GLB. Enclosure body and two end plates. CAD envelope 82.8 × 28.8 × 93.5 mm in CAD XYZ axes; catalog nominal dimensions 94 × 83 × 30 mm. Screws not modeled. Not an IP/NEMA-rated electrical enclosure claim. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation.",
    "checkedAt": "2026-10-02"
  }
];

export const ACTIVATED_OEM_CANDIDATES:OemCadCandidate[]=[
  {
    "id": "adafruit-mcp9808-1782",
    "sourceId": "adafruit-mcp9808-1782-cad",
    "componentKey": "adafruit-mcp9808-1782",
    "manufacturer": "Adafruit",
    "sku": "1782",
    "product": "Adafruit MCP9808 Temperature Breakout (1782)",
    "productUrl": "https://www.adafruit.com/product/1782",
    "cadUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/1782%20MCP9808/1782%20MCP9808.stl",
    "cadFormat": "STL; converted to GLB",
    "status": "GLB_APPROVED",
    "dimensionsMeters": [
      0.02032,
      0.0127,
      0.00307
    ],
    "modelUrl": "/models/oem/adafruit-mcp9808-1782.glb",
    "sourceSha256": "0b7135c56cdede04e9c641979db21367a8101b99b078d8d0abbc85d9ce146f60",
    "modelSha256": "59d80fa7193469f5b2cd3f4d919f2d96fcd47c2f72a3773607609dd6d9679c46",
    "reuseTerms": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "verifiedAt": "2026-10-02",
    "approvedAt": "2026-10-02",
    "notes": "Manufacturer CAD is 20.32 × 12.70 × 3.07 mm including board components; product page rounds the footprint to 21 × 13 mm and lists 2 mm thickness. Preserve CAD envelope; do not interpret it as an installed clearance. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  },
  {
    "id": "adafruit-lis3dh-2809",
    "sourceId": "adafruit-lis3dh-2809-cad",
    "componentKey": "adafruit-lis3dh-2809",
    "manufacturer": "Adafruit",
    "sku": "2809",
    "product": "Adafruit LIS3DH Accelerometer STEMMA QT (2809)",
    "productUrl": "https://www.adafruit.com/product/2809",
    "cadUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/2809%20LIS3DH/2809%20LIS3DH.stl",
    "cadFormat": "STL; converted to GLB",
    "status": "GLB_APPROVED",
    "dimensionsMeters": [
      0.01778,
      0.0254,
      0.00453
    ],
    "modelUrl": "/models/oem/adafruit-lis3dh-2809.glb",
    "sourceSha256": "2513407c98328e280cd10c8553efba295e8d2623d1cc6126f5d204426a707acd",
    "modelSha256": "e3e0bd0577a143e2abd1771fce745d97f102b6eefc8e1cf795de42276adf2365",
    "reuseTerms": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "verifiedAt": "2026-10-02",
    "approvedAt": "2026-10-02",
    "notes": "STEMMA QT revision with connectors and four mounting holes. Board geometry only; excludes cable and loose pin headers. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  },
  {
    "id": "adafruit-ina219-904",
    "sourceId": "adafruit-ina219-904-cad",
    "componentKey": "adafruit-ina219-904",
    "manufacturer": "Adafruit",
    "sku": "904",
    "product": "Adafruit INA219 Current Sensor STEMMA QT (904)",
    "productUrl": "https://www.adafruit.com/product/904",
    "cadUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/904%20INA219%20Stemma/904%20INA219%20Stemma.stl",
    "cadFormat": "STL; converted to GLB",
    "status": "GLB_APPROVED",
    "dimensionsMeters": [
      0.0254,
      0.02032,
      0.00453
    ],
    "modelUrl": "/models/oem/adafruit-ina219-904.glb",
    "sourceSha256": "82add48e5edaad36698205e7aa0dbc9e0675ca9e40fa4479ef5fdfd58effeb52",
    "modelSha256": "1ba1797ca9a1bf30980c9eb020ee7ee830854fc1f37f38be7220f9dd4f5b4ed8",
    "reuseTerms": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "verifiedAt": "2026-10-02",
    "approvedAt": "2026-10-02",
    "notes": "Pinned STEMMA QT CAD board revision without the later pre-soldered terminal block. The catalog records a May 2024 terminal-block change; this model is the explicitly named bare-board configuration, not every shipped 904 assembly. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  },
  {
    "id": "adafruit-enclosure-2230",
    "sourceId": "adafruit-enclosure-2230-cad",
    "componentKey": "adafruit-enclosure-2230",
    "manufacturer": "Adafruit",
    "sku": "2230",
    "product": "Adafruit Aluminum Electronics Enclosure (2230)",
    "productUrl": "https://www.adafruit.com/product/2230",
    "cadUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/2230%20Extruded%20aluminum%20box%2094mm/2230%20Extruded%20aluminum%20box%2094mm.step",
    "cadFormat": "STEP; converted to GLB",
    "status": "GLB_APPROVED",
    "dimensionsMeters": [
      0.0828,
      0.0288,
      0.0935
    ],
    "modelUrl": "/models/oem/adafruit-enclosure-2230.glb",
    "sourceSha256": "0fddb71df6f7b0177d918a08dbc9c3b5f71492aac90749d4b5cb454d16aa7a52",
    "modelSha256": "eb5d2e48afcc9a7268623b399f5b742f12850d0c64537ba6a7a0ed82c504e5bb",
    "reuseTerms": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "verifiedAt": "2026-10-02",
    "approvedAt": "2026-10-02",
    "notes": "Enclosure body and two end plates. CAD envelope 82.8 × 28.8 × 93.5 mm in CAD XYZ axes; catalog nominal dimensions 94 × 83 × 30 mm. Screws not modeled. Not an IP/NEMA-rated electrical enclosure claim. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  }
];

export const ACTIVATED_OEM_MODELS:Record<string,Partial<ElectricalModelConfig>>={
  "adafruit-mcp9808-1782": {
    "modelUrl": "/models/oem/adafruit-mcp9808-1782.glb",
    "format": "GLB",
    "dimensionsMeters": [
      0.02032,
      0.0127,
      0.00307
    ],
    "dimensionsConfidence": 0.95,
    "dimensionsSource": "Pinned Adafruit CAD bounds in millimeters; converted to meters. Catalog envelope differences documented in notes.",
    "source": "Adafruit_CAD_Parts at c128bceb1f96b6ea8b68f250bda986ba85da24ea",
    "sourceUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/1782%20MCP9808/1782%20MCP9808.stl",
    "license": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "attribution": "CAD published by Adafruit Industries; converted to GLB by STRATUM Power.",
    "geometryStatus": "OEM_SUPPLIED",
    "notes": "Manufacturer CAD is 20.32 × 12.70 × 3.07 mm including board components; product page rounds the footprint to 21 × 13 mm and lists 2 mm thickness. Preserve CAD envelope; do not interpret it as an installed clearance. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  },
  "adafruit-lis3dh-2809": {
    "modelUrl": "/models/oem/adafruit-lis3dh-2809.glb",
    "format": "GLB",
    "dimensionsMeters": [
      0.01778,
      0.0254,
      0.00453
    ],
    "dimensionsConfidence": 0.95,
    "dimensionsSource": "Pinned Adafruit CAD bounds in millimeters; converted to meters. Catalog envelope differences documented in notes.",
    "source": "Adafruit_CAD_Parts at c128bceb1f96b6ea8b68f250bda986ba85da24ea",
    "sourceUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/2809%20LIS3DH/2809%20LIS3DH.stl",
    "license": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "attribution": "CAD published by Adafruit Industries; converted to GLB by STRATUM Power.",
    "geometryStatus": "OEM_SUPPLIED",
    "notes": "STEMMA QT revision with connectors and four mounting holes. Board geometry only; excludes cable and loose pin headers. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  },
  "adafruit-ina219-904": {
    "modelUrl": "/models/oem/adafruit-ina219-904.glb",
    "format": "GLB",
    "dimensionsMeters": [
      0.0254,
      0.02032,
      0.00453
    ],
    "dimensionsConfidence": 0.95,
    "dimensionsSource": "Pinned Adafruit CAD bounds in millimeters; converted to meters. Catalog envelope differences documented in notes.",
    "source": "Adafruit_CAD_Parts at c128bceb1f96b6ea8b68f250bda986ba85da24ea",
    "sourceUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/904%20INA219%20Stemma/904%20INA219%20Stemma.stl",
    "license": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "attribution": "CAD published by Adafruit Industries; converted to GLB by STRATUM Power.",
    "geometryStatus": "OEM_SUPPLIED",
    "notes": "Pinned STEMMA QT CAD board revision without the later pre-soldered terminal block. The catalog records a May 2024 terminal-block change; this model is the explicitly named bare-board configuration, not every shipped 904 assembly. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  },
  "adafruit-enclosure-2230": {
    "modelUrl": "/models/oem/adafruit-enclosure-2230.glb",
    "format": "GLB",
    "dimensionsMeters": [
      0.0828,
      0.0288,
      0.0935
    ],
    "dimensionsConfidence": 0.95,
    "dimensionsSource": "Pinned Adafruit CAD bounds in millimeters; converted to meters. Catalog envelope differences documented in notes.",
    "source": "Adafruit_CAD_Parts at c128bceb1f96b6ea8b68f250bda986ba85da24ea",
    "sourceUrl": "https://github.com/adafruit/Adafruit_CAD_Parts/blob/c128bceb1f96b6ea8b68f250bda986ba85da24ea/2230%20Extruded%20aluminum%20box%2094mm/2230%20Extruded%20aluminum%20box%2094mm.step",
    "license": "MIT license; Copyright (c) 2016 Adafruit Industries. Preserve accompanying /models/oem/adafruit-cad-LICENSE.txt.",
    "attribution": "CAD published by Adafruit Industries; converted to GLB by STRATUM Power.",
    "geometryStatus": "OEM_SUPPLIED",
    "notes": "Enclosure body and two end plates. CAD envelope 82.8 × 28.8 × 93.5 mm in CAD XYZ axes; catalog nominal dimensions 94 × 83 × 30 mm. Screws not modeled. Not an IP/NEMA-rated electrical enclosure claim. Neutral material; silkscreen/textures are not reproduced. Reference geometry approval does not verify a physical installation."
  }
};

