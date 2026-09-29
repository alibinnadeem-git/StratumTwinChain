import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildZSolution,resolveReconciledAssetPlacement} from '../lib/z-solution-chain.ts';

const consistent={
 name:'PAD MOUNT TRANSFORMER T1',floor:'UNRESOLVED',z:0,
 meta:{
  assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[1.7,1.6,1.25],
  localReviewSurfaceZ:30.48,localReviewSurfaceKind:'GRADE',localReviewSurfaceAuthority:'SOURCE_ELEVATION_TRIANGLE',localReviewSurfaceConfidence:.84,
  supportBaseOffsetMeters:.1524,supportOffsetKind:'PAD',supportOffsetAuthority:'TAG_LINKED_SOURCE_SUPPORT_NOTE',supportOffsetConfidence:.94,
  zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:30.65,zCandidateReferencePoint:'BASE',zResolutionConfidence:.9,zResolutionAuthority:'SOURCE_BASE_ELEVATION',
  physicalElevationKnown:false,elevationKnown:false
 }
};
const consistentSolution=buildZSolution(consistent);
assert.equal(consistentSolution.status,'RESOLVED_CANDIDATE');
assert.ok(consistentSolution.candidates.some(c=>c.kind==='SOURCE_REFERENCE'));
assert.ok(consistentSolution.candidates.some(c=>c.kind==='SUPPORT_SURFACE_PLUS_OFFSET'));
assert.equal(consistentSolution.conflicts.length,0);
assert.ok(Math.abs(Number(consistentSolution.baseZ)-30.65)<1e-9);

const conflict={
 ...consistent,
 meta:{...consistent.meta,zCandidateMeters:31.1}
};
const conflictSolution=buildZSolution(conflict);
assert.equal(conflictSolution.status,'CONFLICT');
assert.equal(conflictSolution.baseZ,null);
assert.ok(conflictSolution.conflicts.length>=1);
assert.ok(conflictSolution.conflicts.some(c=>c.deltaMeters>.15));

const reconciled=resolveReconciledAssetPlacement(conflict);
assert.equal(reconciled.solution.status,'CONFLICT');
assert.equal(reconciled.placement.zAuthority,'UNRESOLVED');
assert.ok(Math.abs(reconciled.placement.baseZ-30.48)<1e-9);
assert.equal(reconciled.placement.recommendation?.kind,'Z_CONFLICT_REVIEW_SURFACE');

const centerline={
 name:'PANEL LP-2',floor:'L2',z:0,
 meta:{
  assetDimensionAuthority:'SOURCE_SPEC',assetDimensionsMeters:[.8,1.2,.25],
  reviewSurfaceZ:4.2672,reviewSurfaceKind:'FINISHED_FLOOR',reviewSurfaceAuthority:'SOURCE_PROJECT_DATUM',reviewSurfaceConfidence:.9,
  zResolutionStatus:'RESOLVED_DESIGN_CANDIDATE',zCandidateMeters:5.4864,zCandidateReferencePoint:'CENTERLINE',zResolutionConfidence:.88,zResolutionAuthority:'FLOOR_DATUM_PLUS_AFF_REFERENCE',
  physicalElevationKnown:false,elevationKnown:false
 }
};
const centerlineSolution=buildZSolution(centerline);
assert.equal(centerlineSolution.status,'RESOLVED_CANDIDATE');
assert.ok(Math.abs(Number(centerlineSolution.baseZ)-4.8864)<1e-6);
assert.ok(centerlineSolution.candidates.some(c=>c.steps.some(step=>step.kind==='REFERENCE_TO_BASE')));

const unresolved=buildZSolution({name:'UNKNOWN DEVICE',floor:'UNRESOLVED',z:0,meta:{physicalElevationKnown:false,elevationKnown:false}});
assert.ok(['RELATIVE_ONLY','UNRESOLVED'].includes(unresolved.status));
assert.equal(unresolved.physicalTruth,false);
assert.equal(unresolved.reviewRequired,true);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/resolveReconciledAssetPlacement/);
assert.match(viewer,/zSolutionStatus/);
assert.match(viewer,/zSolutionConflicts/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Z CONFLICT · AUTO-PLACEMENT BLOCKED/);
assert.match(inspector,/Z solution evidence/);
assert.match(inspector,/Z chains compared/);

console.log('Z solution reconciliation passed: independent source-reference and support-surface chains are compared, consistent chains resolve, conflicting chains block auto-placement and fall back to the underlying review surface.');
