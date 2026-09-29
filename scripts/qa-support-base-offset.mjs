import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractSupportOffsetEvidence,enrichSupportBaseOffsets} from '../lib/support-base-evidence.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';

const close=(a,b,t=1e-6)=>Math.abs(Number(a)-Number(b))<=t;

const tagged=extractSupportOffsetEvidence({
 items:[{text:'XFMR T1 6" CONC PAD',x:.25,y:.25}],
 source:'E-101.pdf',page:1,planeWidth:20,planeHeight:20
});
assert.equal(tagged.length,1);
assert.equal(tagged[0].kind,'PAD');
assert.equal(tagged[0].assetTag,'XFMR T1');
assert.ok(close(tagged[0].heightMeters,.1524));

const taggedEntities=enrichSupportBaseOffsets([
 {id:'t1',name:'DRY TYPE TRANSFORMER T1',kind:'text-asset-candidate',x:-5,y:5,meta:{page:1}},
 {id:'g1',name:'GENERATOR G1',kind:'text-asset-candidate',x:4,y:4,meta:{page:1}}
],tagged);
assert.ok(close(taggedEntities[0].meta?.supportBaseOffsetMeters,.1524));
assert.equal(taggedEntities[0].meta?.supportOffsetAuthority,'TAG_LINKED_SOURCE_SUPPORT_NOTE');
assert.equal(taggedEntities[1].meta?.supportBaseOffsetMeters,undefined);

const generic=extractSupportOffsetEvidence({
 items:[{text:'6" CONCRETE PAD',x:.5,y:.5}],
 source:'E-101.pdf',page:1,planeWidth:20,planeHeight:20
});
const unique=enrichSupportBaseOffsets([
 {id:'gen-near',name:'GENERATOR G1',kind:'text-asset-candidate',x:.12,y:0,meta:{page:1}},
 {id:'gen-far',name:'GENERATOR G2',kind:'text-asset-candidate',x:1.4,y:0,meta:{page:1}}
],generic);
assert.ok(close(unique[0].meta?.supportBaseOffsetMeters,.1524));
assert.equal(unique[0].meta?.supportOffsetAuthority,'UNIQUE_NEAREST_SOURCE_SUPPORT_NOTE');
assert.equal(unique[1].meta?.supportBaseOffsetMeters,undefined);

const ambiguous=enrichSupportBaseOffsets([
 {id:'a',name:'GENERATOR G1',kind:'text-asset-candidate',x:-.2,y:0,meta:{page:1}},
 {id:'b',name:'GENERATOR G2',kind:'text-asset-candidate',x:.2,y:0,meta:{page:1}}
],generic);
assert.equal(ambiguous[0].meta?.supportBaseOffsetMeters,undefined);
assert.equal(ambiguous[1].meta?.supportBaseOffsetMeters,undefined);

const fractional=extractSupportOffsetEvidence({
 items:[{text:'HOUSEKEEPING PAD 6 1/2"',x:.5,y:.5}],
 source:'E-201.pdf',page:2,planeWidth:20,planeHeight:20
});
assert.equal(fractional[0].kind,'HOUSEKEEPING_PAD');
assert.ok(close(fractional[0].heightMeters,6.5*.0254));

const excluded=extractSupportOffsetEvidence({
 items:[
  {text:'TYPICAL 6" CONC PAD',x:.2,y:.2},
  {text:'TOP OF SLAB 6"',x:.4,y:.2},
  {text:'PAD MOUNTED XFMR T1',x:.6,y:.2}
 ],
 source:'E-101.pdf',page:1,planeWidth:20,planeHeight:20
});
assert.equal(excluded.length,0);

const localPlacement=resolveAssetPlacement({
 name:'PAD MOUNT TRANSFORMER T1',
 floor:'UNRESOLVED',z:0,
 meta:{
  localReviewSurfaceZ:30.48,
  localReviewSurfaceKind:'GRADE',
  localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',
  localReviewSurfaceConfidence:.82,
  supportBaseOffsetMeters:.1524,
  supportOffsetKind:'PAD',
  supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',
  supportOffsetConfidence:.94,
  supportOffsetEvidenceLabel:'XFMR T1 6" CONC PAD',
  supportOffsetSource:'E-101.pdf',
  physicalElevationKnown:false,elevationKnown:false
 }
});
assert.equal(localPlacement.zAuthority,'SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET');
assert.ok(close(localPlacement.baseZ,30.6324));
assert.equal(localPlacement.recommendation?.kind,'SOURCE_SUPPORT_BASE_OFFSET_ON_REVIEW_SURFACE');
assert.equal(localPlacement.recommendation?.evidenceClass,'SOURCE_SPEC');
assert.equal(localPlacement.physicalTruth,false);

const crossSheetPlacement=resolveAssetPlacement({
 name:'GENERATOR G1',floor:'UNRESOLVED',z:0,
 meta:{
  crossSheetReviewSurfaceZ:31.2,
  crossSheetReviewSurfaceKind:'GRADE',
  crossSheetReviewSurfaceAuthority:'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE',
  crossSheetReviewSurfaceConfidence:.8,
  supportBaseOffsetMeters:.2,
  supportOffsetKind:'CURB',
  supportOffsetConfidence:.9,
  supportOffsetEvidenceLabel:'GENERATOR G1 CURB 200 MM',
  physicalElevationKnown:false,elevationKnown:false
 }
});
assert.equal(crossSheetPlacement.zAuthority,'SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET');
assert.ok(close(crossSheetPlacement.baseZ,31.4));

const relativeOnly=resolveAssetPlacement({
 name:'GENERATOR G1',floor:'UNRESOLVED',z:0,
 meta:{supportBaseOffsetMeters:.2,supportOffsetKind:'CURB',supportOffsetConfidence:.9,physicalElevationKnown:false,elevationKnown:false}
});
assert.equal(relativeOnly.zAuthority,'RELATIVE_TO_REVIEW_PLANE');
assert.ok(close(relativeOnly.baseZ,.2));
assert.equal(relativeOnly.physicalTruth,false);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/extractSupportOffsetEvidence/);
assert.match(compiler,/enrichSupportBaseOffsets/);
assert.match(compiler,/support-offset-evidence/);

const placement=fs.readFileSync('lib/asset-placement.ts','utf8');
assert.match(placement,/SUPPORT_SURFACE_PLUS_SOURCE_BASE_OFFSET/);
assert.match(placement,/supportBaseOffsetMeters/);
assert.match(placement,/SOURCE_SUPPORT_BASE_OFFSET_ON_REVIEW_SURFACE/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Support base offset/);
assert.match(inspector,/Support offset authority/);

console.log('Support-base Z passed: tagged and unique-nearest pad evidence, ambiguous fail-closed linking, fractional inch parsing, local/cross-sheet surface composition, and review-plane fallback.');
