import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildElevationTriangles,extractPositionedElevationControls,resolveLocalElevationSurface} from '../lib/elevation-surface.ts';

const items=[
 {text:'FG 100.00',x:.20,y:.20},
 {text:'FG 101.00',x:.80,y:.20},
 {text:'FG 102.00',x:.50,y:.80},
 {text:'SITE PLAN',x:.5,y:.05}
];
const controls=extractPositionedElevationControls({
 items,source:'C-2.pdf',page:1,declaredScale:'1" = 10\'-0"',scaleValidation:null,planeWidth:20,planeHeight:14
});
assert.equal(controls.length,3);
assert.ok(controls.every(p=>p.unit==='ft'));
assert.ok(controls.every(p=>p.unitAuthority==='DRAWING_SCALE_CONVENTION'));
assert.ok(Math.abs(controls[0].zMeters-30.48)<1e-6);

const triangles=buildElevationTriangles(controls,'GRADE');
assert.equal(triangles.length,1);
const inside=resolveLocalElevationSurface({x:0,y:0,points:controls,triangles,kind:'GRADE'});
assert.equal(inside.status,'RESOLVED_REVIEW_SURFACE');
assert.ok(inside.zMeters!==null);
assert.ok(Number(inside.zMeters)>30.48&&Number(inside.zMeters)<31.09);
assert.equal(inside.authority,'SOURCE_ELEVATION_TRIANGLE');
assert.equal(inside.physicalTruth,false);
assert.equal(inside.reviewRequired,true);

const outside=resolveLocalElevationSurface({x:9,y:6,points:controls,triangles,kind:'GRADE'});
assert.equal(outside.status,'OUTSIDE_CONTROL_ENVELOPE');
assert.equal(outside.zMeters,null);
assert.equal(outside.authority,'UNRESOLVED');
assert.equal(outside.reviewRequired,true);


const strictControls=extractPositionedElevationControls({
 items:[
  {text:'FFE 15\'-0"',x:.25,y:.25},
  {text:'TOP OF SLAB ELEVATION = 15\'-0"',x:.5,y:.25},
  {text:'TOP OF STEEL ELEVATION 14\'-6 1/2"',x:.75,y:.25},
  {text:'B.O.D. +18\'-0"',x:.25,y:.55},
  {text:'PANEL ELEVATION',x:.5,y:.55},
  {text:'FG 194.56',x:.75,y:.55}
 ],
 source:'Real structural/civil mixed sheet.pdf',page:3,declaredScale:'1" = 20\'-0"',scaleValidation:null,planeWidth:20,planeHeight:20
});
assert.equal(strictControls.length,2);
assert.equal(strictControls[0].kind,'FINISHED_FLOOR');
assert.ok(Math.abs(strictControls[0].zMeters-4.572)<1e-6);
assert.equal(strictControls[1].kind,'GRADE');
assert.ok(Math.abs(strictControls[1].zMeters-(194.56*.3048))<1e-6);
assert.ok(strictControls.every(p=>!/TOP OF SLAB|TOP OF STEEL|B\.O\.D\.|PANEL ELEVATION/.test(p.label)));

const explicitMetric=extractPositionedElevationControls({
 items:[{text:'FG 12.50 M',x:.3,y:.3},{text:'TC 12.65 M',x:.6,y:.3},{text:'FL 12.20 M',x:.45,y:.6}],
 source:'Civil.pdf',page:2,declaredScale:'1:100',scaleValidation:null,planeWidth:20,planeHeight:14
});
assert.equal(explicitMetric.length,3);
assert.ok(explicitMetric.every(p=>p.unit==='m'&&p.unitAuthority==='EXPLICIT_LABEL'));

const ambiguous=extractPositionedElevationControls({
 items:[{text:'FG 194.56',x:.3,y:.3}],
 source:'Civil.pdf',page:2,declaredScale:'1:100',scaleValidation:null,planeWidth:20,planeHeight:14
});
assert.equal(ambiguous.length,0);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/extractPositionedElevationControls/);
assert.match(compiler,/buildElevationTriangles/);
assert.match(compiler,/localReviewSurfaceZ/);
assert.match(compiler,/OUTSIDE_CONTROL_ENVELOPE|RESOLVED_REVIEW_SURFACE/);

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
assert.match(viewer,/elevation-review-surface-triangle/);
assert.match(viewer,/localReviewSurfaceZ/);
assert.match(viewer,/reviewSurface=true/);

const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
assert.match(inspector,/Local surface authority/);
assert.match(inspector,/localReviewSurfaceConfidence/);

console.log('Local elevation surface passed: imperial scale-guided spot elevations, explicit metric controls, bounded triangulation, inside interpolation, outside-envelope fail-closed behavior, and review-only Spatial presentation.');
