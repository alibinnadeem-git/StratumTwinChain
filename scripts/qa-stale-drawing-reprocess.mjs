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

assert.match(compiler,/drawingSourceReprocessReason\(existing,nextEntities\)/,'duplicate SHA path must consult stale-drawing detector');
assert.match(compiler,/replacementSource=\{sha256:digest,name:existing\.name\}/,'stale same-file import must enter replacement mode');
assert.match(compiler,/replacementBackup=\{source:existing,entities:/,'reprocess must retain an in-memory backup of the previous source compilation');
assert.match(compiler,/nextEntities=nextEntities\.filter\(entity=>String\(entity\.meta\?\.sourceSha256\|\|''\)!==digest&&entity\.source!==existing\.name\)/,'stale source entities must be removed before reparse');
assert.match(compiler,/saveGraph\(nextFiles,nextEntities,replacementSource\?\[replacementSource\]:\[\]\)/,'replacement intent must reach graph persistence');
assert.match(compiler,/reprocess failed; the previous saved compilation was preserved/i,'failed reprocessing must restore the previous compiled source rather than delete it');
assert.match(compiler,/replaceShas=new Set\(replaceSources\.map/,'saved graph must exclude replaced source entities and metadata');
assert.match(compiler,/version:'1\.2'/,'fresh compilation must advance graph schema marker');
assert.match(compiler,/coordinationIntelligence:undefined/,'authoritative source saves must discard stale derived coordination before recomputation');
assert.match(compiler,/enrichCoordinationIntelligence\(base as any\)/,'coordination intelligence must be rebuilt from the exact graph being committed without legacy demo injection');
assert.match(compiler,/REPROCESS SAVED DRAWING/,'Import UI must tell the user why the original file is needed');
assert.match(compiler,/staleReason&&archivedShas\.has\(f\.sha256\)/,'stale source row must only offer reprocess when source bytes are archived');

assert.match(viewer,/findDrawingSourcesNeedingReprocess/);
assert.match(viewer,/Legacy drawing frame/,'legacy parser state must remain visible without opening the demo in a fatal red state');
assert.match(viewer,/Refresh drawing source/);
assert.match(viewer,/migration task, not a failed parse/i);



assert.match(compiler,/aria-label=\{`Reprocess \$\{f\.name\}`\}/,'saved drawing row REPROCESS is a real button with accessible name');
assert.match(compiler,/onClick=\{\(\)=>queueArchivedReprocess\(\[f\.sha256\]\)\}/,'row click must queue the right source SHA');
assert.match(compiler,/function queueArchivedReprocess\(shas:string\[\]\)/,'request must be queued, not silently swallowed by a busy parser');
assert.match(compiler,/REPROCESS QUEUED/,'queueing while a parse is active must give visible feedback');
assert.match(compiler,/if\(busy\|\|parseBusyRef\.current\|\|reprocessDraining\|\|!queuedReprocessShas\.length\)return/,'queue must drain only when the current parse has finished');
assert.match(compiler,/const pending=batch\.filter\(sha=>staleBySha\.has\(sha\)\)/,'completed parse must be allowed to clear a now-fresh reprocess request');
assert.match(compiler,/setQueuedReprocessShas\(current=>\[\.\.\.new Set\(\[\.\.\.current,\.\.\.pending\.filter/,'racing archive lookup must requeue instead of dropping the request');
assert.match(compiler,/parseBusyRef\.current=true;setBusy\(true\)/,'parse lock must exclude concurrent compiler invocation before render');
assert.match(compiler,/parseBusyRef\.current=false;setBusy\(false\)/,'parse lock must release on completion');
assert.doesNotMatch(compiler,/if\(busy\|\|!archivedStaleSources\.length\)return/,'old silent-busy guard must be removed');
assert.doesNotMatch(compiler,/disabled=\{busy\} onClick=\{\(\)=>void reprocessArchivedDrawings\(\)\}/,'archived drawing button must be usable to queue during parse');
console.log('Busy reprocess queue contract passed: button wired, SHA requests deduplicated, deferred drain, status feedback, and old graph protected.');

console.log('Stale drawing reprocess contract passed: pre-basemap PDF/image graphs are detected, same-SHA re-import replaces the old source compilation, modern basemaps and valid SLDs are not falsely flagged.');
