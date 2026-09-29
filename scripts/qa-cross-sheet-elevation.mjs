import assert from 'node:assert/strict';
import fs from 'node:fs';
import {enrichCrossSheetElevationSurfaces} from '../lib/cross-sheet-elevation.ts';

const refSha='a'.repeat(64),movingSha='b'.repeat(64),refKey=`${refSha}:1`,movingKey=`${movingSha}:2`,alignmentId=`${refKey}->${movingKey}`;
const terrain={
 id:'terrain',source:'Civil Grading.pdf',kind:'elevation-review-surface-triangle',x:10/3,y:10/3,floor:'UNRESOLVED',confidence:.9,
 vertices:[{x:0,y:0},{x:10,y:0},{x:0,y:10}],
 meta:{sourceSha256:refSha,page:1,elevationTriangle:{id:'grade-tri',kind:'GRADE',zMeters:[30,31,32]},physicalTruth:false,reviewRequired:true}
};
const asset={
 id:'evse',source:'Electrical Site Plan.pdf',kind:'text-asset-candidate',x:2,y:2,floor:'UNRESOLVED',confidence:.82,
 meta:{sourceSha256:movingSha,page:2,planType:'SITE_PLAN',autoSheetAlignmentCandidateId:alignmentId,alignmentReferenceKey:refKey,alignmentProposalConfidence:.8,alignmentRmsResidual:.12,alignmentVerified:false,physicalElevationKnown:false}
};
const enriched=enrichCrossSheetElevationSurfaces([terrain,asset]);
const resolved=enriched.find(entity=>entity.id==='evse');
assert.ok(resolved);
assert.ok(Math.abs(Number(resolved.meta?.crossSheetReviewSurfaceZ)-30.6)<1e-9);
assert.equal(resolved.meta?.crossSheetReviewSurfaceAuthority,'ALIGNED_SOURCE_ELEVATION_TRIANGLE');
assert.equal(resolved.meta?.crossSheetReviewSurfaceSource,'Civil Grading.pdf');
assert.equal(resolved.meta?.crossSheetReviewSurfaceSourceFrameKey,refKey);
assert.equal(resolved.meta?.crossSheetReviewSurfaceConfidence,.8);
assert.equal(resolved.meta?.crossSheetReviewSurfaceAlignmentConfidence,.8);
assert.equal(resolved.meta?.physicalTruth,false);
assert.equal(resolved.meta?.reviewRequired,true);

const outside=enrichCrossSheetElevationSurfaces([terrain,{...asset,id:'outside',x:20,y:20}]).find(entity=>entity.id==='outside');
assert.equal(outside?.meta?.crossSheetReviewSurfaceZ,undefined);

const localWins=enrichCrossSheetElevationSurfaces([terrain,{...asset,id:'local',meta:{...asset.meta,localReviewSurfaceZ:29.5}}]).find(entity=>entity.id==='local');
assert.equal(localWins?.meta?.crossSheetReviewSurfaceZ,undefined);
assert.equal(localWins?.meta?.localReviewSurfaceZ,29.5);

const floorSurface={...terrain,id:'floor-tri',floor:'L1',meta:{...terrain.meta,elevationTriangle:{id:'floor-tri',kind:'FINISHED_FLOOR',zMeters:[4,4,4]}}};
const upperAsset={...asset,id:'upper',floor:'L2',meta:{...asset.meta,planType:'FLOOR_PLAN'}};
const mismatch=enrichCrossSheetElevationSurfaces([floorSurface,upperAsset]).find(entity=>entity.id==='upper');
assert.equal(mismatch?.meta?.crossSheetReviewSurfaceZ,undefined);

const manualSurface={...terrain,id:'manual-terrain',meta:{...terrain.meta,sourceSha256:'c'.repeat(64),page:1,coordinateUnits:'m_xy',planXYValidated:true,planXYValidationResidualMeters:.05,planXYValidationToleranceMeters:.25}};
const manualAsset={...asset,id:'manual-asset',meta:{...asset.meta,sourceSha256:'d'.repeat(64),page:1,autoSheetAlignmentCandidateId:undefined,alignmentProposalConfidence:undefined,coordinateUnits:'m_xy',planXYValidated:true,planXYValidationResidualMeters:.05,planXYValidationToleranceMeters:.25}};
const manual=enrichCrossSheetElevationSurfaces([manualSurface,manualAsset]).find(entity=>entity.id==='manual-asset');
assert.ok(Math.abs(Number(manual?.meta?.crossSheetReviewSurfaceZ)-30.6)<1e-9);
assert.equal(manual?.meta?.crossSheetReviewSurfaceAlignmentConfidence,.94);
assert.equal(manual?.meta?.crossSheetReviewSurfaceConfidence,.9);

const unvalidated=enrichCrossSheetElevationSurfaces([manualSurface,{...manualAsset,id:'unvalidated',meta:{...manualAsset.meta,planXYValidated:false}}]).find(entity=>entity.id==='unvalidated');
assert.equal(unvalidated?.meta?.crossSheetReviewSurfaceZ,undefined);

const restored=enrichCrossSheetElevationSurfaces(enriched.map(entity=>entity.id==='evse'?{...entity,meta:{...entity.meta,autoSheetAlignmentCandidateId:undefined,alignmentReferenceKey:undefined,alignmentProposalConfidence:undefined}}:entity));
assert.equal(restored.find(entity=>entity.id==='evse')?.meta?.crossSheetReviewSurfaceZ,undefined);

const autoReview=fs.readFileSync('components/AutoSheetAlignmentReview.tsx','utf8');
assert.match(autoReview,/original\.vertices\?\.map/);
assert.match(autoReview,/x2:end\.x,y2:end\.y/);
assert.match(autoReview,/alignmentProposalConfidence:proposal\.confidence/);
assert.match(autoReview,/enrichCrossSheetElevationSurfaces/);

const manualReview=fs.readFileSync('components/ManualSheetXYCalibrationReview.tsx','utf8');
assert.match(manualReview,/enrichCrossSheetElevationSurfaces/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/crossSheetReviewSurfaceZ/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Cross-sheet surface authority/);
assert.match(inspector,/Alignment confidence/);

console.log('Cross-sheet elevation transfer passed: aligned terrain inheritance, floor compatibility, alignment-confidence capping, local precedence, outside-envelope fail-closed behavior, reversible provenance, and full-geometry alignment.');
