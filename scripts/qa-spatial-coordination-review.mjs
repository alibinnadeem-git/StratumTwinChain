import assert from 'node:assert/strict';
import {buildSpatialCoordinationReviewIndex,findingsForEntity} from '../lib/spatial-coordination-review.ts';

const snapshot={
 version:'1',
 generatedFrom:'fixture',
 findings:[
  {id:'f-rating',findingType:'RATING_CONFLICT',title:'rating',detail:'',entityRefs:['asset-1','schedule-1'],sourceRefs:['E1','M1'],comparison:{},confidence:.9,humanControlLevel:'H3',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'},
  {id:'f-location',findingType:'LOCATION_CONFLICT',title:'location',detail:'',entityRefs:['asset-1'],sourceRefs:['E1','A1'],comparison:{},confidence:.8,humanControlLevel:'H2',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'},
  {id:'f-sheet',findingType:'SHEET_REVISION_CONFLICT',title:'sheet',detail:'',entityRefs:[],sourceRefs:['E1'],comparison:{},confidence:.9,humanControlLevel:'H3',status:'OPEN',truthBoundary:'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW'}
 ],
 summary:{findings:3,high:2,review:1},
 truthBoundary:'COORDINATION_FINDINGS_DO_NOT_ESTABLISH_PHYSICAL_CLASH_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'
};
const index=buildSpatialCoordinationReviewIndex(snapshot);
assert.equal(index.size,2);
const asset=index.get('asset-1');assert.ok(asset);
assert.equal(asset.findingCount,2);assert.equal(asset.highCount,1);assert.equal(asset.reviewCount,1);assert.equal(asset.severity,'H3');
assert.deepEqual(asset.findingTypes.sort(),['LOCATION_CONFLICT','RATING_CONFLICT']);
assert.equal(asset.truthBoundary,'VISUAL_REVIEW_MARKER_NOT_GEOMETRIC_CLASH_OR_ENGINEERING_APPROVAL');
assert.equal(index.has('f-sheet'),false);
assert.equal(findingsForEntity(snapshot,'asset-1').length,2);
assert.equal(findingsForEntity(snapshot,'missing').length,0);
const fs=await import('node:fs');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/buildSpatialCoordinationReviewIndex/);
assert.match(viewer,/coordinationAnchors/);
assert.match(viewer,/dataset\.coordinationAssets/);
assert.match(viewer,/dataset\.coordinationHitX/);
assert.match(viewer,/Selected asset coordination review/);
assert.match(viewer,/not establish a geometric clash, code compliance, AHJ approval, or engineering approval/);
console.log('Spatial coordination review index preserves finding severity and truth boundaries');
