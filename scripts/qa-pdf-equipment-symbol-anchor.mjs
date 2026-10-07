import assert from 'node:assert/strict';
import fs from 'node:fs';
import {anchorPdfEquipmentToVectorSymbols} from '../lib/pdf-equipment-symbol-anchor.ts';

const rectangle=(id,cx,cy,w,h,page=1,frame='frame-a')=>({
  id,page,confidence:.94,planFrameId:frame,
  vertices:[
    {x:cx-w/2,y:cy-h/2},{x:cx+w/2,y:cy-h/2},
    {x:cx+w/2,y:cy+h/2},{x:cx-w/2,y:cy+h/2},{x:cx-w/2,y:cy-h/2}
  ]
});

const asset={
  id:'asset-1',kind:'text-asset-candidate',name:'MSB-1 MAIN SWITCHBOARD',
  x:1.42,y:1.08,rotation:17,confidence:.9,
  meta:{page:1,nonSldPlan:true,planFrameId:'frame-a',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',physicalTruth:false,reviewRequired:true}
};
const anchored=anchorPdfEquipmentToVectorSymbols(
  [asset],
  [rectangle('symbol-1',1,1,.6,.25),rectangle('symbol-far',5,5,.5,.3)]
)[0];
assert.ok(Math.abs(anchored.x-1)<1e-12);
assert.ok(Math.abs(anchored.y-1)<1e-12);
assert.ok(Math.abs(Number(anchored.rotation))<1e-12);
assert.equal(anchored.meta?.sourceLabelX,1.42);
assert.equal(anchored.meta?.sourceLabelY,1.08);
assert.equal(anchored.meta?.symbolAnchorStatus,'RESOLVED_REVIEW_CANDIDATE');
assert.equal(anchored.meta?.symbolAnchorAuthority,'UNIQUE_NEAREST_CLOSED_VECTOR_SYMBOL');
assert.equal(anchored.meta?.spatialPlacementAuthority,'SOURCE_VECTOR_SYMBOL_ANCHOR');
assert.equal(anchored.meta?.rotationAuthority,'SOURCE_VECTOR_RECTANGLE_LONG_EDGE');
assert.equal(anchored.meta?.physicalTruth,false);
assert.equal(anchored.meta?.reviewRequired,true);
assert.equal(anchored.meta?.manufacturer,undefined,'geometry anchoring must never create manufacturer identity');
assert.equal(anchored.meta?.model,undefined,'geometry anchoring must never create product-model identity');

const ambiguousAsset={...asset,id:'asset-amb',x:1,y:1};
const ambiguous=anchorPdfEquipmentToVectorSymbols(
  [ambiguousAsset],
  [rectangle('left',.82,1,.2,.2),rectangle('right',1.18,1,.2,.2)],
  {maxDistance:.7,uniquenessMargin:.18,uniquenessRatio:1.55}
)[0];
assert.equal(ambiguous.x,1);
assert.equal(ambiguous.y,1);
assert.equal(ambiguous.meta?.symbolAnchorStatus,'AMBIGUOUS');
assert.equal(ambiguous.meta?.symbolAnchorAuthority,'TEXT_LABEL_POSITION_ONLY');
assert.deepEqual(ambiguous.meta?.symbolAnchorCandidateIds,['left','right']);

const wrongFrame=anchorPdfEquipmentToVectorSymbols(
  [asset],
  [rectangle('frame-b-symbol',1,1,.6,.25,1,'frame-b')]
)[0];
assert.equal(wrongFrame.x,asset.x);
assert.equal(wrongFrame.y,asset.y);
assert.equal(wrongFrame.meta?.symbolAnchorStatus,'UNRESOLVED');

const sld=anchorPdfEquipmentToVectorSymbols(
  [{...asset,id:'sld',meta:{...asset.meta,sldCandidate:true,nonSldPlan:false}}],
  [rectangle('sld-symbol',1,1,.6,.25)]
)[0];
assert.equal(sld.x,asset.x);
assert.equal(sld.meta?.symbolAnchorStatus,undefined,'SLD logical geometry must never become a physical equipment anchor');

const triangle={
  id:'triangle',page:1,confidence:.9,planFrameId:'frame-a',
  vertices:[{x:1,y:.8},{x:1.3,y:1.2},{x:.7,y:1.2},{x:1,y:.8}]
};
const triangleAnchored=anchorPdfEquipmentToVectorSymbols([{...asset,id:'triangle-asset',x:1.2,y:1.1}],[triangle])[0];
assert.equal(triangleAnchored.meta?.symbolAnchorStatus,'RESOLVED_REVIEW_CANDIDATE');
assert.equal(triangleAnchored.meta?.rotationAuthority,'UNRESOLVED');
assert.equal(triangleAnchored.rotation,asset.rotation,'non-rectangular symbol may not invent equipment orientation');

const far=anchorPdfEquipmentToVectorSymbols([{...asset,id:'far',x:8,y:8}],[rectangle('far-symbol',1,1,.4,.3)])[0];
assert.equal(far.x,8);assert.equal(far.y,8);assert.equal(far.meta?.symbolAnchorStatus,'UNRESOLVED');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/anchorPdfEquipmentToVectorSymbols/);
assert.match(compiler,/symbolAnchorPolygons/);
assert.match(compiler,/symbolAnchoredCount/);
assert.ok(
  compiler.indexOf('anchorPdfEquipmentToVectorSymbols(entities,symbolAnchorPolygons)')<
  compiler.indexOf('resolveLocalElevationSurface({'),
  'symbol anchoring must run before local terrain/floor Z lookup'
);

console.log('PDF equipment symbol anchoring passed: unique frame-scoped closed-vector symbols can replace text-label XY, rectangle geometry can source orientation, ambiguity/wrong frames/SLDs fail closed, source label coordinates remain preserved, and anchored XY feeds subsequent local Z lookup.');
