import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildImageOcrEvidence} from '../lib/image-ocr-intelligence.ts';
import {buildPowerIntelligence} from '../lib/power-intelligence.ts';

const result=buildImageOcrEvidence({
 text:'AHU-12 AIR HANDLING UNIT 480V 3PH FLA 15\nP-8 CHW PUMP 460V 3PH MCA 20 MOCP 30',
 source:'M-201-SCAN.png',
 discipline:'Mechanical',
 floor:'L2',
 width:2400,
 height:1800,
 meanConfidence:88
});
assert.equal(result.details.width,2400);
assert.equal(result.details.height,1800);
assert.ok(result.entities.length>=2);
assert.ok(result.entities.every(entity=>entity.meta.nonSpatial===true));
assert.ok(result.entities.every(entity=>entity.meta.physicalTruth===false));
assert.ok(result.entities.every(entity=>entity.meta.ocrAuthority==='REVIEW_ONLY'));
assert.ok(result.entities.every(entity=>entity.meta.geometryAuthority==='NONE'));
assert.ok(result.entities.every(entity=>entity.meta.spatialPlacementAuthority==='OCR_NON_SPATIAL'));
assert.ok(result.entities.every(entity=>entity.confidence<=.66));

const graph={version:'ocr-fixture',createdAt:new Date().toISOString(),sources:[{name:'M-201-SCAN.png',discipline:'Mechanical'}],entities:result.entities,links:[]};
const power=buildPowerIntelligence(graph);
const ahu=power.requirements.find(item=>item.tag==='AHU-12');
assert.ok(ahu);
assert.equal(ahu.voltage,480);
assert.equal(ahu.phase,3);
assert.equal(ahu.fla,15);
assert.equal(ahu.status,'MISSING');
const pump=power.requirements.find(item=>item.tag==='P-8');
assert.ok(pump);
assert.equal(pump.voltage,460);
assert.equal(pump.phase,3);
assert.equal(pump.mca,20);
assert.equal(pump.mocp,30);
assert.equal(pump.status,'MISSING');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
assert.match(compiler,/import\('tesseract\.js'\)/);
assert.match(compiler,/mod\.createWorker\('eng',mod\.OEM\.LSTM_ONLY/);
assert.match(compiler,/buildImageOcrEvidence/);
assert.match(compiler,/ocrSucceeded\?'parsed':'review'/);
assert.doesNotMatch(compiler,/parseImage\(file,level,discipline[\s\S]{0,400}withAssetCandidates/);
console.log('Review-only image OCR evidence, truth boundaries and Expected Power integration passed');
