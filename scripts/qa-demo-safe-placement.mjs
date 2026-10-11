import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';
import {planUniformMeterScale} from '../lib/model-scale.ts';
import {unresolvedAssetVisual} from '../lib/unresolved-asset-visual.ts';

const tesla=resolveAssetPlacement({
  name:'Tesla Supercharger V3 reference.glb',
  floor:'UNRESOLVED',
  z:0,
  meta:{physicalElevationKnown:false,elevationKnown:false}
});
assert.equal(tesla.dimensions.authority,'STRATUM_NOMINAL');
assert.deepEqual(
  [tesla.dimensions.width,tesla.dimensions.height,tesla.dimensions.depth],
  [.6,1.45,.42]
);
assert.equal(tesla.zAuthority,'UNRESOLVED');
assert.equal(tesla.baseZ,0);
assert.equal(tesla.recommendation?.kind,'EVSE_MOUNTING_TYPE_REQUIRED');

const sourceDesign=resolveAssetPlacement({
  name:'PANEL LP-2',
  floor:'L2',
  z:0,
  meta:{
    physicalElevationKnown:false,
    elevationKnown:false,
    zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',
    zCandidateMeters:5.4864,
    zResolutionConfidence:.86,
    zResolutionAuthority:'FLOOR_DATUM_PLUS_AFF'
  }
});
assert.equal(sourceDesign.zAuthority,'SOURCE_DESIGN_CANDIDATE');
assert.ok(Math.abs(sourceDesign.baseZ-5.4864)<1e-9);
assert.equal(sourceDesign.physicalTruth,false);

const plan=planUniformMeterScale(
  [11.616250038,22.794077901,5.697649956],
  [tesla.dimensions.width,tesla.dimensions.height,tesla.dimensions.depth],
  .08
);
assert.ok(plan.scalar<.08);
assert.ok(plan.predicted[0]<1.3);
assert.ok(plan.predicted[1]<2.6);
assert.ok(plan.predicted[2]<1.0);
assert.equal(plan.reviewRequired,true);

const placement=fs.readFileSync('lib/asset-placement.ts','utf8');
assert.doesNotMatch(placement,/return-4\*Number/);
assert.doesNotMatch(placement,/\)\-1\)\*4/);
assert.doesNotMatch(placement,/ROOF'\)return 12/);
assert.match(placement,/REVIEW_PLANE_ONLY/);
assert.match(placement,/SOURCE_DESIGN_CANDIDATE/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/placement\.dimensions\.width/);
assert.match(viewer,/sourceModelBounds/);
assert.match(viewer,/zDisplayAuthority=placement\.zAuthority/);
assert.match(viewer,/root\.position\.set\(e\.x,placement\.baseZ,e\.y\)/);
assert.match(viewer,/zCandidateMeters/);
assert.doesNotMatch(viewer,/const target=dimensions as \[number,number,number\]/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/IMPORTED 3D GEOMETRY · REVIEW-SCALE/);
assert.match(inspector,/Review plane · physical Z unresolved/);
assert.match(inspector,/m candidate/);

console.log('Demo-safe placement passed: Tesla reference GLB normalized to review envelope, unresolved Z uses review plane only, and source-design Z candidates remain reviewable.');


const withoutZ=unresolvedAssetVisual({layer:'L2',kind:'equipment',x:18,y:7,meta:{elevationKnown:false}});
assert.equal(withoutZ.kind,'GHOST_MARKER');
assert.equal(withoutZ.canonicalZ,null);
assert.equal(withoutZ.takeoffEligible,false);
assert.equal(withoutZ.measurementEligible,false);
assert.equal(withoutZ.exportEligible,false);
const unscaled=unresolvedAssetVisual({layer:'L2',kind:'equipment',x:200,y:390,meta:{coordinateUnits:'sheet'}});
assert.equal(unscaled.kind,'SHEET_PIN','unapproved sheet coordinates must not become metric placement');
assert.equal(unresolvedAssetVisual({layer:'L2',kind:'sheet-callout-candidate',x:1,y:2,meta:{}}).kind,'SHEET_PIN');
assert.equal(unresolvedAssetVisual({layer:'L2',kind:'equipment',x:1,y:2,meta:{physicalElevationKnown:true}}).kind,'NONE');
assert.equal(unresolvedAssetVisual({layer:'L1',kind:'room',x:1,y:2,meta:{}}).kind,'NONE');
assert.match(viewer,/renderProvisionalMarker\(e,provisional.kind\)/);
assert.match(viewer,/root.userData.canonicalZ=null/);
assert.match(viewer,/root.userData.takeoffEligible=false/);
assert.match(viewer,/root.userData.exportEligible=false/);
assert.match(viewer,/GHOST · Z UNRESOLVED/);
assert.doesNotMatch(viewer,/DEFAULT_VISUALIZATION_STORY_SPACING_METERS/);
console.log('A07 unresolved placeholders: selectable review-only ghosts and sheet pins, no canonical Z or takeoff/export authority.');

const {PREVIEW_DEMO_GRAPH,isPreviewDemoEntity}=await import('../lib/preview-synthetic-twin.ts');
const demoEntities=PREVIEW_DEMO_GRAPH.entities.filter(isPreviewDemoEntity).filter(e=>e.layer==='L2');
assert.equal(demoEntities.length,6,'three tiers have two representative assets each');
for(const tier of ['STATED_Z','DERIVED_Z_CANDIDATE','UNRESOLVED_Z'])
 assert.equal(demoEntities.filter(e=>e.meta.demoPlacementTier===tier).length,2);
assert.ok(demoEntities.every(e=>e.id.startsWith('DEMO-SYNTHETIC-')));
assert.ok(demoEntities.every(e=>['UNRESOLVED','INFERRED_PREDICTED'].includes(e.meta.status)));
assert.ok(demoEntities.filter(e=>e.meta.demoPlacementTier==='UNRESOLVED_Z').every(e=>e.meta.status==='UNRESOLVED'));
assert.ok(demoEntities.filter(e=>e.meta.demoPlacementTier!=='UNRESOLVED_Z').every(e=>e.meta.status==='INFERRED_PREDICTED'));
assert.ok(demoEntities.every(e=>e.meta.authorityEligible===false&&e.meta.verificationPromotionEligible===false&&
 e.meta.takeoffEligible===false&&e.meta.measurementEligible===false&&e.meta.exportEligible===false));
assert.ok(demoEntities.every(e=>e.meta.physicalTruth===false&&e.meta.reviewRequired===true));
assert.equal(demoEntities.filter(e=>e.meta.demoPlacementTier==='UNRESOLVED_Z').every(e=>e.z===undefined),true);
assert.ok(demoEntities.filter(e=>e.meta.demoPlacementTier==='DERIVED_Z_CANDIDATE').every(e=>e.z===undefined));
assert.ok(demoEntities.every(e=>e.meta.evidence[0].synthetic===true));
const sourcePage=fs.readFileSync('app/spatial/page.tsx','utf8');
assert.match(sourcePage,/process\.env\.VERCEL_ENV==='preview'/);
const exp=fs.readFileSync('components/SpatialExperience.tsx','utf8');
assert.match(exp,/demoGraph=\{PREVIEW_DEMO_GRAPH\}/);
assert.doesNotMatch(exp,/replaceCurrentSpatialGraph\(PREVIEW_DEMO_GRAPH\)|writePrimarySpatialGraph\(PREVIEW_DEMO_GRAPH\)/);
const demoInspector=fs.readFileSync('components/PreviewDemoAssetInspector.tsx','utf8');
assert.match(demoInspector,/data-demo-readonly="true"/);
assert.doesNotMatch(demoInspector,/onSubmit|fetch\(|POST|set.*Status|approveAsset/);
assert.match(viewer,/if\(demoGraph\)\{setGraph\(demoGraph\);setActiveProjectId\(null\)/);
assert.match(viewer,/demoMode\?<PreviewDemoAssetInspector selected=\{selected\}/);
assert.match(viewer,/root\.userData\.authorityEligible=false/);
console.log('A00 preview fixture: preview-only, exact three tiers, source-marked, isolated read-only graph, no authority channels.');

const {assertNonSyntheticSpatialGraph}=await import('../lib/spatial-browser-recovery.ts');
assert.throws(()=>assertNonSyntheticSpatialGraph(PREVIEW_DEMO_GRAPH),/DEMO \/ SYNTHETIC graphs/);
assert.doesNotThrow(()=>assertNonSyntheticSpatialGraph({sources:[{name:'user source'}],entities:[{id:'real-record'}]}));
const graphStorage=fs.readFileSync('lib/spatial-browser-recovery.ts','utf8');
assert.match(graphStorage,/assertNonSyntheticSpatialGraph\(graph\);/);
assert.match(graphStorage,/export async function writePrimarySpatialGraph/);
assert.match(graphStorage,/export async function protectSpatialGraph/);
console.log('Preview demo graph rejected by primary and recovery persistence interfaces.');
