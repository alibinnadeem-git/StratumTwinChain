import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Exercise the actual compiler functions without React or a network service.
const root = new URL('../', import.meta.url);
const moduleUrl = new URL(`.compiler-qa-${process.pid}.mjs`, root);
const require = createRequire(import.meta.url);
let source = await readFile(new URL('components/CompilerWorkspace.tsx', root), 'utf8');
source = source.slice(source.indexOf('type Layer='), source.indexOf('export default function'));
const helpers = await readFile(new URL('lib/compiler-source.ts', root), 'utf8');
source = helpers + '\n' + source;
source = source.replace("new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString()",
  JSON.stringify(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href));
source += '\nexport {assignZones,withAssetCandidates,parsePdf,buildLinks,classify};';
await writeFile(moduleUrl, ts.transpileModule(source, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText);
try {
  const c = await import(moduleUrl.href);
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
  const derived = c.withAssetCandidates(first).find(e=>e.layer==='L4');
  assert.equal(derived.meta.derivedFrom,first[1].id);
  assert.equal(derived.meta.sourceSha256,'hash-a');
  assert.equal(derived.meta.page,1);
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
