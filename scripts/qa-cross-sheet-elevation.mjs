import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clearCrossSheetElevationForAlignment,enrichCrossSheetElevationSurfaces} from '../lib/cross-sheet-elevation.ts';
import {resolveAssetPlacement} from '../lib/asset-placement.ts';

const refSha='a'.repeat(64),civilSha='b'.repeat(64),candidateId=`${refSha}:1->${civilSha}:2`;
const base=[
 {
  id:'civil-grade-triangle',source:'C-2.pdf',layer:'L1',kind:'elevation-review-surface-triangle',name:'GRADE review surface',
  x:0,y:-.33,z:31,floor:'UNRESOLVED',confidence:.82,
  vertices:[{x:-2,y:-2},{x:2,y:-2},{x:0,y:2}],
  meta:{sourceSha256:civilSha,page:2,elevationTriangle:{id:'tri-civil-1',kind:'GRADE',pointIds:['p1','p2','p3'],zMeters:[30,31,32]},physicalElevationKnown:false,physicalTruth:false,reviewRequired:true}
 },
 {
  id:'evse',source:'E-101.pdf',layer:'L2',kind:'text-asset-candidate',name:'EVSE-1',
  x:0,y:0,z:0,floor:'UNRESOLVED',confidence:.9,
  meta:{sourceSha256:refSha,page:1,physicalElevationKnown:false,elevationKnown:false,physicalTruth:false,reviewRequired:true}
 },
 {
  id:'outside',source:'E-101.pdf',layer:'L2',kind:'text-asset-candidate',name:'EVSE-OUTSIDE',
  x:8,y:8,z:0,floor:'UNRESOLVED',confidence:.9,
  meta:{sourceSha256:refSha,page:1,physicalElevationKnown:false,elevationKnown:false}
 },
 {
  id:'strong-z',source:'E-101.pdf',layer:'L2',kind:'text-asset-candidate',name:'PANEL-1',
  x:0,y:0,z:0,floor:'L1',confidence:.9,
  meta:{sourceSha256:refSha,page:1,zCandidateMeters:4.2,zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',physicalElevationKnown:false,elevationKnown:false}
 },
 {
  id:'local-z',source:'E-101.pdf',layer:'L2',kind:'text-asset-candidate',name:'EVSE-LOCAL',
  x:.25,y:0,z:0,floor:'UNRESOLVED',confidence:.9,
  meta:{sourceSha256:refSha,page:1,localReviewSurfaceZ:30.8,physicalElevationKnown:false,elevationKnown:false}
 }
];

const enriched=enrichCrossSheetElevationSurfaces(base,{
 candidateId,
 referenceKey:`${refSha}:1`,
 movingKey:`${civilSha}:2`,
 confidence:.91
});
const evse=enriched.find(entity=>entity.id==='evse');
assert.ok(Number.isFinite(Number(evse?.meta?.crossSheetReviewSurfaceZ)));
assert.ok(Number(evse?.meta?.crossSheetReviewSurfaceZ)>30&&Number(evse?.meta?.crossSheetReviewSurfaceZ)<32);
assert.equal(evse?.meta?.crossSheetReviewSurfaceKind,'GRADE');
assert.equal(evse?.meta?.crossSheetReviewSurfaceAuthority,'HUMAN_CONFIRMED_ALIGNMENT_PLUS_SOURCE_ELEVATION_TRIANGLE');
assert.equal(evse?.meta?.crossSheetReviewSurfaceCandidateId,candidateId);
assert.equal(evse?.meta?.crossSheetReviewSurfaceTriangleId,'civil-grade-triangle');
assert.equal(evse?.meta?.crossSheetReviewSurfaceConfidence,.82);
assert.equal(evse?.meta?.physicalElevationKnown,false);
assert.equal(evse?.meta?.physicalTruth,false);
assert.equal(evse?.meta?.reviewRequired,true);

const crossSheetPedestal={
 ...evse,
 name:'EVSE PEDESTAL-1',
 meta:{...(evse?.meta||{}),mountingType:'pedestal'}
};
const crossPlacement=resolveAssetPlacement(crossSheetPedestal);
assert.equal(crossPlacement.zAuthority,'SOURCE_SUPPORT_SURFACE_CANDIDATE');
assert.ok(Math.abs(crossPlacement.baseZ-Number(evse?.meta?.crossSheetReviewSurfaceZ))<1e-9);
assert.equal(crossPlacement.physicalTruth,false);
assert.match(crossPlacement.recommendation?.source||'',/GRADE review surface/i);

assert.equal(enriched.find(entity=>entity.id==='outside')?.meta?.crossSheetReviewSurfaceZ,undefined);
assert.equal(enriched.find(entity=>entity.id==='strong-z')?.meta?.crossSheetReviewSurfaceZ,undefined);
assert.equal(enriched.find(entity=>entity.id==='local-z')?.meta?.crossSheetReviewSurfaceZ,undefined);

const cleared=clearCrossSheetElevationForAlignment(enriched,candidateId);
const clearedEvse=cleared.find(entity=>entity.id==='evse');
assert.equal(clearedEvse?.meta?.crossSheetReviewSurfaceZ,undefined);
assert.equal(clearedEvse?.meta?.crossSheetReviewSurfaceCandidateId,undefined);
assert.equal(clearedEvse?.meta?.crossSheetReviewSurfaceTriangleId,undefined);

const reverse=[
 {
  id:'ref-floor-triangle',kind:'elevation-review-surface-triangle',name:'FFE surface',x:0,y:0,confidence:.86,
  vertices:[{x:-1,y:-1},{x:1,y:-1},{x:0,y:1}],
  meta:{sourceSha256:refSha,page:1,elevationTriangle:{kind:'FINISHED_FLOOR',zMeters:[4,4,4]}}
 },
 {
  id:'moving-panel',kind:'text-asset-candidate',name:'PANEL LP-2',x:0,y:0,floor:'L2',confidence:.9,
  meta:{sourceSha256:civilSha,page:2,physicalElevationKnown:false,elevationKnown:false}
 }
];
const reverseEnriched=enrichCrossSheetElevationSurfaces(reverse,{
 candidateId,
 referenceKey:`${refSha}:1`,
 movingKey:`${civilSha}:2`,
 confidence:.8
});
assert.equal(reverseEnriched.find(entity=>entity.id==='moving-panel')?.meta?.crossSheetReviewSurfaceZ,4);
assert.equal(reverseEnriched.find(entity=>entity.id==='moving-panel')?.meta?.crossSheetReviewSurfaceKind,'FINISHED_FLOOR');

const review=fs.readFileSync('components/AutoSheetAlignmentReview.tsx','utf8');
assert.match(review,/vertices\.map\(vertex=>transformSheetPoint/);
assert.match(review,/enrichCrossSheetElevationSurfaces/);
assert.match(review,/clearCrossSheetElevationForAlignment/);
assert.match(review,/COORDINATION REVIEW/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/crossSheetReviewSurfaceZ/);
assert.match(viewer,/CROSS-SHEET Z REVIEW SURFACE/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Cross-sheet Z authority/);
assert.match(inspector,/crossSheetReviewSurfaceConfidence/);

console.log('Cross-sheet elevation passed: reviewed alignment transfers source terrain/floor Z across disciplines, stronger local/object evidence wins, outside-envelope assets fail closed, and restore removes derived Z provenance.');
