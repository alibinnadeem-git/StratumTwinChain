import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectPlanFrames,resolveDrawingPageRecognition,resolvePlanFrameAtPoint} from '../lib/plan-recognition.ts';
import {inferPdfPageFloor} from '../lib/compiler-source.ts';
import {drawingScaleDenominator} from '../lib/title-block.ts';
import {extractZEvidenceFromText} from '../lib/z-resolver.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/brynhurst-electrical-golden.json'),'utf8'));
const ok=(name,condition)=>{assert.ok(condition,name);console.log(`✓ ${name}`)};

assert.equal(fixture.fixtureId,'SV-GOLDEN-ELECTRICAL-001');
assert.equal(fixture.source.pageCount,9);
assert.equal(fixture.source.sha256,'9ad7aea4dccfe584dd3837796d4b5ba04588aeea8e2b1a90cc547575d4c323ec');
assert.equal(fixture.trustBoundary.authoritativeXYZ,false);
assert.equal(fixture.trustBoundary.physicalTruth,false);
assert.equal(fixture.trustBoundary.reviewRequired,true);
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

async function validateExactBrynhurstPdf(sourcePath){
 const bytes=fs.readFileSync(sourcePath);
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest,fixture.source.sha256,'provided Brynhurst PDF must match the locked golden source checksum');
 assert.equal(bytes.byteLength,fixture.source.sizeBytes,'provided Brynhurst PDF size must match the locked golden source');
 console.log(`✓ exact Brynhurst PDF verified by SHA-256 (${digest})`);

 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await pdfjs.getDocument({
  data:new Uint8Array(bytes),
  disableWorker:true,
  useSystemFonts:true,
 }).promise;
 assert.equal(doc.numPages,fixture.source.pageCount,'exact Brynhurst PDF page count must remain locked');

 const exactPages=[];
 for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
  const page=await doc.getPage(pageNumber);
  const viewport=page.getViewport({scale:1});
  const maxSide=Math.max(viewport.width,viewport.height,1);
  const text=await page.getTextContent();
  const labels=[];
  const positioned=[];
  for(const item of text.items||[]){
   const value=String(item?.str||'').replace(/\s+/g,' ').trim();
   if(!value)continue;
   const transform=item.transform||[1,0,0,1,0,0];
   const point=viewport.convertToViewportPoint(Number(transform[4]||0),Number(transform[5]||0));
   const x=(point[0]-viewport.width/2)*20/maxSide;
   const y=(viewport.height/2-point[1])*20/maxSide;
   labels.push(value);
   positioned.push({text:value,x,y});
  }

  let vectorOps=0;
  try{
   const ops=await page.getOperatorList();
   vectorOps=ops.fnArray?.length||0;
  }catch{}
  const expected=fixture.pages.find(item=>item.page===pageNumber)?.expected||{};
  const recognition=resolveDrawingPageRecognition(labels,vectorOps);
  assert.equal(recognition.sld.isSld,Boolean(expected.sld),`exact page ${pageNumber} SLD classification`);
  assert.equal(recognition.plan.isPlan,Boolean(expected.isPlan),`exact page ${pageNumber} plan classification`);
  if(expected.planType)assert.equal(recognition.plan.planType,expected.planType,`exact page ${pageNumber} plan type`);
  if(expected.discipline)assert.equal(recognition.plan.discipline,expected.discipline,`exact page ${pageNumber} discipline`);

  const frames=detectPlanFrames(positioned,recognition.plan);
  if(expected.frameFloors){
   assert.deepEqual(new Set(frames.map(frame=>frame.floor)),new Set(expected.frameFloors),`exact page ${pageNumber} floor/roof/site frames`);
  }
  if(expected.unitIds){
   assert.deepEqual(new Set(frames.map(frame=>frame.unitId).filter(Boolean)),new Set(expected.unitIds),`exact page ${pageNumber} unit-plan frames`);
   assert.ok(frames.every(frame=>frame.reviewRequired===true&&frame.physicalTruth===false),`exact page ${pageNumber} unit frames remain review-only`);
  }
  if(expected.pageFloor){
   assert.equal(inferPdfPageFloor(labels),expected.pageFloor,`exact page ${pageNumber} page-level floor remains fail-closed`);
  }

  if(pageNumber>=3&&pageNumber<=6){
   const scaleDenominators=labels
    .filter(value=>/\bSCALE\b/i.test(value))
    .map(value=>drawingScaleDenominator(value))
    .filter(value=>Number.isFinite(value));
   assert.ok(scaleDenominators.some(value=>Math.abs(value-96)<1e-9),`exact page ${pageNumber} contains the locked 1/8" = 1'-0" scale`);
  }

  if(pageNumber>=7&&pageNumber<=9){
   const splitElectricalCue=labels.some((value,index)=>
    /^ELEC\.?$/i.test(value)&&/^PANEL$/i.test(labels[index+1]||'')
   );
   assert.ok(splitElectricalCue,`exact page ${pageNumber} preserves split ELEC./PANEL source objects`);
  }

  const zEvidence=extractZEvidenceFromText(labels.join('\n'),{
   source:fixture.source.fileName,
   floor:inferPdfPageFloor(labels),
   idPrefix:`exact-p${pageNumber}-z`,
  });
  assert.ok(zEvidence.every(item=>item.physicalTruth===false&&item.reviewRequired===true),`exact page ${pageNumber} Z evidence remains review-only`);

  exactPages.push({
   page:pageNumber,
   textItems:labels.length,
   vectorOps,
   sld:recognition.sld.isSld,
   plan:recognition.plan.isPlan,
   planType:recognition.plan.planType,
   discipline:recognition.plan.discipline,
   pageFloor:inferPdfPageFloor(labels),
   frames:frames.map(frame=>({
    id:frame.id,
    title:frame.title,
    floor:frame.floor,
    unitId:frame.unitId,
    planType:frame.planType,
    confidence:frame.confidence,
    physicalTruth:frame.physicalTruth,
    reviewRequired:frame.reviewRequired,
   })),
   zEvidenceCount:zEvidence.length,
  });
  page.cleanup();
 }
 await doc.destroy();

 const bareHeightEvidence=extractZEvidenceFromText('+18"\n+30"\n+75"',{
  source:fixture.source.fileName,
  floor:'UNRESOLVED',
  idPrefix:'exact-bare-height',
 });
 assert.equal(bareHeightEvidence.length,0,'exact-file acceptance must never promote bare +18/+30/+75 shorthand into Z');

 const report={
  schemaVersion:'1.0',
  fixtureId:fixture.fixtureId,
  source:{
   fileName:fixture.source.fileName,
   sha256:digest,
   sizeBytes:bytes.byteLength,
   pageCount:exactPages.length,
  },
  result:'PASS',
  truthBoundary:{
   authoritativeXYZ:false,
   physicalTruth:false,
   reviewRequired:true,
   note:'Exact-file comprehension proves source interpretation and review geometry only; it does not establish field/as-built XYZ, approval, DIR finality or PoVI finality.',
  },
  pages:exactPages,
 };
 const reportPath=process.env.BRYNHURST_GOLDEN_REPORT||
  path.join(root,'test-results','brynhurst-exact-file-acceptance.json');
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(`✓ exact Brynhurst page extraction and semantic recognition passed on all ${exactPages.length} sheets`);
 console.log(`✓ exact-file acceptance report written to ${reportPath}`);
}

const sourcePath=process.env.BRYNHURST_GOLDEN_PDF;
if(sourcePath){
 await validateExactBrynhurstPdf(sourcePath);
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

console.log('\nBrynhurst golden comprehension passed: one-line detection, site/floor/roof/unit-plan recognition, multi-viewport segmentation, page-level floor fail-closed behavior, scale interpretation, and non-invented Z trust boundaries.');
