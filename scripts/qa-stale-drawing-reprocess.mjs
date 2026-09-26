import assert from 'node:assert/strict';
import fs from 'node:fs';
import {drawingSourceReprocessReason,findDrawingSourcesNeedingReprocess} from '../lib/spatial-source-reprocess.ts';

const stalePdf={name:'G101 Site Plan.pdf',ext:'pdf',sha256:'a'.repeat(64),state:'parsed',entities:12,vectors:900,textItems:120,sldPages:0};
const staleEntities=[{source:'G101 Site Plan.pdf',kind:'text-asset-candidate',layer:'L2',meta:{sourceSha256:'a'.repeat(64),physicalTruth:false}}];
assert.match(drawingSourceReprocessReason(stalePdf,staleEntities)||'',/without a retained non-SLD drawing basemap/i);

const modernPdf={...stalePdf,nonSldPlanPages:1,planTypes:['SITE_PLAN']};
const modernEntities=[...staleEntities,{source:'G101 Site Plan.pdf',kind:'line',layer:'L1',meta:{sourceSha256:'a'.repeat(64),drawingBasemap:true,sourceType:'PDF source-plan vector line'}}];
assert.equal(drawingSourceReprocessReason(modernPdf,modernEntities),null,'retained drawing basemap must clear stale reprocess state');

const sld={name:'E601 One Line.pdf',ext:'pdf',sha256:'b'.repeat(64),state:'parsed',entities:4,vectors:300,sldPages:1};
const sldEntities=[{source:sld.name,kind:'sld-feeder-candidate',layer:'L3',meta:{sourceSha256:sld.sha256,sldFeederCandidate:true}}];
assert.equal(drawingSourceReprocessReason(sld,sldEntities),null,'valid SLD topology must not be treated as stale non-SLD compilation');

const staleImage={name:'Site Plan.jpg',ext:'jpg',sha256:'c'.repeat(64),state:'parsed',entities:3};
assert.match(drawingSourceReprocessReason(staleImage,[{source:staleImage.name,kind:'ocr-review',meta:{sourceSha256:staleImage.sha256,nonSpatial:true}}])||'',/before source-underlay retention/i);

assert.equal(drawingSourceReprocessReason({name:'Tesla.glb',ext:'glb',sha256:'d'.repeat(64),state:'parsed',entities:1},[]),null,'3D files are not drawing-reprocess candidates');
assert.equal(findDrawingSourcesNeedingReprocess([stalePdf,modernPdf,sld],modernEntities).length,0,'modern replacement for the same PDF fingerprint must clear warning');

const compiler=fs.readFileSync('components/CompilerWorkspace.tsx','utf8');
const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const projection=fs.readFileSync('components/SpatialProjectionEngine.tsx','utf8');
const projection=fs.readFileSync('components/SpatialProjectionEngine.tsx','utf8');

assert.match(compiler,/drawingSourceReprocessReason\(existing,nextEntities\)/,'duplicate SHA path must consult stale-drawing detector');
assert.match(compiler,/replacementSource=\{sha256:digest,name:existing\.name\}/,'stale same-file import must enter replacement mode');
assert.match(compiler,/replacementBackup=\{source:existing,entities:/,'reprocess must retain an in-memory backup of the previous source compilation');
assert.match(compiler,/nextEntities=nextEntities\.filter\(entity=>String\(entity\.meta\?\.sourceSha256\|\|''\)!==digest&&entity\.source!==existing\.name\)/,'stale source entities must be removed before reparse');
assert.match(compiler,/saveGraph\(nextFiles,nextEntities,replacementSource\?\[replacementSource\]:\[\]\)/,'replacement intent must reach graph persistence');
assert.match(compiler,/reprocess failed; the previous saved compilation was preserved/i,'failed reprocessing must restore the previous compiled source rather than delete it');
assert.match(compiler,/replaceShas=new Set\(replaceSources\.map/,'saved graph must exclude replaced source entities and metadata');
assert.match(compiler,/version:'1\.2'/,'fresh compilation must advance graph schema marker');
assert.match(compiler,/REPROCESS SAVED DRAWING/,'Import UI must tell the user why the original file is needed');
assert.match(compiler,/REPROCESS':f\.state\.toUpperCase/,'stale source row must not present as ordinary parsed state');

assert.match(viewer,/findDrawingSourcesNeedingReprocess/);
assert.match(viewer,/DRAWING REPROCESS REQUIRED/);
assert.match(viewer,/Reprocess drawing source/);
assert.match(viewer,/original source file must be re-imported/i);

assert.match(projection,/const baseline=JSON\.stringify\(graph\)/,'automatic projection must capture the graph it actually enriched');
assert.match(projection,/const current=await readPrimarySpatialGraph\(\)/,'automatic projection must re-read browser authority before writing');
assert.match(projection,/JSON\.stringify\(current\)!==baseline/,'a changed authoritative graph must invalidate a stale projection pass');
assert.match(projection,/queued=true;continue/,'stale automatic projection must retry instead of overwriting the newer graph');

assert.match(projection,/if\(applying\)\{queued=true;return\}/,'overlapping graph updates must queue another enrichment pass instead of being dropped');
assert.match(projection,/do\{[\s\S]*\}while\(active&&queued\)/,'Spatial enrichment must drain queued updates before becoming idle');
assert.match(projection,/finally\{[\s\S]*if\(active&&queued\)void apply\(\)/,'a late queued update must still trigger a rerun after the active pass exits');

console.log('Stale drawing reprocess contract passed: pre-basemap PDF/image graphs are detected, same-SHA re-import replaces the old source compilation, modern basemaps and valid SLDs are not falsely flagged.');
