import assert from 'node:assert/strict';
import {register} from 'node:module';

// The graph pipeline uses bundler-style extensionless relative imports; resolve them to .ts here.
register('data:text/javascript,'+encodeURIComponent(`
import {existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';
export async function resolve(specifier,context,next){
 if(specifier.startsWith('.')&&!/\\.[cm]?[jt]sx?$|\\.json$/.test(specifier)){
  const base=new URL(specifier,context.parentURL);
  if(existsSync(fileURLToPath(base)+'.ts'))return next(base.href+'.ts',context);
 }
 return next(specifier,context);
}`));

// PR #234 review regressions for the off-thread graph pipeline:
//  - an async projection/derived pass must never revert a newer human review (title-block
//    confirmation) it did not read, and
//  - a graph worker that never replies must be stopped by a deadline or a cancel, not hang the import.

const {graphSignature}=await import('../lib/graph-signature.ts');
const {writePrimarySpatialGraph,writePrimarySpatialGraphIfUnchanged,readPrimarySpatialGraph}=await import('../lib/spatial-browser-recovery.ts');
const {compileGraphOffThread,GraphWorkerError,GRAPH_WORKER_HARD_TIMEOUT_MS}=await import('../lib/graph-assembly-client.ts');

function memoryStorage(){
 const data=new Map();
 return {getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),clear:()=>data.clear(),key:index=>[...data.keys()][index]??null,get length(){return data.size}};
}
const sha='c'.repeat(64);
const base={version:'1.2',createdAt:'2026-10-21T00:00:00.000Z',
 sources:[{name:'E-101.pdf',sha256:sha,discipline:'Electrical'}],
 entities:[{id:'room-1',source:'E-101.pdf',layer:'L1',kind:'vector-boundary-candidate',name:'PDF closed path · page 1',x:1,y:2,z:0,floor:'L1',confidence:.8,meta:{sourceSha256:sha,page:1}}],
 links:[],
 titleBlocks:[{sourceName:'E-101.pdf',sourceSha256:sha,page:1,reviewState:'CANDIDATE',sheetNumber:{value:'E-101'}}]};
const confirm=graph=>({...graph,titleBlocks:graph.titleBlocks.map(item=>({...item,reviewState:'CONFIRMED',confirmedAt:'2026-10-21T01:00:00.000Z'}))});
const project=graph=>({...graph,spatialProjection:{version:'7',generatedAt:'2026-10-21T02:00:00.000Z'}});

// Every field a review panel can write changes the signature the projection compares against.
for(const [label,changed] of [
 ['title-block confirmation',confirm(base)],
 ['room proposal',{...base,roomReconstructionProposals:[{candidateId:'room-1',eligible:true}]}],
 ['alignment candidate',{...base,alignmentCandidates:[{id:'a1'}]}],
 ['entity kind',{...base,entities:base.entities.map(entity=>({...entity,kind:'room-boundary'}))}],
])assert.notEqual(graphSignature(changed),graphSignature(base),label+' must change the graph signature');
assert.equal(graphSignature(JSON.parse(JSON.stringify(base))),graphSignature(base),'signature is stable across a storage round trip');

// Projection read the CANDIDATE graph; a human confirmed the sheet before the projection finished.
{
 const storage=memoryStorage();
 await writePrimarySpatialGraph(base,storage);
 const before=graphSignature(await readPrimarySpatialGraph(storage));
 await writePrimarySpatialGraph(confirm(base),storage);
 assert.equal(await writePrimarySpatialGraphIfUnchanged(project(base),before,storage),false,'a projection from a stale read must not be written');
 const stored=await readPrimarySpatialGraph(storage);
 assert.equal(stored.titleBlocks[0].reviewState,'CONFIRMED','the newer human confirmation survives');
 assert.equal(stored.titleBlocks[0].confirmedAt,'2026-10-21T01:00:00.000Z');
 assert.equal(await writePrimarySpatialGraphIfUnchanged(project(stored),graphSignature(stored),storage),true,'re-projecting from the latest graph commits');
 const reprojected=await readPrimarySpatialGraph(storage);
 assert.equal(reprojected.titleBlocks[0].reviewState,'CONFIRMED');
 assert.equal(reprojected.spatialProjection.version,'7');
}

// Writes are serialized, so a human write issued while a compare-and-write is in flight lands after it.
{
 const storage=memoryStorage();
 await writePrimarySpatialGraph(base,storage);
 const before=graphSignature(base);
 const projection=writePrimarySpatialGraphIfUnchanged(project(base),before,storage);
 const human=writePrimarySpatialGraph(confirm(base),storage);
 await Promise.all([projection,human]);
 assert.equal((await readPrimarySpatialGraph(storage)).titleBlocks[0].reviewState,'CONFIRMED','concurrent human write is never overwritten');
}

// Graph worker that never replies: the hard deadline (not a UI-thread fallback) ends the task.
const realSetTimeout=globalThis.setTimeout;
let fireDeadline=null;
globalThis.setTimeout=(fn,ms,...rest)=>{if(ms===GRAPH_WORKER_HARD_TIMEOUT_MS){fireDeadline=fn;return 0}return realSetTimeout(fn,ms,...rest)};
let terminated=0,posted=0,crash=false;
class SilentWorker{
 onmessage=null;onerror=null;onmessageerror=null;
 postMessage(){posted++;if(crash)queueMicrotask(()=>this.onerror?.({message:'synthetic crash'}))}
 terminate(){terminated++}
}
globalThis.Worker=SilentWorker;
const input={entities:Array.from({length:1200},(_,i)=>({id:'line-'+i,source:'E-101.pdf',layer:'L1',kind:'line',name:'Source plan line',x:i,y:0,z:0,floor:'L1',confidence:.5,meta:{}})),sources:[{name:'E-101.pdf',sha256:sha}]};
const settle=promise=>promise.then(value=>({value}),error=>({error}));
{
 const pending=settle(compileGraphOffThread(input));
 await new Promise(resolve=>realSetTimeout(resolve,10));
 assert.equal(posted,1);assert.ok(fireDeadline,'graph task must arm a hard deadline');
 fireDeadline();
 const {error}=await pending;
 assert.ok(error instanceof GraphWorkerError&&error.code==='GRAPH_WORKER_TIMEOUT','silent worker fails at the deadline instead of hanging or rerunning on the UI thread');
 assert.equal(terminated,1,'timed-out worker is terminated');
}
{
 const controller=new AbortController();
 const pending=settle(compileGraphOffThread(input,controller.signal));
 await new Promise(resolve=>realSetTimeout(resolve,10));
 controller.abort();
 const {error}=await pending;
 assert.ok(error instanceof GraphWorkerError&&error.code==='GRAPH_WORKER_CANCELLED','cancel ends graph finalization');
 assert.equal(terminated,2,'canceled worker is terminated');
 const before=posted;
 const {error:early}=await settle(compileGraphOffThread(input,controller.signal));
 assert.ok(early instanceof GraphWorkerError&&early.code==='GRAPH_WORKER_CANCELLED');
 assert.equal(posted,before,'an already-canceled import starts no worker');
}
{
 crash=true;
 const {value,error}=await settle(compileGraphOffThread(input));
 assert.equal(error,undefined,'a crashed worker still falls back so the import completes');
 assert.equal(value.zoned.length,1200);
}
globalThis.setTimeout=realSetTimeout;

console.log('Graph review concurrency passed: stale projections cannot revert human reviews, writes are serialized, and silent graph workers stop at the deadline or on cancel.');
