import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {resolveSpatialModel} from '../lib/spatial-model-resolution.ts';

const registry=DEFAULT_ELECTRICAL_MODEL_REGISTRY;

const genericSwitchboard=resolveSpatialModel({name:'MAIN SWITCHBOARD MSB-1',meta:{}},registry);
assert.equal(genericSwitchboard.componentKey,'main-switchboard');
assert.equal(genericSwitchboard.exactProductIdentity,false);
assert.equal(genericSwitchboard.tier,'FAMILY_MODEL');
assert.match(String(genericSwitchboard.fallbackReason),/family visualization/i);

const genericEvse=resolveSpatialModel({
  name:'EV CHARGER EV-01',
  meta:{manufacturer:'Tesla'}
},registry);
assert.equal(genericEvse.componentKey,'evse','manufacturer name alone must not select a Tesla product family');
assert.equal(genericEvse.exactProductIdentity,false);
assert.equal(genericEvse.tier,'FAMILY_MODEL');
assert.match(genericEvse.geometryAuthority,/^FAMILY_/);
assert.equal(genericEvse.physicalIdentityVerified,false);
assert.ok(!genericEvse.evidence.join(' ').match(/Supercharger V3|Universal Wall Connector Gen 3/));

const exactTesla=resolveSpatialModel({
  name:'EV CHARGER EV-02',
  meta:{manufacturer:'Tesla',model:'Universal Wall Connector Gen 3',modelNumber:'1734412'}
},registry);
assert.equal(exactTesla.componentKey,'evse-tesla-wall-connector-gen3');
assert.equal(exactTesla.exactProductIdentity,true);
assert.equal(exactTesla.tier,'EXACT_PRODUCT_VISUALIZATION');
assert.match(exactTesla.geometryAuthority,/EXACT_PRODUCT_/);
assert.equal(exactTesla.physicalIdentityVerified,false);

const exactTeslaFromLabel=resolveSpatialModel({
  name:'TESLA SUPERCHARGER V3',
  meta:{}
},registry);
assert.equal(exactTeslaFromLabel.componentKey,'evse-tesla-supercharger-v3');
assert.equal(exactTeslaFromLabel.exactProductIdentity,true);
assert.equal(exactTeslaFromLabel.tier,'EXACT_PRODUCT_VISUALIZATION');
assert.match(exactTeslaFromLabel.geometryAuthority,/LICENSED_COMMUNITY/);

const exactOemCad=resolveSpatialModel({
  name:'TEMPERATURE SENSOR TS-1',
  meta:{manufacturer:'Adafruit',model:'MCP9808 Temperature Breakout',sku:'1782'}
},registry);
assert.equal(exactOemCad.componentKey,'adafruit-mcp9808-1782');
assert.equal(exactOemCad.exactProductIdentity,true);
assert.equal(exactOemCad.tier,'EXACT_VERIFIED_OEM_CAD');
assert.equal(exactOemCad.geometryAuthority,'VERIFIED_CATALOG_OEM_GEOMETRY');
assert.ok(exactOemCad.model?.modelUrl.endsWith('adafruit-mcp9808-1782.glb'));

const explicitLibraryKey=resolveSpatialModel({
  name:'SENSOR-7',
  meta:{componentLibraryKey:'adafruit-lis3dh-2809'}
},registry);
assert.equal(explicitLibraryKey.componentKey,'adafruit-lis3dh-2809');
assert.equal(explicitLibraryKey.tier,'EXACT_VERIFIED_OEM_CAD');

const unknown=resolveSpatialModel({name:'MYSTERY DEVICE X-77',meta:{}},registry);
assert.equal(unknown.tier,'UNRESOLVED');
assert.equal(unknown.componentKey,null);
assert.equal(unknown.model,null);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/resolveSpatialModel/);
assert.match(viewer,/modelResolutionTier/);
assert.match(viewer,/modelGeometryAuthority/);
assert.match(viewer,/modelIdentityAuthority/);
assert.match(viewer,/exactProductIdentity/);
const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/3D MODEL ·/);
assert.match(inspector,/3D model tier/);
assert.match(inspector,/Geometry authority/);
assert.match(inspector,/Physical installed identity remains unverified/);

console.log('Spatial model resolution passed: exact source product identity selects exact catalog geometry, generic equipment remains family-only, OEM names without model evidence cannot overclaim product identity, unresolved devices stay unresolved, and every rendered model exposes identity/geometry provenance.');
