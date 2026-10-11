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
assert.match(viewer,/renderProvisionalMarker\(e,'GHOST_MARKER'\)/);
assert.match(viewer,/renderProvisionalMarker\(e,'SHEET_PIN'\)/);
assert.match(viewer,/root.userData.canonicalZ=null/);
assert.match(viewer,/root.userData.takeoffEligible=false/);
assert.match(viewer,/root.userData.exportEligible=false/);
assert.match(viewer,/GHOST · Z UNRESOLVED/);
assert.doesNotMatch(viewer,/DEFAULT_VISUALIZATION_STORY_SPACING_METERS/);
console.log('A07 unresolved placeholders: selectable review-only ghosts and sheet pins, no canonical Z or takeoff/export authority.');

const {decideSourceModelVisual}=await import('../lib/spatial-viewer-geometry-policy.ts');
const {DEFAULT_ELECTRICAL_MODEL_REGISTRY}=await import('../lib/electrical-model-registry.ts');
const demoAsset={name:'MAIN SWITCHBOARD',meta:{componentKey:'main-switchboard',
 resolution_state:'RESOLVED',resolutionScore:.92,resolutionMargin:.22,
 resolutionEvidenceKinds:['symbol','schedule'],intakeGateStatus:'PASSED',
 intakeGateBinaryVerified:true,intakeTypeId:'main-switchboard',intakeLicenceTier:'T1'}};
const policyOk=decideSourceModelVisual(demoAsset,DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(policyOk.tier,'RESOLVED_UNVERIFIED');
assert.ok(policyOk.model?.modelUrl.endsWith('main-switchboard.glb'));
assert.equal(policyOk.takeoffEligible,false);
assert.equal(policyOk.measurementEligible,false);
assert.equal(policyOk.exportEligible,false);
assert.equal(decideSourceModelVisual({...demoAsset,meta:{...demoAsset.meta,resolution_state:'FALLBACK'}},
 DEFAULT_ELECTRICAL_MODEL_REGISTRY).tier,'FALLBACK_UNVERIFIED');
for(const altered of [
 {resolutionScore:.84},{resolutionMargin:.14},{resolutionEvidenceKinds:['symbol']},
 {intakeGateStatus:'PENDING'},{intakeGateBinaryVerified:false},{intakeTypeId:'ups'}
]){
 const p=decideSourceModelVisual({...demoAsset,meta:{...demoAsset.meta,...altered}},DEFAULT_ELECTRICAL_MODEL_REGISTRY);
 assert.equal(p.tier,'UNRESOLVED_CLASS_PREVIEW','no threshold or Intake Gate waiver');
}
assert.equal(decideSourceModelVisual({name:'Unknown device',meta:{}},DEFAULT_ELECTRICAL_MODEL_REGISTRY).tier,'UNRESOLVED_NO_MODEL');
const unauthorized=decideSourceModelVisual({name:'Tesla Supercharger V3',meta:{componentKey:'evse-tesla-supercharger-v3',
 resolution_state:'FALLBACK',resolutionScore:.99,resolutionMargin:.5,
 resolutionEvidenceKinds:['symbol','schedule'],intakeGateStatus:'PASSED',
 intakeGateBinaryVerified:true,intakeTypeId:'evse-tesla-supercharger-v3',intakeLicenceTier:'T1'}},DEFAULT_ELECTRICAL_MODEL_REGISTRY);
assert.equal(unauthorized.tier,'UNRESOLVED_NO_MODEL','unlicensed OEM/community geometry cannot be FALLBACK');

const viewerCode=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const inspectorCode=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(viewerCode,/visibleAuthorityLabel=visual.label/);
assert.match(viewerCode,/takeoffEligible=false/);
assert.match(viewerCode,/e.name\+' · '\+visual.label/);
assert.match(inspectorCode,/data-authority="UNVERIFIED"/);
console.log('A07 source-model visualization: existing Tier-1 GLBs for qualified class, all rendered states unverified; threshold/intake fails closed.');
