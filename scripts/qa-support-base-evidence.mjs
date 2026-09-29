import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractSupportBaseEvidence,resolveSupportBaseForEntity} from '../lib/support-base-evidence.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';

const items=[
 {text:'XFMR T-1 ON 6" CONCRETE PAD',x:.25,y:.25},
 {text:'PANEL LP-1 - 4" HOUSEKEEPING PAD',x:.55,y:.25},
 {text:'PROVIDE 6" HOUSEKEEPING PAD FOR ELECTRICAL EQUIPMENT',x:.5,y:.55},
 {text:'ATS-1 CURB 100 MM HIGH',x:.75,y:.55}
];
const evidence=extractSupportBaseEvidence({items,source:'E-101.pdf',page:1,planeWidth:20,planeHeight:14});
assert.equal(evidence.length,4);
const xfmr=evidence.find(item=>item.targetTag?.includes('XFMR'));
const panel=evidence.find(item=>item.targetTag?.includes('PANEL'));
const generic=evidence.find(item=>item.targetTag===null);
const ats=evidence.find(item=>item.targetTag?.includes('ATS'));
assert.ok(xfmr&&Math.abs(xfmr.offsetMeters-.1524)<1e-9);
assert.ok(panel&&Math.abs(panel.offsetMeters-.1016)<1e-9);
assert.ok(generic&&generic.confidence<.6);
assert.ok(ats&&Math.abs(ats.offsetMeters-.1)<1e-9);
const metricPad=extractSupportBaseEvidence({items:[{text:'PDU-1 EQUIPMENT PAD 12 CM',x:.2,y:.2}],source:'E-104.pdf',page:4,planeWidth:20,planeHeight:14});
assert.equal(metricPad.length,1);
assert.ok(Math.abs(metricPad[0].offsetMeters-.12)<1e-9);

const xfmrResolution=resolveSupportBaseForEntity({name:'PAD MOUNT TRANSFORMER T-1',meta:{}},evidence);
assert.equal(xfmrResolution.status,'RESOLVED_CANDIDATE');
assert.ok(Math.abs(Number(xfmrResolution.offsetMeters)-.1524)<1e-9);

const genericOnly=extractSupportBaseEvidence({
 items:[{text:'PROVIDE 4" HOUSEKEEPING PAD',x:.5,y:.5}],
 source:'E-102.pdf',page:2,planeWidth:20,planeHeight:14
});
assert.equal(resolveSupportBaseForEntity({name:'PANEL LP-9',meta:{}},genericOnly).status,'UNRESOLVED');

const conflicting=extractSupportBaseEvidence({
 items:[
  {text:'PANEL LP-2 4" HOUSEKEEPING PAD',x:.4,y:.4},
  {text:'PANEL LP-2 6" HOUSEKEEPING PAD',x:.42,y:.42}
 ],
 source:'E-103.pdf',page:3,planeWidth:20,planeHeight:14
});
assert.equal(resolveSupportBaseForEntity({name:'PANEL LP-2',meta:{}},conflicting).status,'CONFLICT');

const placement=resolveAssetPlacement({
 name:'PAD MOUNT TRANSFORMER T-1',floor:'UNRESOLVED',z:0,
 meta:{
  localReviewSurfaceZ:30.7848,
  localReviewSurfaceKind:'GRADE',
  localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',
  localReviewSurfaceConfidence:.82,
  supportBaseOffsetMeters:.1524,
  supportBaseOffsetKind:'CONCRETE_PAD',
  supportBaseOffsetSource:'XFMR T-1 ON 6" CONCRETE PAD',
  physicalElevationKnown:false,elevationKnown:false
 }
});
assert.equal(placement.zAuthority,'SUPPORT_SURFACE_PLUS_MOUNTING_GUIDANCE');
assert.ok(Math.abs(placement.baseZ-(30.7848+.1524))<1e-9);
assert.equal(placement.recommendation?.kind,'SOURCE_SUPPORT_BASE_OFFSET_ON_REVIEW_SURFACE');
assert.equal(placement.recommendation?.evidenceClass,'SOURCE_SPEC');
assert.equal(placement.physicalTruth,false);

const nullSurface=resolveAssetPlacement({
 name:'PAD MOUNT TRANSFORMER T-2',floor:'UNRESOLVED',z:0,
 meta:{localReviewSurfaceZ:null,crossSheetReviewSurfaceZ:null,reviewSurfaceZ:null,physicalElevationKnown:false,elevationKnown:false}
});
assert.equal(nullSurface.zAuthority,'UNRESOLVED');
assert.equal(nullSurface.baseZ,0);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/extractSupportBaseEvidence/);
assert.match(compiler,/resolveSupportBaseForEntity/);
assert.match(compiler,/SOURCE_DRAWING_EXPLICIT_SUPPORT_OFFSET/);
assert.match(compiler,/supportBaseOffsetConflict/);

const placementSource=fs.readFileSync('lib/asset-placement.ts','utf8');
assert.match(placementSource,/supportBaseOffsetMeters/);
assert.match(placementSource,/SOURCE_SUPPORT_BASE_OFFSET_ON_REVIEW_SURFACE/);
assert.match(placementSource,/value===null\|\|value===undefined\|\|value===''/);

console.log('Support-base evidence passed: tagged pad/curb extraction, unlinked-note fail-closed behavior, conflict detection, surface+offset composition, and null-is-not-zero placement semantics.');
