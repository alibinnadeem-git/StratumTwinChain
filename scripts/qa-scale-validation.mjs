import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDimensionMeters,validateIndependentScale} from '../lib/scale-validation.ts';

const close=(a,b,t=.01)=>Math.abs(Number(a)-Number(b))<=t;

assert.ok(close(parseDimensionMeters("20'-0\""),6.096,1e-6));
assert.ok(close(parseDimensionMeters('240 IN'),6.096,1e-6));
assert.ok(close(parseDimensionMeters('6.096 M'),6.096,1e-6));

const pageMax=2592;
const expected=240*pageMax*.0254/(72*20);
const segmentLength=6.096/expected;
const corroborated=validateIndependentScale({
  declaredScale:'1" = 20\'-0"',
  pageMaxDimensionPoints:pageMax,
  normalizedSheetSpan:20,
  coordinateSpan:20,
  items:[{text:"20'-0\"",x:segmentLength/2,y:.04}],
  segments:[{x:0,y:0,x2:segmentLength,y2:0}]
});
assert.equal(corroborated.status,'CORROBORATED');
assert.ok(close(corroborated.declaredMetersPerNormalizedSheetUnit,expected,1e-6));
assert.ok(close(corroborated.corroboratedMetersPerNormalizedSheetUnit,expected,.02));
assert.equal(corroborated.autoApply,false);
assert.equal(corroborated.geometryScaleAuthority,false);
assert.equal(corroborated.reviewRequired,true);
assert.equal(corroborated.automationEligible,false,'one witness is reviewable but must not auto-apply metric XY');

const autoCorroborated=validateIndependentScale({
  declaredScale:'1" = 20\'-0"',
  pageMaxDimensionPoints:pageMax,
  normalizedSheetSpan:20,
  coordinateSpan:20,
  items:[
    {text:"20'-0\"",x:segmentLength/2,y:.04},
    {text:"20'-0\"",x:segmentLength/2,y:.34},
    {text:"20'-0\"",x:segmentLength/2,y:.64}
  ],
  segments:[
    {x:0,y:0,x2:segmentLength,y2:0},
    {x:0,y:.3,x2:segmentLength,y2:.3},
    {x:0,y:.6,x2:segmentLength,y2:.6}
  ]
});
assert.equal(autoCorroborated.status,'CORROBORATED');
assert.equal(autoCorroborated.automationEligible,false,'even redundant witnesses cannot authorize automatic XY');
assert.equal(autoCorroborated.independentWitnessCount,3);
assert.equal(autoCorroborated.witnessTypeCount,1);
assert.match(autoCorroborated.automationReason,/Human-confirm manual XY pairs/);

const mismatch=validateIndependentScale({
  declaredScale:'1" = 20\'-0"',
  pageMaxDimensionPoints:pageMax,
  normalizedSheetSpan:20,
  coordinateSpan:20,
  items:[{text:"40'-0\"",x:segmentLength/2,y:.04}],
  segments:[{x:0,y:0,x2:segmentLength,y2:0}]
});
assert.equal(mismatch.status,'MISMATCH');

const graphicStep=(10*0.3048)/expected;
const graphic=validateIndependentScale({
  declaredScale:'1" = 20\'-0"',
  pageMaxDimensionPoints:pageMax,
  normalizedSheetSpan:20,
  coordinateSpan:20,
  items:[
    {text:'0',x:0,y:1},{text:'10',x:graphicStep,y:1},{text:'20',x:graphicStep*2,y:1},{text:'30',x:graphicStep*3,y:1},
    {text:'FEET',x:graphicStep*1.5,y:1.02}
  ],
  segments:[]
});
assert.equal(graphic.status,'CORROBORATED');
assert.ok(graphic.witnesses.some(w=>w.type==='GRAPHIC_SCALE'));

const rasterReview=validateIndependentScale({
  declaredScale:'1" = 20\'-0"',
  pageMaxDimensionPoints:null,
  normalizedSheetSpan:20,
  coordinateSpan:20,
  items:[{text:"20'-0\"",x:.25,y:.03}],
  segments:[{x:0,y:0,x2:.5,y2:0}]
});
assert.equal(rasterReview.status,'REVIEW');
assert.equal(rasterReview.declaredMetersPerNormalizedSheetUnit,null);

const unresolved=validateIndependentScale({
  declaredScale:'1" = 20\'-0"',
  pageMaxDimensionPoints:pageMax,
  items:[{text:'SITE PLAN',x:.5,y:.5}],
  segments:[]
});
assert.equal(unresolved.status,'UNRESOLVED');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/validateIndependentScale/);
assert.match(compiler,/scaleValidationByPage/);
assert.match(compiler,/scaleValidationEvidence/);
assert.match(compiler,/geometryScaleAuthority:false/);
assert.match(compiler,/autoApply:false/);
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/SCALE \{String\(activeScaleValidation\.status/);
assert.match(viewer,/never auto-applied/);

console.log('Independent scale validation passed: dimension/graphic witnesses, redundant-evidence review without auto-application, mismatch detection, raster review-only fallback, and fail-closed physical-position authority.');
