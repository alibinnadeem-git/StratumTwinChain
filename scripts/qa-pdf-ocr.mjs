import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildImageOcrEvidence} from '../lib/image-ocr-intelligence.ts';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';
import {drawingMarkEntity} from '../lib/drawing-review.ts';

const mark={id:'pb1',page:2,x:.25,y:.7,width:792,height:612,label:'PB1',reference:'E-101',legend:'E-001 panelboard schedule',component:'panel',drawingState:'existing'};
const reviewed=drawingMarkEntity(mark,'sha256-fixture','test-legend.pdf');
assert.equal(reviewed.meta.page,2);
assert.equal(reviewed.meta.electricalComponentHint,'panel');
assert.equal(reviewed.meta.drawingState,'existing');
assert.equal(reviewed.meta.registrationState,'CANDIDATE');
assert.equal(reviewed.meta.physicalTruth,false);
assert.ok(Math.abs(reviewed.y-(-4*612/792))<1e-9);
assert.throws(()=>drawingMarkEntity({...mark,legend:''},'sha256-fixture','test-legend.pdf'),/legend or schedule/);
assert.equal(drawingMarkEntity({...mark,component:'unresolved',legend:''},'sha256-fixture','test-legend.pdf').meta.electricalComponentHint,undefined);

const evidence=buildImageOcrEvidence({
 text:'RTU-4 ROOFTOP UNIT 208V 3PH FLA 22\nEF-3 EXHAUST FAN 480V 3PH 5HP',
 source:'M-301-SCANNED.pdf',
 discipline:'Mechanical',
 floor:'L3',
 width:2200,
 height:1700,
 meanConfidence:84
});
assert.ok(evidence.entities.length>=2);
assert.ok(evidence.entities.every(entity=>entity.meta.nonSpatial===true&&entity.meta.physicalTruth===false));
const power=buildPowerIntelligence({version:'fixture',createdAt:new Date().toISOString(),sources:[{name:'M-301-SCANNED.pdf',discipline:'Mechanical'}],entities:evidence.entities,links:[]});
const rtu=power.requirements.find(item=>item.tag==='RTU-4');
assert.ok(rtu);assert.equal(rtu.voltage,208);assert.equal(rtu.phase,3);assert.equal(rtu.fla,22);assert.equal(rtu.status,'MISSING');
const fan=power.requirements.find(item=>item.tag==='EF-3');
assert.ok(fan);assert.equal(fan.voltage,480);assert.equal(fan.phase,3);assert.equal(fan.motorHp,5);

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/nativeText\.length<3/);
assert.match(compiler,/page\.render\(\{canvasContext:ctx,viewport:ocrViewport\}\)/);
assert.match(compiler,/PDF_RASTER_OCR_TEXT/);
assert.match(compiler,/coordinateUnits:'NONE'/);
assert.match(compiler,/geometryAuthority:'NONE'/);
assert.match(compiler,/spatialPlacementAuthority:'OCR_NON_SPATIAL'/);
assert.match(compiler,/ocrTextByPage/);
assert.match(compiler,/detectSldPage\(\[\.\.\.raw[\s\S]*ocrTextByPage/);
assert.match(compiler,/if\(ocrWorker\)await ocrWorker\.terminate\(\)/);
assert.doesNotMatch(compiler,/PDF_RASTER_OCR_TEXT'[\s\S]{0,300}(?:x:.*ocr|y:.*ocr|coordinateUnits:'sheet')/);
console.log('Image-only PDF OCR fallback, non-spatial truth boundary and Expected Power integration passed');
