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

// A drafted dimension: the dimension line overshoots two extension lines that cross it, label centred above.
const dimension=(text,x,y,length,overshoot=.03)=>({
  items:[{text,x:x+length/2,y:y+.02}],
  segments:[
    {x:x-overshoot,y,x2:x+length+overshoot,y2:y},
    {x,y:y-.2,x2:x,y2:y+.05},
    {x:x+length,y:y-.2,x2:x+length,y2:y+.05}
  ]
});
const drawing=(...parts)=>({items:parts.flatMap(p=>p.items),segments:parts.flatMap(p=>p.segments)});
// The PDF workers pass 0–1 page coordinates (coordinateSpan:1). The same drawing must validate identically
// there; Brynhurst's correct 1/8" scale read 6.2x wrong when thresholds were applied in 0–1 space.
const toPageSpace=({items,segments})=>({items:items.map(i=>({...i,x:i.x/20,y:i.y/20})),segments:segments.map(s=>({x:s.x/20,y:s.y/20,x2:s.x2/20,y2:s.y2/20}))});
const validate=(sheet,space,{declaredScale='1" = 20\'-0"',pageMaxDimensionPoints=pageMax}={})=>validateIndependentScale({
  declaredScale,pageMaxDimensionPoints,normalizedSheetSpan:20,coordinateSpan:space==='page'?1:20,...(space==='page'?toPageSpace(sheet):sheet)
});

for(const space of ['normalized','page']){
  const corroborated=validate(dimension("20'-0\"",0,0,segmentLength),space);
  assert.equal(corroborated.status,'CORROBORATED',`${space}: one drafted dimension corroborates`);
  assert.ok(close(corroborated.declaredMetersPerNormalizedSheetUnit,expected,1e-6));
  assert.ok(close(corroborated.corroboratedMetersPerNormalizedSheetUnit,expected,1e-6),`${space}: measured between extension lines, not dimension-line ends`);
  assert.equal(corroborated.autoApply,false);
  assert.equal(corroborated.geometryScaleAuthority,false);
  assert.equal(corroborated.reviewRequired,true);
  assert.equal(corroborated.automationEligible,false,'one witness is reviewable but must not auto-apply metric XY');

  const autoCorroborated=validate(drawing(dimension("20'-0\"",0,0,segmentLength),dimension("20'-0\"",0,.6,segmentLength),dimension("20'-0\"",0,1.2,segmentLength)),space);
  assert.equal(autoCorroborated.status,'CORROBORATED');
  assert.equal(autoCorroborated.automationEligible,false,'even redundant witnesses cannot authorize automatic XY');
  assert.equal(autoCorroborated.independentWitnessCount,3);
  assert.equal(autoCorroborated.witnessTypeCount,1);
  assert.match(autoCorroborated.automationReason,/Human-confirm manual XY pairs/);

  assert.equal(validate(dimension("40'-0\"",0,0,segmentLength),space).status,'MISMATCH');

  // A bare line under a label is not a dimension: without extension lines it is no witness at all.
  const bare=validate({items:[{text:"20'-0\"",x:segmentLength/2,y:.04}],segments:[{x:0,y:0,x2:segmentLength,y2:0}]},space);
  assert.equal(bare.status,'UNRESOLVED',`${space}: a lone line is not a dimension witness`);

  // A long wall beside the label, and a text box tighter around it than the dimension line, are both
  // closer candidates that must lose to the real dimension line.
  const cx=segmentLength/2;
  const crowded=validate(drawing(
    dimension("20'-0\"",0,0,segmentLength),
    {items:[],segments:[{x:-2,y:.08,x2:8,y2:.08}]},
    {items:[],segments:[{x:cx-.12,y:.008,x2:cx+.12,y2:.008},{x:cx+.12,y:.008,x2:cx+.12,y2:.04},{x:cx+.12,y:.04,x2:cx-.12,y2:.04},{x:cx-.12,y:.04,x2:cx-.12,y2:.008}]}
  ),space);
  assert.equal(crowded.status,'CORROBORATED',`${space}: wall and text box are not mistaken for the dimension`);
  assert.equal(crowded.witnesses.length,1);
  assert.ok(close(crowded.corroboratedMetersPerNormalizedSheetUnit,expected,1e-6));

  // Consensus: a clear majority (≥5 witnesses, ≥60%) agreeing with the declared scale corroborates it even
  // when a few labels paired with the wrong line; outliers stay listed but unused. Otherwise still MISMATCH.
  const rows=(good,bad)=>drawing(...Array.from({length:good+bad},(_,i)=>dimension(i<good?"20'-0\"":"40'-0\"",0,i*.6,segmentLength)));
  const majority=validate(rows(5,2),space);
  assert.equal(majority.status,'CORROBORATED',`${space}: 5 of 7 agreeing witnesses corroborate the declared scale`);
  assert.ok(close(majority.corroboratedMetersPerNormalizedSheetUnit,expected,1e-6),'the corroborated value comes from the agreeing witnesses only');
  assert.deepEqual(majority.agreement,{agreeing:5,usable:7});
  assert.equal(majority.independentWitnessCount,5);
  assert.equal(majority.witnesses.length,7,'outliers are kept as evidence');
  assert.ok(majority.confidence>=.6,'a clear majority stays reviewable');
  assert.equal(majority.automationEligible,false);
  assert.equal(validate(rows(3,3),space).status,'MISMATCH',`${space}: an even split is not a consensus`);
  assert.equal(validate(rows(3,1),space).status,'MISMATCH',`${space}: four witnesses are too few for a consensus`);

  const graphicStep=(10*0.3048)/expected;
  const graphic=validate({
    items:[
      {text:'0',x:0,y:1},{text:'10',x:graphicStep,y:1},{text:'20',x:graphicStep*2,y:1},{text:'30',x:graphicStep*3,y:1},
      {text:'FEET',x:graphicStep*1.5,y:1.02}
    ],
    segments:[]
  },space);
  assert.equal(graphic.status,'CORROBORATED',`${space}: graphic scale bar corroborates`);
  assert.ok(graphic.witnesses.some(w=>w.type==='GRAPHIC_SCALE'));

  const rasterReview=validate(dimension("20'-0\"",0,0,.5),space,{pageMaxDimensionPoints:null});
  assert.equal(rasterReview.status,'REVIEW');
  assert.equal(rasterReview.declaredMetersPerNormalizedSheetUnit,null);
}

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
