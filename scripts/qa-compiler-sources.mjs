import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Exercise the actual compiler functions without React or a network service.
const root = new URL('../', import.meta.url);
const moduleUrl = new URL(`.compiler-qa-${randomUUID()}.mjs`, root);
const require = createRequire(import.meta.url);
let source = await readFile(new URL('components/CompilerWorkspace.tsx', root), 'utf8');
source = source.slice(source.indexOf('type Layer='), source.indexOf('export default function'));
const helpers = await readFile(new URL('lib/compiler-source.ts', root), 'utf8');
const sldHelpers = await readFile(new URL('lib/sld-intelligence.ts', root), 'utf8');
source = sldHelpers + '\n' + helpers + '\n' + source;
source = source.replace("new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString()",
  JSON.stringify(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href));
source = source.replace("wasmUrl:'/pdfjs/wasm/'", `wasmUrl:${JSON.stringify(new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url).pathname)}`);
source += '\nexport {assignZones,withAssetCandidates,parsePdf,buildLinks,classify,analyzeSldText,electricalAssetCandidate};';
await writeFile(moduleUrl, ts.transpileModule(source, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText);
try {
  const c = await import(moduleUrl.href);
  assert.equal(c.inferPdfPageFloor(['FIRST FLOOR - POWER PLAN']),'L1');
  assert.equal(c.inferPdfPageFloor(['SECOND FLOOR – LIGHTING PLAN']),'L2');
  assert.equal(c.inferPdfPageFloor(['LEVEL 3 ELECTRICAL POWER PLAN']),'L3');
  assert.equal(c.inferPdfPageFloor(['ROOF PLAN']),'ROOF');
  assert.equal(c.inferPdfPageFloor(['FIRST FLOOR - POWER PLAN','SECOND FLOOR PLAN']),'UNRESOLVED');
  assert.equal(c.inferPdfPageFloor(['GENERAL NOTES']),'UNRESOLVED');
  console.log('✓ real-world PDF floor-plan titles resolve only when source hints agree');
  const label = {id:'pdf-1-0', source:'same.pdf', floor:'L1', layer:'L1', kind:'room-label',
    name:'Electrical room', x:0,y:0,z:0,confidence:.7,meta:{page:1}};
  const asset = {...label,id:'pdf-1-1',layer:'L2',kind:'text-asset-candidate',name:'Panel A'};
  const first = c.scopeSourceEntities([label,asset], 'hash-a');
  const other = c.scopeSourceEntities([asset], 'hash-b');
  const nextPage = c.scopeSourceEntities([{...asset,meta:{page:2}}], 'hash-a');
  const zoned = c.assignZones([...first, ...other, ...nextPage]);
  assert.equal(zoned[1].zone,'Electrical room');
  assert.equal(zoned[2].zone,undefined,'different document cannot supply a room');
  assert.equal(zoned[3].zone,undefined,'different sheet cannot supply a room');
  assert.notEqual(first[1].id,other[0].id);
  assert.equal(c.classify('5749 Brynhurst - Civil - Bid Set.pdf'),'Civil');
  assert.equal(c.electricalAssetCandidate('XFMR T1'),true);
  assert.equal(c.electricalAssetCandidate('SWBD MSB-1'),true);
  assert.equal(c.electricalAssetCandidate('MCCB-1'),true);
  const sldEvidence=c.analyzeSldText(['UTILITY SERVICE 13.8kV','XFMR T1 1500 KVA','SWBD MSB-1','MCCB-1','PANEL LP-1']);
  assert.equal(sldEvidence.isSld,true,'SLD content must be recognizable without a filename hint');
  const derived = c.withAssetCandidates(first).find(e=>e.layer==='L4');
  assert.equal(derived.meta.derivedFrom,first[1].id);
  assert.equal(derived.meta.sourceSha256,'hash-a');
  assert.equal(derived.meta.page,1);
  // A nested transform must move a closed path without moving the next path.
  const stream='q 2 0 0 2 10 20 cm 10 10 m 30 10 l 30 30 l 10 30 l h S Q 10 10 m 30 10 l 30 30 l 10 30 l h S';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=pdf.length;pdf+='xref\n0 5\n0000000000 65535 f \n';
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const fixture=await c.parsePdf(new File([pdf],'transform-fixture.pdf'),{floor:'L1',elevation:0});
  const bounds=fixture.entities.filter(e=>e.kind==='vector-boundary-candidate');
  assert.equal(bounds.length,2);
  assert.ok(bounds.every(e=>e.floor==='UNRESOLVED' && e.meta.elevationKnown===false),'no floor or elevation invented for an untitled sheet');
  assert.ok(Math.abs(Math.min(...bounds[0].vertices.map(v=>v.x))+7)<.001,'nested scale/translation applied');
  assert.ok(Math.abs(Math.min(...bounds[1].vertices.map(v=>v.x))+9)<.001,'restore returns to original frame');
  assert.ok(bounds.every(e=>e.meta.reviewRequired && e.meta.geometryValidated===false));
  const combined=[];
  for(const path of process.argv.slice(2)) {
    const bytes=await readFile(path), digest=createHash('sha256').update(bytes).digest('hex');
    const parsed=await c.parsePdf(new File([bytes],basename(path)),{floor:'L1',elevation:0});
    combined.push(...c.withAssetCandidates(c.scopeSourceEntities(parsed.entities,digest)));
    console.log(`${basename(path)}: ${parsed.summary}`);
  }
  assert.equal(new Set(combined.map(e=>e.id)).size,combined.length,'combined IDs must be unique');
  const ids=new Set(combined.map(e=>e.id));
  for(const link of c.buildLinks(combined)) assert.ok(ids.has(link.from)&&ids.has(link.to));
  console.log(`PASS: source isolation, Civil classification, derived provenance and ${combined.length} unique real-file entities`);
} finally {await unlink(moduleUrl)}
