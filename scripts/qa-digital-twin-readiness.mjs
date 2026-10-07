import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {deriveDigitalTwinComponentReadiness,deriveDigitalTwinProjectReadiness} from '../lib/digital-twin-readiness.ts';

const resolvedZ={
  status:'RESOLVED_BASE_CANDIDATE',
  baseZMeters:3.2,
  nodes:[
    {id:'support',coordinateFrame:'PROJECT_REVIEW_DATUM',valueMeters:3,lineageGroup:'SUPPORT:floor'},
    {id:'base',coordinateFrame:'PROJECT_REVIEW_DATUM',valueMeters:3.2,lineageGroup:'ENTITY:asset'}
  ],
  relations:[{id:'offset',lineageGroup:'SUPPORT_OFFSET:source'}],
  conflicts:[],frameGaps:[]
};
const unresolvedZ={status:'UNRESOLVED',baseZMeters:null,nodes:[],relations:[],conflicts:[],frameGaps:[]};
const conflictedZ={...resolvedZ,status:'CONFLICT',baseZMeters:null,conflicts:[{deltaMeters:.4,reason:'same-frame chains disagree'}]};

const baseMeta={
  sourceSha256:'a'.repeat(64),page:1,coordinateUnits:'m_reviewed_pdf',
  symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE',
  spatialPlacementAuthority:'SOURCE_VECTOR_SYMBOL_ANCHOR',
  physicalTruth:false,reviewRequired:true
};

const exactEntity={
  id:'evse-1',name:'EVSE-1 TESLA UNIVERSAL WALL CONNECTOR GEN 3',source:'E1.01.pdf',layer:'L2',kind:'text-asset-candidate',
  x:10,y:5,z:0,confidence:.94,
  meta:{...baseMeta,assetTag:'EVSE-1',manufacturer:'Tesla',model:'Universal Wall Connector Gen 3',zConstraintGraph:resolvedZ}
};
const exactAsset={
  id:'asset-evse-1',project_id:'project-1',asset_code:'EVSE-1',asset_type:'EVSE',name:'EV Charger 1',
  model:'Universal Wall Connector Gen 3',serial_number:'TESLA-001',location_label:'Garage',status:'ACTIVE',
  system_name:'EV Charging',manufacturer_name:'Tesla',latest_event_type:'COMMISSIONED',latest_event_status:'APPROVED',
  ledger_network:'stratum-devnet-1',ledger_tx_hash:'0xabc',ledger_block_height:'900',
  maintenance_plan_id:'maint-evse',maintenance_revision:1,maintenance_basis:'OEM',maintenance_interval_days:365,
  maintenance_next_due_at:'2027-01-01',maintenance_status:'ACTIVE'
};

const exact=deriveDigitalTwinComponentReadiness(exactEntity,[exactAsset],DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(exact.state,'EXACT_TWIN_READY');
assert.equal(exact.demoReady,true);
assert.equal(exact.exactProductTwin,true);
assert.equal(exact.assetCode,'EVSE-1');
assert.equal(exact.dirFinalized,true);
assert.equal(exact.maintenanceConfigured,true);
assert.equal(exact.blockerCodes.length,0);
assert.ok(exact.warningCodes.includes('PHYSICAL_IDENTITY_NOT_VERIFIED'));
assert.ok(exact.warningCodes.includes('PHYSICAL_POSITION_NOT_VERIFIED'));
assert.equal(exact.physicalTruth,false);
assert.equal(exact.asBuiltAuthority,false);

const familyEntity={
  id:'msb-1',name:'MSB-1 MAIN SWITCHBOARD',source:'E1.01.pdf',layer:'L2',kind:'text-asset-candidate',
  x:2,y:3,z:0,confidence:.9,
  meta:{...baseMeta,assetTag:'MSB-1',zConstraintGraph:resolvedZ}
};
const familyAsset={
  ...exactAsset,id:'asset-msb-1',asset_code:'MSB-1',asset_type:'SWITCHBOARD',name:'Main Switchboard',
  model:null,serial_number:null,manufacturer_name:null,ledger_tx_hash:null,ledger_block_height:null,
  maintenance_plan_id:null,maintenance_status:null,maintenance_interval_days:null
};
const family=deriveDigitalTwinComponentReadiness(familyEntity,[familyAsset],DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(family.state,'FAMILY_TWIN_READY');
assert.equal(family.demoReady,true);
assert.equal(family.exactProductTwin,false);
assert.ok(family.warningCodes.includes('PRODUCT_IDENTITY_NOT_EXACT'));
assert.ok(family.warningCodes.includes('DIR_NOT_FINALIZED'));
assert.ok(family.warningCodes.includes('MAINTENANCE_NOT_CONFIGURED'));

const unbound=deriveDigitalTwinComponentReadiness(exactEntity,[],DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(unbound.state,'SPATIAL_3D_REVIEW_READY');
assert.equal(unbound.demoReady,false);
assert.ok(unbound.blockerCodes.includes('ASSET_NOT_BOUND'));

const twoD=deriveDigitalTwinComponentReadiness({
  ...familyEntity,id:'msb-2',
  meta:{...familyEntity.meta,zConstraintGraph:unresolvedZ}
},[familyAsset],DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(twoD.state,'SPATIAL_2D_REVIEW_READY');
assert.equal(twoD.demoReady,false);
assert.ok(twoD.blockerCodes.includes('Z_UNRESOLVED'));

const blocked=deriveDigitalTwinComponentReadiness({
  ...familyEntity,id:'msb-3',
  meta:{...familyEntity.meta,zConstraintGraph:conflictedZ}
},[familyAsset],DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(blocked.state,'REVIEW_BLOCKED');
assert.equal(blocked.demoReady,false);
assert.ok(blocked.blockerCodes.includes('Z_CONFLICT'));

const sourceOnly=deriveDigitalTwinComponentReadiness({
  ...familyEntity,id:'msb-4',x:4,y:4,
  meta:{...familyEntity.meta,coordinateUnits:'sheet',symbolAnchorStatus:'UNRESOLVED',spatialPlacementAuthority:'TEXT_LABEL_POSITION_ONLY',zConstraintGraph:unresolvedZ}
},[familyAsset],DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(sourceOnly.state,'SOURCE_ONLY');
assert.ok(sourceOnly.blockerCodes.includes('XY_NOT_METRIC'));

const project=deriveDigitalTwinProjectReadiness(
  [exactEntity,familyEntity,{...familyEntity,id:'msb-2',meta:{...familyEntity.meta,zConstraintGraph:unresolvedZ}},{...familyEntity,id:'msb-3',meta:{...familyEntity.meta,zConstraintGraph:conflictedZ}}],
  [exactAsset,familyAsset],
  DEFAULT_ELECTRICAL_MODEL_REGISTRY
);
assert.equal(project.totalEquipment,4);
assert.equal(project.exactTwinReady,1);
assert.equal(project.familyTwinReady,1);
assert.equal(project.spatial2DReviewReady,1);
assert.equal(project.reviewBlocked,1);
assert.equal(project.demoReady,2);
assert.equal(project.assetBound,4);
assert.equal(project.dirFinalized,1);
assert.equal(project.maintenanceConfigured,1);
assert.equal(project.physicalTruth,false);
assert.equal(project.asBuiltAuthority,false);
assert.equal(project.blockerCounts.Z_UNRESOLVED,1);
assert.equal(project.blockerCounts.Z_CONFLICT,1);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/deriveDigitalTwinProjectReadiness/);
assert.match(viewer,/Digital twin readiness/);
assert.match(viewer,/demo-ready/);
assert.match(viewer,/Exact product twin/);
assert.match(viewer,/DIR finalized/);
assert.match(viewer,/Maintenance configured/);
assert.match(viewer,/Design\/review readiness only/);

console.log('Digital twin readiness passed: project/component states expose the real XY/Z/model/asset/DIR/maintenance chain, exact and family twins remain distinct, unresolved/conflicting evidence blocks readiness, and demo readiness never promotes physical/as-built truth.');
