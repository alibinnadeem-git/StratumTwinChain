import assert from 'node:assert/strict';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {reconcileSpatialEquipmentIdentity} from '../lib/spatial-equipment-identity.ts';
import {resolveSpatialModel} from '../lib/spatial-model-resolution.ts';
import {anchorPdfEquipmentToVectorSymbols} from '../lib/pdf-equipment-symbol-anchor.ts';
import {resolveRegisteredSpatialAsset,spatialAssetDirState} from '../lib/spatial-asset-link.ts';
import {applyReviewedPdfMetricFrame,restoreReviewedPdfMetricFrame} from '../lib/pdf-metric-frame.ts';

const drawingEntity={
  id:'drawing-evse-1',source:'Electrical Plan.pdf',layer:'L2',kind:'text-asset-candidate',
  name:'EVSE-1 EV CHARGER',x:4.42,y:2.08,z:0,confidence:.9,
  meta:{page:2,nonSldPlan:true,planFrameId:'level-1-plan',physicalTruth:false,reviewRequired:true}
};
const scheduleEntity={
  id:'schedule-evse-1',source:'Equipment Schedule.xlsx',layer:'L4',kind:'schedule-powered-equipment-candidate',
  name:'EVSE-1 EV CHARGER',x:0,y:0,z:0,confidence:.96,
  meta:{
    sourceType:'EQUIPMENT_SCHEDULE',nonSpatial:true,assetTag:'EVSE-1',
    manufacturer:'Tesla',model:'Universal Wall Connector Gen 3',
    physicalTruth:false,reviewRequired:true
  }
};

const reconciled=reconcileSpatialEquipmentIdentity([drawingEntity,scheduleEntity]);
const positioned=reconciled.find(entity=>entity.id==='drawing-evse-1');
assert.ok(positioned);
assert.equal(positioned.meta?.assetTag,'EVSE-1');
assert.equal(positioned.meta?.manufacturer,'Tesla');
assert.equal(positioned.meta?.model,'Universal Wall Connector Gen 3');
assert.equal(positioned.meta?.productIdentityPhysicalAssetVerified,false);

const symbol={
  id:'evse-symbol',page:2,planFrameId:'level-1-plan',confidence:.95,
  vertices:[
    {x:4.0,y:1.8},{x:4.4,y:1.8},{x:4.4,y:2.0},{x:4.0,y:2.0},{x:4.0,y:1.8}
  ]
};
const anchored=anchorPdfEquipmentToVectorSymbols([positioned],[symbol])[0];
assert.ok(Math.abs(anchored.x-4.2)<1e-12);
assert.ok(Math.abs(anchored.y-1.9)<1e-12);
assert.equal(anchored.meta?.sourceLabelX,4.42);
assert.equal(anchored.meta?.sourceLabelY,2.08);
assert.equal(anchored.meta?.spatialPlacementAuthority,'SOURCE_VECTOR_SYMBOL_ANCHOR');
assert.equal(anchored.meta?.manufacturer,'Tesla','geometry anchoring must preserve source-reconciled product identity');
assert.equal(anchored.meta?.model,'Universal Wall Connector Gen 3');

const metricCandidate={
  id:'metric-frame:generic-page:0.5',
  frameKey:'a'.repeat(64)+':2',
  source:'Electrical Plan.pdf',
  page:2,
  metersPerSheetUnit:.5,
  declaredMetersPerSheetUnit:.5,
  corroboratedMetersPerSheetUnit:.5,
  confidence:.95,
  witnessCount:2,
  eligible:true,
  reasons:[],
  reviewRequired:true,
  autoApply:false,
  physicalPositionVerified:false,
  zChanged:false
};
const metricReady={
  ...anchored,
  source:'Electrical Plan.pdf',
  meta:{
    ...(anchored.meta||{}),
    sourceSha256:'a'.repeat(64),
    page:2,
    coordinateUnits:'sheet',
    sourceType:'PDF text object'
  }
};
const metricEntity=applyReviewedPdfMetricFrame(metricReady,metricCandidate,'2026-10-05T00:00:00.000Z');
assert.ok(Math.abs(metricEntity.x-2.1)<1e-12);
assert.ok(Math.abs(metricEntity.y-.95)<1e-12);
assert.equal(metricEntity.z,0,'reviewed PDF metric transform must not alter Z');
assert.equal(metricEntity.meta?.coordinateUnits,'m_reviewed_pdf');
assert.equal(metricEntity.meta?.metricFrameAuthority,'HUMAN_REVIEWED_CORROBORATED_PDF_SCALE');
assert.equal(metricEntity.meta?.sourceLabelX,4.42,'source label coordinates remain source-sheet provenance');
assert.equal(metricEntity.meta?.sourceLabelY,2.08);
const restoredMetric=restoreReviewedPdfMetricFrame(metricEntity);
assert.ok(Math.abs(restoredMetric.x-4.2)<1e-12);
assert.ok(Math.abs(restoredMetric.y-1.9)<1e-12);

const model=resolveSpatialModel(anchored,DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(model.componentKey,'evse-tesla-wall-connector-gen3');
assert.equal(model.exactProductIdentity,true);
assert.equal(model.tier,'EXACT_PRODUCT_VISUALIZATION');
assert.ok(model.model?.modelUrl);
assert.equal(model.physicalIdentityVerified,false);

const registeredAssets=[
  {
    id:'registered-evse-1',project_id:'project-1',asset_code:'EVSE-1',asset_type:'EVSE',
    name:'EV Charger 1',model:'Universal Wall Connector Gen 3',serial_number:'TESLA-SERIAL-001',
    location_label:'Garage',status:'ACTIVE',system_name:'EV Charging',manufacturer_name:'Tesla',
    latest_event_type:'COMMISSIONED',latest_event_status:'APPROVED',
    ledger_network:'stratum-devnet-1',ledger_tx_hash:'0x123',ledger_block_height:'880',
    maintenance_plan_id:'maint-1',maintenance_revision:2,maintenance_basis:'OEM',
    maintenance_interval_days:365,maintenance_next_due_at:'2027-01-01',
    maintenance_status:'ACTIVE'
  }
];

const binding=resolveRegisteredSpatialAsset(anchored,registeredAssets);
assert.ok(binding);
assert.equal(binding.asset.id,'registered-evse-1');
assert.equal(binding.method,'EXPLICIT_CODE');
assert.equal(binding.confidence,1);
const dir=spatialAssetDirState(binding);
assert.equal(dir.finalized,true);
assert.equal(dir.blockHeight,'880');
assert.equal(binding.asset.maintenance_plan_id,'maint-1');
assert.equal(binding.asset.maintenance_status,'ACTIVE');

assert.equal(anchored.meta?.physicalTruth,false,'drawing/schedule/model assembly must never become as-built truth merely because the registered asset is linked');
assert.equal(model.physicalIdentityVerified,false,'catalog model selection must remain distinct from installed asset verification');

console.log('Digital twin assembly golden path passed: generic source evidence reconciles schedule identity to positioned drawing equipment, unique source geometry anchors XY/orientation, the Component Library selects the source-supported product model, and the exact source tag opens the corresponding registered asset/DIR/lifecycle/maintenance record without converting design evidence into physical truth.');
