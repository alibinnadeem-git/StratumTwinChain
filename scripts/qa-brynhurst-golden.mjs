import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectPlanFrames,resolveDrawingPageRecognition,resolvePlanFrameAtPoint} from '../lib/plan-recognition.ts';
import {inferPdfPageFloor} from '../lib/compiler-source.ts';
import {drawingScaleDenominator} from '../lib/title-block.ts';
import {extractZEvidenceFromText} from '../lib/z-resolver.ts';
import {analyzeDrawingSetCompleteness} from '../lib/drawing-set-completeness.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/brynhurst-electrical-golden.json'),'utf8'));
const ok=(name,condition)=>{assert.ok(condition,name);console.log(`✓ ${name}`)};

assert.equal(fixture.fixtureId,'SV-GOLDEN-ELECTRICAL-001');
assert.equal(fixture.source.pageCount,9);
assert.equal(fixture.source.sha256,'9ad7aea4dccfe584dd3837796d4b5ba04588aeea8e2b1a90cc547575d4c323ec');
assert.equal(fixture.trustBoundary.authoritativeXYZ,false);
assert.equal(fixture.trustBoundary.physicalTruth,false);
assert.equal(fixture.trustBoundary.reviewRequired,true);
assert.equal(fixture.source.setCompleteness.status,'PARTIAL');
assert.deepEqual(fixture.source.setCompleteness.presentSheets,['E-1','E-2','E-3','E-4','E-5','E-6','E-7','E-8','E-9']);
assert.deepEqual(fixture.source.setCompleteness.missingSheets,['E-10','E-11','E-12','E-13']);
ok('Brynhurst architectural scale normalizes to denominator 96',Math.abs(drawingScaleDenominator('1/8" = 1\'-0"')-96)<1e-9);

for(const page of fixture.pages){
 const recognition=resolveDrawingPageRecognition(page.labels,page.vectorOps||0);
 assert.equal(recognition.sld.isSld,page.expected.sld,`page ${page.page} SLD classification`);
 assert.equal(recognition.plan.isPlan,page.expected.isPlan,`page ${page.page} plan classification`);
 if(page.expected.planType)assert.equal(recognition.plan.planType,page.expected.planType,`page ${page.page} plan type`);
 if(page.expected.discipline)assert.equal(recognition.plan.discipline,page.expected.discipline,`page ${page.page} discipline`);
 const frames=detectPlanFrames(page.positioned||[],recognition.plan);
 if(page.expected.frameFloors){
  assert.deepEqual(new Set(frames.map(frame=>frame.floor)),new Set(page.expected.frameFloors),`page ${page.page} explicit floor/roof/site frames`);
 }
 if(page.expected.unitIds){
  assert.deepEqual(new Set(frames.map(frame=>frame.unitId).filter(Boolean)),new Set(page.expected.unitIds),`page ${page.page} unit-plan viewports`);
  ok(`page ${page.page} unit frames remain non-authoritative`,frames.every(frame=>frame.reviewRequired===true&&frame.physicalTruth===false&&frame.floor===null));
 }
 if(page.expected.pageFloor){
  assert.equal(inferPdfPageFloor(page.labels),page.expected.pageFloor,`page ${page.page} page-level floor must fail closed when multiple levels coexist`);
 }
 for(const check of page.expected.pointChecks||[]){
  const frame=resolvePlanFrameAtPoint(frames,check.x,check.y);
  assert.equal(frame?.floor,check.floor,`page ${page.page} point resolves to ${check.floor} source frame`);
 }
}
console.log('✓ all nine Brynhurst sheets meet the stored comprehension contract');


const completeness=analyzeDrawingSetCompleteness({
 pageLabels:fixture.pages.map(page=>page.labels),
 sheetNumbers:fixture.source.setCompleteness.presentSheets
});
assert.equal(completeness.status,'PARTIAL','E-1 index versus physical title blocks must classify this PDF as a partial electrical set');
assert.deepEqual(completeness.expectedSheets,fixture.source.setCompleteness.indexedSheets,'sheet-index analysis must recover E-1 through E-13');
assert.deepEqual(completeness.missingSheets,fixture.source.setCompleteness.missingSheets,'missing E-10 through E-13 must be explicit source incompleteness');
console.log('✓ Brynhurst electrical sheet index is explicitly PARTIAL, not silently treated as complete');

const page5=fixture.pages.find(page=>page.page===5);
const page5Recognition=resolveDrawingPageRecognition(page5.labels,page5.vectorOps);
const page5Frames=detectPlanFrames(page5.positioned,page5Recognition.plan);
assert.equal(page5Frames.length,2,'E-5 must be segmented into exactly two explicit plan-title frames');
assert.equal(inferPdfPageFloor(['SECOND FLOOR PLAN','THIRD FLOOR PLAN']),'UNRESOLVED','multi-floor physical sheet must not receive one guessed floor');

const page6=fixture.pages.find(page=>page.page===6);
const page6Recognition=resolveDrawingPageRecognition(page6.labels,page6.vectorOps);
const page6Frames=detectPlanFrames(page6.positioned,page6Recognition.plan);
assert.equal(page6Frames.length,2,'E-6 must be segmented into fourth-floor and roof frames');

const shorthand=extractZEvidenceFromText('+18"\n+30"\n+75"',{source:fixture.source.fileName,floor:'UNRESOLVED'});
assert.equal(shorthand.length,0,'bare mounting-height-looking shorthand must not become absolute or relative Z without AFF/reference semantics');
const explicitAff=extractZEvidenceFromText('PANEL LP-2 CENTERLINE 18 IN AFF',{source:fixture.source.fileName,floor:'L1'});
assert.ok(explicitAff.some(item=>item.type==='MOUNTING_HEIGHT_AFF'&&item.referencePoint==='CENTERLINE'),'explicit AFF reference semantics remain usable as review-only Z evidence');
assert.ok(explicitAff.every(item=>item.physicalTruth===false&&item.reviewRequired===true),'Brynhurst Z evidence remains review-only');

const sourcePath=process.env.BRYNHURST_GOLDEN_PDF;
if(sourcePath){
 const bytes=fs.readFileSync(sourcePath);
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest,fixture.source.sha256,'provided Brynhurst PDF must match the locked golden source checksum');
 assert.equal(bytes.byteLength,fixture.source.sizeBytes,'provided Brynhurst PDF size must match the locked golden source');
 console.log(`✓ exact Brynhurst PDF verified by SHA-256 (${digest})`);
}else{
 console.log('ℹ BRYNHURST_GOLDEN_PDF not set; CI validates the source-derived semantic fixture and checksum contract without storing the 5.3 MB customer drawing in git.');
}

const compiler=fs.readFileSync(path.join(root,'components/CompilerWorkspace.tsx'),'utf8');
assert.match(compiler,/detectPlanFrames/);
assert.match(compiler,/planFramesByPage/);
assert.match(compiler,/resolvePlanFrameAtPoint/);
assert.match(compiler,/planRecognition:'CONTENT_PLAN_V2_FRAMES'/);
assert.match(compiler,/floorAt\(segment\.page/);
assert.match(compiler,/floorAt\(p\.page,c\.x,c\.y\)/);
assert.match(compiler,/floorAt\(t\.page,t\.x,t\.y\)/);
assert.match(compiler,/TITLE_ANCHOR_ONLY/);
assert.match(compiler,/setCompleteness:parsed\.setCompleteness/,'ingestion must persist drawing-set completeness with the source record');
const viewer=fs.readFileSync(path.join(root,'components/CompiledGraphViewer.tsx'),'utf8');
assert.match(viewer,/planFrameId/,'Spatial frame identity must preserve detected sub-viewports on multi-plan sheets');
assert.match(viewer,/planFrameTitle/,'Spatial selector must expose the detected viewport title');
assert.match(viewer,/planFrameFloor/,'Spatial selector must expose the detected viewport level');

console.log('\nBrynhurst electrical ingestion contract passed: one-line detection, site/floor/roof/unit-plan recognition, multi-viewport isolation, explicit partial-set status, scale interpretation, render-ready source metadata, and non-invented Z trust boundaries.');
