import assert from 'node:assert/strict';
import fs from 'node:fs';
import {enrichSpatialProjection} from '../lib/spatial-projection.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';
import {planUniformMeterScale} from '../lib/model-scale.ts';
import {DEFAULT_ELECTRICAL_MODEL_REGISTRY} from '../lib/electrical-model-registry.ts';
import {ELECTRICAL_COMPONENTS} from '../lib/electrical-component-library.ts';
import {analyzeSldText,electricalAssetCandidate,sldElectricalFamily} from '../lib/sld-intelligence.ts';
import {analyzeSldText,electricalAssetCandidate,sldElectricalFamily} from '../lib/sld-intelligence.ts';

const tracked=ELECTRICAL_COMPONENTS.filter(item=>item.trackAsAsset);
const mappedProductionModels=DEFAULT_ELECTRICAL_MODEL_REGISTRY.filter(item=>item.modelUrl&&['GLB','GLTF'].includes(item.format));
const mappedKeys=new Set(mappedProductionModels.map(item=>item.componentKey));
assert.equal(tracked.filter(item=>!mappedKeys.has(item.key)).length,0,'every trackable electrical asset class must ship detailed model geometry');
assert.ok(mappedProductionModels.length>=tracked.length,'detailed registry must cover every trackable asset class');
for(const model of mappedProductionModels){
  assert.ok(model.dimensionsMeters?.every(value=>Number.isFinite(value)&&value>0),`${model.componentKey} must have positive target meter dimensions`);
  assert.ok(model.modelUrl.startsWith('/models/'),`${model.componentKey} must use a source-controlled production model path`);
  const filePath='public'+model.modelUrl;
  assert.ok(fs.existsSync(filePath),`${model.componentKey} detailed model must exist in Git at ${filePath}`);
  const bytes=fs.readFileSync(filePath);
  if(model.format==='GLB'){
    assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF',`${model.componentKey} must have glTF binary magic`);
    assert.equal(bytes.readUInt32LE(4),2,`${model.componentKey} must be glTF v2`);
    assert.equal(bytes.readUInt32LE(8),bytes.length,`${model.componentKey} GLB header length must match file length`);
    const jsonLength=bytes.readUInt32LE(12),jsonType=bytes.subarray(16,20).toString('ascii');
    assert.equal(jsonType,'JSON',`${model.componentKey} must expose a JSON first chunk`);
    const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8').trim());
    assert.equal(gltf.asset?.version,'2.0',`${model.componentKey} embedded glTF asset version must be 2.0`);
  }else{
    const gltf=JSON.parse(bytes.toString('utf8'));
    assert.equal(gltf.asset?.version,'2.0',`${model.componentKey} text glTF asset version must be 2.0`);
    assert.ok(String(gltf.buffers?.[0]?.uri||'').startsWith('data:application/octet-stream;base64,'),`${model.componentKey} text glTF must embed its geometry buffer`);
    assert.ok(Array.isArray(gltf.nodes)&&gltf.nodes.length>1,`${model.componentKey} representative glTF must contain detailed multi-part geometry`);
  }
}
console.log(`✓ all ${tracked.length} trackable asset classes resolve to source-controlled detailed glTF/GLB geometry`);

const mmModel=planUniformMeterScale([1700,1600,1250],[1.7,1.6,1.25]);
assert.ok(Math.abs(mmModel.scalar-.001)<1e-12);assert.equal(mmModel.reviewRequired,false);assert.ok(mmModel.maxRelativeError<1e-12);
const mismatchModel=planUniformMeterScale([1,1,1],[2,1,.5]);
assert.equal(mismatchModel.reviewRequired,true,'material axis-ratio disagreement must be review-gated instead of silently stretching manufacturer geometry');
console.log('✓ detailed 3D models normalize to a meter world with uniform scaling and mismatch review');

const cadGraph={version:'fixture',createdAt:new Date().toISOString(),entities:[
 {id:'a',source:'E1.dxf',layer:'L2',kind:'cad-block',name:'PANELBOARD LP-1',x:-10,y:-7,z:0,floor:'L1',confidence:.9,meta:{rawX:100,rawY:0,unitName:'ft',unitToMeters:.3048}},
 {id:'b',source:'E1.dxf',layer:'L2',kind:'cad-block',name:'DRY TYPE TRANSFORMER T1',x:10,y:7,z:0,floor:'L1',confidence:.9,meta:{rawX:200,rawY:10,unitName:'ft',unitToMeters:.3048}},
 {id:'room',source:'E1.dxf',layer:'L1',kind:'room-boundary',name:'Electrical Room',x:0,y:0,z:0,floor:'L1',confidence:.9,vertices:[{x:-10,y:-7},{x:10,y:-7},{x:10,y:7},{x:-10,y:7}],meta:{unitName:'ft',unitToMeters:.3048}}
],links:[],stats:{L0:1,L1:1,L2:2,L3:0,L4:0}};
const metric=enrichSpatialProjection(cadGraph);
const panel=metric.entities.find(entity=>entity.id==='a');
const transformer=metric.entities.find(entity=>entity.id==='b');
const room=metric.entities.find(entity=>entity.id==='room');
assert.equal(panel?.meta?.cadMetricXY,true);assert.equal(panel?.meta?.planCoordinateUnits,'m');assert.equal(panel?.meta?.coordinateUnits,'m_xy');
assert.equal(panel?.meta?.zReviewRequired,true);assert.equal(panel?.meta?.zPlacementAuthority,'HISTORICAL_RECOMMENDATION');
assert.ok(Math.abs(Number(transformer?.x)-30.48)<1e-6,'100 ft X span becomes 30.48 m');
assert.ok(Math.abs(Number(transformer?.y)-3.048)<1e-6,'10 ft Y span becomes 3.048 m');
assert.ok(Math.abs(Number(room?.vertices?.[2]?.x)-30.48)<1e-6,'room geometry uses the same metric X scale');
assert.ok(Math.abs(Number(room?.vertices?.[2]?.y)-3.048)<1e-6,'room geometry uses the same metric Y scale');
const metricAgain=enrichSpatialProjection(metric);
const panelAgain=metricAgain.entities.find(entity=>entity.id==='a');
assert.equal(panelAgain?.meta?.assetDimensionAuthority,'STRATUM_NOMINAL','derived nominal dimensions must not self-promote on a second pass');
assert.equal(panelAgain?.meta?.zPlacementAuthority,'HISTORICAL_RECOMMENDATION');
console.log('✓ DXF X/Y becomes a metric plan frame and repeated enrichment cannot promote dimension/Z authority');

const registry=[{componentKey:'panelboard',format:'GLB',modelUrl:'/panel.glb',scale:1,rotation:[0,0,0],offset:[0,0,0],dimensionsMeters:[1.1,1.9,.28],dimensionsSource:'OEM panel schedule',dimensionsConfidence:.9}];
const sld=enrichSpatialProjection({version:'fixture',createdAt:new Date().toISOString(),entities:[
 {id:'source',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'UTILITY SERVICE',x:0,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'xfmr',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'TRANSFORMER T1',x:2,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'msb',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'MAIN SWITCHBOARD MSB',x:4,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'panel',source:'E-001 Single Line Diagram.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANELBOARD LP-1',x:6,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}}
],links:[],stats:{L0:1,L1:0,L2:4,L3:0,L4:0}},registry);
assert.deepEqual(sld.entities.map(entity=>entity.meta?.sldLogicalDepth),[0,1,2,4]);
assert.ok((sld.links||[]).some(link=>link.type==='SLD_FEEDS'&&link.from==='source'&&link.to==='xfmr'));
assert.ok((sld.links||[]).some(link=>link.type==='SLD_FEEDS'&&link.to==='panel'));
assert.ok(sld.entities.every(entity=>entity.meta?.sldTruthBoundary==='LOGICAL_Z_NEVER_ESTABLISHES_PHYSICAL_ELEVATION'));
const registryPanel=sld.entities.find(entity=>entity.id==='panel');
assert.deepEqual(registryPanel?.meta?.assetDimensionsMeters,[1.1,1.9,.28]);
assert.equal(registryPanel?.meta?.assetDimensionAuthority,'MODEL_REGISTRY');
assert.ok(Number(registryPanel?.scale)>1,'registry height drives visualization scale above nominal panel height');

console.log('✓ SLD equipment receives deterministic logical depth, feeder links and model-registry dimensions');

const fieldNotation=['13.2KV UTILITY SERVICE','XFMR T1 1500 KVA','SWBD MSB-1','MCCB CB-1','PANEL LP-1'];
const fieldEvidence=analyzeSldText(fieldNotation);
assert.equal(fieldEvidence.isSld,true,'real electrical content must identify an SLD even when filename/title lacks the words SLD or single-line');
assert.equal(sldElectricalFamily('XFMR T1'),'TRANSFORMER');
assert.equal(sldElectricalFamily('SWBD MSB-1'),'MAIN_DISTRIBUTION');
assert.equal(sldElectricalFamily('MCCB CB-1'),'PROTECTION');
assert.equal(electricalAssetCandidate('UTILITY SERVICE'),true);
assert.equal(electricalAssetCandidate('PANEL LP-1'),true);
console.log('✓ field SLD abbreviations and content identify electrical hierarchy without relying on the filename');

const contentOnlySld=enrichSpatialProjection({version:'fixture',createdAt:new Date().toISOString(),entities:[
 {id:'source2',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'13.2KV UTILITY SERVICE',x:0,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'xfmr2',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'XFMR T1 1500 KVA',x:2,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'swbd2',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'SWBD MSB-1',x:4,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'breaker2',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'MCCB CB-1',x:5,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}},
 {id:'panel2',source:'E-601.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-1',x:6,y:0,z:0,floor:'L1',confidence:.8,meta:{page:1}}
],links:[],stats:{L0:1,L1:0,L2:5,L3:0,L4:0}},registry);
assert.ok(contentOnlySld.entities.every(entity=>entity.meta?.sldSpatialProjection===true),'content-only SLD objects must enter Spatial electrical projection');
assert.ok((contentOnlySld.links||[]).filter(link=>link.type==='SLD_FEEDS').length>=4,'content-only SLD must produce feeder topology');
assert.deepEqual(contentOnlySld.entities.map(entity=>entity.meta?.sldLogicalDepth),[0,1,2,3,4]);
console.log('✓ generic-named SLD content becomes a Spatial electrical model and feeder graph');


assert.equal(electricalAssetCandidate('XFMR T1'),true);
assert.equal(electricalAssetCandidate('SWBD MSB-1'),true);
assert.equal(electricalAssetCandidate('MCCB-1'),true);
assert.equal(sldElectricalFamily('MDP-1'),'MAIN_DISTRIBUTION');
const inferredSld=analyzeSldText(['UTILITY SERVICE 13.8kV','XFMR T1 1500 KVA','SWBD MSB-1','MCCB-1','PANEL LP-1']);
assert.equal(inferredSld.isSld,true,'real SLD abbreviations and power ratings should identify an SLD page without relying on its filename');
const genericNamedSld=enrichSpatialProjection({version:'fixture',createdAt:new Date().toISOString(),entities:[
 {id:'source2',source:'Electrical Package.pdf',layer:'L2',kind:'text-asset-candidate',name:'UTILITY SERVICE',x:0,y:0,z:0,floor:'L1',confidence:.8,meta:{page:4}},
 {id:'xfmr2',source:'Electrical Package.pdf',layer:'L2',kind:'text-asset-candidate',name:'XFMR T1',x:2,y:0,z:0,floor:'L1',confidence:.8,meta:{page:4}},
 {id:'msb2',source:'Electrical Package.pdf',layer:'L2',kind:'text-asset-candidate',name:'SWBD MSB-1',x:4,y:0,z:0,floor:'L1',confidence:.8,meta:{page:4}},
 {id:'panel2',source:'Electrical Package.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANEL LP-1',x:6,y:0,z:0,floor:'L1',confidence:.8,meta:{page:4}}
],links:[],stats:{L0:1,L1:0,L2:4,L3:0,L4:0}},registry);
assert.equal(genericNamedSld.entities.filter(entity=>entity.meta?.sldSpatialProjection===true).length,4);
assert.ok((genericNamedSld.links||[]).some(link=>link.type==='SLD_FEEDS'),'generic filenames must still project SLD topology when content is sufficient');
console.log('✓ content-based SLD detection handles generic filenames, abbreviations and backward-compatible graphs');


const oem=resolveAssetPlacement({name:'PANELBOARD LP-1',floor:'L2',meta:{oemDimensionsMeters:[1.2,2.1,.55],dimensionsSource:'OEM submittal'}});
assert.equal(oem.dimensions.authority,'SOURCE_SPEC');assert.equal(oem.dimensions.height,2.1);assert.equal(oem.zAuthority,'HISTORICAL_RECOMMENDATION');assert.equal(oem.physicalTruth,false);
assert.ok(oem.recommendation?.rangeMeters&&oem.recommendation.constraintMaxMeters);assert.equal(oem.recommendation?.evidenceClass,'CODE_CONSTRAINT');
console.log('✓ explicit OEM/source dimensions outrank registry/nominal geometry while web/code placement remains recommendation-only');

const floorStanding=resolveAssetPlacement({name:'DRY TYPE TRANSFORMER T1',floor:'L2',meta:{}});
assert.equal(floorStanding.baseZ,4);assert.equal(floorStanding.zAuthority,'FLOOR_STANDING_PROFILE');assert.equal(floorStanding.physicalTruth,false);
console.log('✓ floor-standing equipment uses floor elevation as a placement candidate without claiming physical truth');

const pedestalEvse=resolveAssetPlacement({name:'EV Charging Station',floor:'L2',meta:{mountingType:'pedestal'}});
assert.equal(pedestalEvse.baseZ,4);assert.equal(pedestalEvse.zAuthority,'FLOOR_STANDING_PROFILE');assert.equal(pedestalEvse.recommendation?.kind,'EVSE_PEDESTAL_BASE_ON_FINISHED_FLOOR');assert.equal(pedestalEvse.physicalTruth,false);
console.log('✓ explicitly pedestal-mounted EVSE remains a floor-standing placement candidate');

const teslaEvse=resolveAssetPlacement({name:'EV Charging Station · Tesla Universal Wall Connector',floor:'L2',meta:{manufacturer:'Tesla',model:'Universal Wall Connector',partNumber:'1734412-XX-X',mountingType:'wall-mounted',installationEnvironment:'outdoor'}});
assert.equal(teslaEvse.dimensions.authority,'WEB_OEM_REFERENCE');assert.deepEqual([teslaEvse.dimensions.width,teslaEvse.dimensions.height,teslaEvse.dimensions.depth],[.155,.345,.15]);
assert.ok(Math.abs(teslaEvse.baseZ-5.15)<1e-9);assert.deepEqual(teslaEvse.recommendation?.rangeMeters,[4.6,5.52]);assert.equal(teslaEvse.recommendation?.evidenceClass,'OEM_INSTALLATION_GUIDANCE');assert.equal(teslaEvse.physicalTruth,false);
console.log('✓ identified Tesla Universal Wall Connector uses auditable OEM dimensions and mounting guidance without claiming as-built Z');

const chargePointEvse=resolveAssetPlacement({name:'EV Charging Station · ChargePoint Home Flex CPH50',floor:'L2',meta:{manufacturer:'ChargePoint',model:'Home Flex CPH50',mountingType:'wall-mounted'}});
assert.equal(chargePointEvse.dimensions.authority,'WEB_OEM_REFERENCE');assert.ok(Math.abs(chargePointEvse.dimensions.height-.2843)<1e-9);
assert.ok(Math.abs(chargePointEvse.topZ-5.3)<1e-9);assert.ok(Math.abs(chargePointEvse.baseZ-5.0157)<1e-9);assert.deepEqual(chargePointEvse.recommendation?.rangeMeters,[5,5.1]);assert.equal(chargePointEvse.physicalTruth,false);
console.log('✓ identified ChargePoint Home Flex uses current OEM dimensions and mounting references as recommendation evidence');

const genericWallEvse=resolveAssetPlacement({name:'EV Charging Station',floor:'L2',meta:{mountingType:'wall-mounted'}});
assert.equal(genericWallEvse.zAuthority,'UNRESOLVED');assert.equal(genericWallEvse.recommendation?.kind,'WALL_EVSE_OEM_HEIGHT_REQUIRED');assert.equal(genericWallEvse.dimensions.authority,'STRATUM_NOMINAL');
assert.ok(!/tesla|chargepoint/i.test(genericWallEvse.recommendation?.source||''),'generic EVSE must not silently borrow OEM-specific guidance');assert.equal(genericWallEvse.physicalTruth,false);
console.log('✓ generic wall EVSE fails closed until manufacturer/model-specific mounting evidence is known');

const sourceGuidedEvse=resolveAssetPlacement({name:'EV Charging Station · Tesla Universal Wall Connector',floor:'L2',meta:{manufacturer:'Tesla',model:'Universal Wall Connector',mountingType:'wall-mounted',mountingBaseFromFloorMeters:.92,mountingInstructionSource:'Project-approved OEM submittal',mountingInstructionSourceUrl:'https://project.invalid/oem-submittal',oemDimensionsMeters:[.16,.36,.14],dimensionsSource:'Project OEM submittal'}});
assert.equal(sourceGuidedEvse.dimensions.authority,'SOURCE_SPEC');assert.ok(Math.abs(sourceGuidedEvse.baseZ-4.92)<1e-9);assert.equal(sourceGuidedEvse.recommendation?.kind,'SOURCE_INSTALLATION_BASE_RECOMMENDATION');assert.equal(sourceGuidedEvse.recommendation?.source,'Project-approved OEM submittal');assert.equal(sourceGuidedEvse.physicalTruth,false);
console.log('✓ project/OEM source mounting metadata outranks public web guidance but remains recommendation-only');

const projectionSource=fs.readFileSync('lib/spatial-projection.ts','utf8');
const placementSource=fs.readFileSync('lib/asset-placement.ts','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const spatialExperience=fs.readFileSync('components/SpatialExperience.tsx','utf8');
const spatialPage=fs.readFileSync('app/spatial/page.tsx','utf8');
assert.match(viewer,/normalizeObjectToMeters/);assert.match(viewer,/fitProceduralObjectToMeters/);
assert.doesNotMatch(viewer,/root\.scale\.setScalar\(cfg\.scale\s*\*\s*n\(e\.scale,1\)\)/,'registry GLBs must not use arbitrary display scalar as physical size');
assert.match(viewer,/ViewMode="MODEL"\|"ELECTRICAL"\|"REVIEW"/);assert.match(viewer,/2D spatial fallback/);assert.match(viewer,/SLD → SPATIAL PROJECTION/);
assert.match(viewer,/graph\.entities\.length===0/,'zero-entity graphs must not render an empty project stage');
assert.match(spatialPage,/MODEL · LIVE ASSETS/);assert.match(spatialPage,/MODEL · BROWSER/);assert.match(spatialPage,/<SpatialExperience /);
assert.doesNotMatch(spatialPage,/<CompiledGraphViewer|<TwinWorkspace/,'the route must not stack two viewers');
assert.match(spatialExperience,/state\.hasImportedModel/);
assert.match(spatialExperience,/PROJECT MODEL/);
assert.doesNotMatch(spatialExperience,/TwinWorkspace|DEMONSTRATION DATA|Demonstration model/);
assert.match(spatialExperience,/STRATUM will not show a demonstration building/);
assert.match(spatialExperience,/entities\.length>0/,'project mode requires at least one compiled entity');
assert.match(projectionSource,/NEVER_ESTABLISH_PHYSICAL_TRUTH/);assert.match(placementSource,/physicalTruth:false/);
assert.doesNotMatch(projectionSource,/finalizeDIR|PoVI finality|VERIFIED\s*=\s*true/i);
console.log('✓ single-source Spatial UX, empty-model gate and truth boundaries are release-gated');

console.log('\nSpatial viewer, metric Z placement, EVSE evidence and SLD projection contract passed.');
