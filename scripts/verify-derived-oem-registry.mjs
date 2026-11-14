// Verify the four derived models resolve in the registry the way the UI reads it.
import fs from 'node:fs';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {OEM_CAD_CANDIDATES} from '../lib/oem-cad-candidates.ts';
const keys = ['evse-tesla-supercharger-v4','evse-tesla-supercharger-cabinet-387kva','padmount-switchgear-abb-elastimold','pad-mount-transformer-hitachi'];
for (const key of keys) {
  const cfg = DEFAULT_ELECTRICAL_MODEL_REGISTRY.find((x) => x.componentKey === key);
  if (!cfg) throw new Error(key + ': no registry entry');
  const badge = cfg.geometryStatus === 'OEM_SUPPLIED' ? 'OEM ACTIVE'
    : OEM_CAD_CANDIDATES.find((i) => i.componentKey === key)?.status === 'CAD_DOWNLOAD_IDENTIFIED' ? 'CAD FOUND'
    : OEM_CAD_CANDIDATES.find((i) => i.componentKey === key)?.status === 'SOURCE_IDENTIFIED' ? 'OEM LEAD'
    : cfg.modelUrl ? 'MODEL' : 'FALLBACK';
  const dimsShown = cfg.dimensionsMeters?.every((v) => v > 0);
  const file = 'public' + cfg.modelUrl;
  const exists = fs.existsSync(file);
  const size = exists ? fs.statSync(file).size : 0;
  console.log(JSON.stringify({key, badge, dimsShown, dimensionsMeters: cfg.dimensionsMeters, confidence: cfg.dimensionsConfidence, geometryStatus: cfg.geometryStatus, modelUrl: cfg.modelUrl, fileExists: exists, fileBytes: size}));
  if (badge !== 'MODEL') throw new Error(key + ': badge is ' + badge);
  if (!dimsShown) throw new Error(key + ': dimensions not all > 0');
  if (!exists) throw new Error(key + ': GLB missing at ' + file);
}
console.log('Registry check passed: all four resolve to MODEL with dimensions.');
