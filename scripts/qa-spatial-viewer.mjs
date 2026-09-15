import assert from 'node:assert/strict';
import fs from 'node:fs';
import {enrichSpatialProjection} from '../lib/spatial-projection.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';

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
console.log('✓ DXF X/Y source scale becomes a metric plan frame while equipment Z remains separately reviewable');

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

const oem=resolveAssetPlacement({name:'PANELBOARD LP-1',floor:'L2',meta:{assetDimensionsMeters:[1.2,2.1,.55],dimensionsSource:'OEM submittal'}});
assert.equal(oem.dimensions.authority,'SOURCE_SPEC');assert.equal(oem.dimensions.height,2.1);assert.equal(oem.zAuthority,'HISTORICAL_RECOMMENDATION');assert.equal(oem.physicalTruth,false);
assert.ok(oem.recommendation?.rangeMeters&&oem.recommendation.constraintMaxMeters);assert.equal(oem.recommendation?.evidenceClass,'CODE_CONSTRAINT');
console.log('✓ OEM/source dimensions outrank registry/nominal geometry while web/code placement remains recommendation-only');

const floorStanding=resolveAssetPlacement({name:'DRY TYPE TRANSFORMER T1',floor:'L2',meta:{}});
assert.equal(floorStanding.baseZ,4);assert.equal(floorStanding.zAuthority,'FLOOR_STANDING_PROFILE');assert.equal(floorStanding.physicalTruth,false);
console.log('✓ floor-standing equipment uses floor elevation as a placement candidate without claiming physical truth');

const projectionSource=fs.readFileSync('lib/spatial-projection.ts','utf8');
const placementSource=fs.readFileSync('lib/asset-placement.ts','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const spatialPage=fs.readFileSync('app/spatial/page.tsx','utf8');
assert.match(viewer,/ViewMode="MODEL"\|"ELECTRICAL"\|"REVIEW"/);assert.match(viewer,/2D spatial fallback/);assert.match(viewer,/SLD → SPATIAL PROJECTION/);
assert.match(spatialPage,/MODEL · ELECTRICAL · REVIEW/);assert.match(spatialPage,/Registered asset operations/);
assert.match(projectionSource,/NEVER_ESTABLISH_PHYSICAL_TRUTH/);assert.match(placementSource,/physicalTruth:false/);
assert.doesNotMatch(projectionSource,/finalizeDIR|PoVI finality|VERIFIED\s*=\s*true/i);
console.log('✓ simplified Spatial UX and truth boundaries are release-gated');

console.log('\nSpatial viewer, metric Z placement and SLD projection contract passed.');
