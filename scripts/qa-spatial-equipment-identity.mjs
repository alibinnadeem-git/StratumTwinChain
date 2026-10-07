import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {reconcileSpatialEquipmentIdentity} from '../lib/spatial-equipment-identity.ts';
import {resolveSpatialModel} from '../lib/spatial-model-resolution.ts';

const spatial={
  id:'pdf-evse-1',source:'E2.01.pdf',layer:'L2',kind:'text-asset-candidate',
  name:'EVSE-1 EV CHARGER',x:10,y:5,z:0,confidence:.88,meta:{page:2,physicalTruth:false,reviewRequired:true}
};
const schedule={
  id:'schedule-evse-1',source:'Equipment Schedule.csv',layer:'L4',kind:'schedule-powered-equipment-candidate',
  name:'EVSE-1 EV CHARGER',x:0,y:0,z:0,confidence:.94,
  meta:{sourceType:'EQUIPMENT_SCHEDULE',nonSpatial:true,assetTag:'EVSE-1',manufacturer:'Tesla',model:'Universal Wall Connector Gen 3',physicalTruth:false,reviewRequired:true}
};

const reconciled=reconcileSpatialEquipmentIdentity([spatial,schedule]);
const placed=reconciled.find(entity=>entity.id==='pdf-evse-1');
assert.equal(placed?.meta?.manufacturer,'Tesla');
assert.equal(placed?.meta?.model,'Universal Wall Connector Gen 3');
assert.equal(placed?.meta?.productIdentityStatus,'SOURCE_RECONCILED_CANDIDATE');
assert.equal(placed?.meta?.productIdentityAuthority,'SAME_TAG_SCHEDULE_RECONCILIATION');
assert.equal(placed?.meta?.productIdentityTag,'EVSE-1');
assert.equal(placed?.meta?.assetTag,'EVSE-1');
assert.deepEqual(placed?.meta?.productIdentityEvidenceIds,['schedule-evse-1']);
assert.equal(placed?.meta?.productIdentityPhysicalAssetVerified,false);
assert.equal(placed?.meta?.physicalTruth,false);
assert.equal(placed?.meta?.reviewRequired,true);

const exact=resolveSpatialModel(placed,DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(exact.componentKey,'evse-tesla-wall-connector-gen3');
assert.equal(exact.exactProductIdentity,true);
assert.equal(exact.tier,'EXACT_PRODUCT_VISUALIZATION');

const conflictingSchedule={
  ...schedule,id:'schedule-evse-1-conflict',source:'Alternate Schedule.xlsx',
  meta:{...schedule.meta,manufacturer:'ABB E-mobility',model:'Terra 360'}
};
const conflictResult=reconcileSpatialEquipmentIdentity([spatial,schedule,conflictingSchedule]);
const conflictSpatial=conflictResult.find(entity=>entity.id==='pdf-evse-1');
assert.equal(conflictSpatial?.meta?.productIdentityStatus,'CONFLICT');
assert.deepEqual(conflictSpatial?.meta?.productIdentityManufacturers,['TESLA','ABB E-MOBILITY']);
assert.deepEqual(conflictSpatial?.meta?.productIdentityModels,['UNIVERSAL WALL CONNECTOR GEN 3','TERRA 360']);
assert.equal(conflictSpatial?.meta?.manufacturer,undefined,'conflicting schedule identity must not be copied onto the positioned object');
assert.equal(conflictSpatial?.meta?.model,undefined);

const conflictModel=resolveSpatialModel(conflictSpatial,DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(conflictModel.componentKey,'evse');
assert.equal(conflictModel.exactProductIdentity,false,'conflicted product identity must fall back to the generic equipment family');

const existingConflict=reconcileSpatialEquipmentIdentity([
  {...spatial,meta:{...spatial.meta,manufacturer:'ChargePoint',model:'CPF50'}},
  schedule
]).find(entity=>entity.id==='pdf-evse-1');
assert.equal(existingConflict?.meta?.productIdentityStatus,'CONFLICT');
assert.equal(existingConflict?.meta?.manufacturer,'ChargePoint','existing drawing evidence is preserved, not silently overwritten');

const noProductSchedule={
  ...schedule,id:'schedule-msb-1',name:'MSB-1 MAIN SWITCHBOARD',
  meta:{sourceType:'EQUIPMENT_SCHEDULE',nonSpatial:true,assetTag:'MSB-1',physicalTruth:false,reviewRequired:true}
};
const msb={...spatial,id:'pdf-msb-1',name:'MSB-1 MAIN SWITCHBOARD'};
const noProduct=reconcileSpatialEquipmentIdentity([msb,noProductSchedule]).find(entity=>entity.id==='pdf-msb-1');
assert.equal(noProduct?.meta?.productIdentityStatus,'TAG_LINKED_NO_PRODUCT_IDENTITY');
assert.equal(noProduct?.meta?.manufacturer,undefined);
assert.equal(noProduct?.meta?.model,undefined);

const unrelated={...spatial,id:'pdf-ats-1',name:'ATS-1 AUTOMATIC TRANSFER SWITCH'};
const unrelatedResult=reconcileSpatialEquipmentIdentity([unrelated,schedule]).find(entity=>entity.id==='pdf-ats-1');
assert.equal(unrelatedResult?.meta?.productIdentityStatus,undefined);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/reconcileSpatialEquipmentIdentity/);
assert.match(compiler,/reconcileSpatialEquipmentIdentity\(enrichZCandidates\(nextEntities\)\)/);

console.log('Spatial equipment identity reconciliation passed: same-tag schedule evidence enriches positioned equipment for exact product-model resolution, conflicts fail closed without silent manufacturer/model selection, existing source evidence is preserved, and physical installed identity remains unverified.');
