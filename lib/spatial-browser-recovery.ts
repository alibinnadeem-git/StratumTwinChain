import {CHUNKED_GRAPH_THRESHOLD,getChunkedGraph,getChunkedGraphHead,putChunkedGraph,setChunkedGraphHead,copyChunkedGraphHead} from './spatial-chunked-graph.ts';

import {requireExportAuthority} from './spatial-authority-io.ts';
import {assertRealWritePayload} from './spatial-provenance.ts';
import {graphSignature} from './graph-signature.ts';
export type SpatialGraphLike={
  version?:string;
  createdAt?:string;
  sources:unknown[];
  entities:unknown[];
  links?:unknown[];
  stats?:Record<string,unknown>;
  [key:string]:unknown;
};

export const SPATIAL_GRAPH_KEY='stratum_compiled_graph';
export const SPATIAL_LAST_GOOD_KEY='stratum_compiled_graph_last_good_v2';
export const SPATIAL_PREVIOUS_KEY='stratum_compiled_graph_previous_v2';
export const SPATIAL_RECOVERY_EVENT='stratum:recovery-updated';
export const SPATIAL_RECOVERY_BUNDLE_FORMAT='STRATUM_SPATIAL_RECOVERY';
export const SPATIAL_RECOVERY_BUNDLE_VERSION=1;

const DB_NAME='stratum-spatial-recovery-v1';
const STORE='graphs';
const PRIMARY_KEY='current';

export function isSpatialGraph(value:unknown):value is SpatialGraphLike{
  if(!value||typeof value!=='object')return false;
  const graph=value as Partial<SpatialGraphLike>;
  return Array.isArray(graph.sources)&&Array.isArray(graph.entities);
}

export function graphSummary(graph:SpatialGraphLike|null){
  return{
    sources:graph?.sources?.length||0,
    entities:graph?.entities?.length||0,
    links:Array.isArray(graph?.links)?graph!.links!.length:0,
    createdAt:typeof graph?.createdAt==='string'?graph.createdAt:null,
  };
}

export type SpatialRecoveryBundle={
  format:typeof SPATIAL_RECOVERY_BUNDLE_FORMAT;
  version:number;
  exportedAt:string;
  current:SpatialGraphLike|null;
  lastGood:SpatialGraphLike|null;
  previous:SpatialGraphLike|null;
  sameOriginBackups:{key:string;graph:SpatialGraphLike}[];
  indexedLatest:SpatialGraphLike|null;
  indexedPrevious:SpatialGraphLike|null;
  summary:{
    distinctGraphs:number;
    totalSources:number;
    totalEntities:number;
    totalLinks:number;
  };
};

function distinctGraphs(graphs:(SpatialGraphLike|null)[]){
  const unique:SpatialGraphLike[]=[];const seen=new Set<string>();
  for(const graph of graphs){if(!graph)continue;const serialized=JSON.stringify(graph);if(seen.has(serialized))continue;seen.add(serialized);unique.push(graph)}
  return unique;
}

export function isSpatialRecoveryBundle(value:unknown):value is SpatialRecoveryBundle{
  if(!value||typeof value!=='object')return false;
  const bundle=value as Partial<SpatialRecoveryBundle>;
  if(bundle.format!==SPATIAL_RECOVERY_BUNDLE_FORMAT||bundle.version!==SPATIAL_RECOVERY_BUNDLE_VERSION)return false;
  const fields=[bundle.current,bundle.lastGood,bundle.previous,bundle.indexedLatest,bundle.indexedPrevious];
  if(fields.some(item=>item!==null&&item!==undefined&&!isSpatialGraph(item)))return false;
  if(!Array.isArray(bundle.sameOriginBackups)||bundle.sameOriginBackups.some(item=>!item||typeof item.key!=='string'||!isSpatialGraph(item.graph)))return false;
  return true;
}

export function parseSpatialGraph(raw:string|null):SpatialGraphLike|null{
  if(!raw)return null;
  try{
    const parsed=JSON.parse(raw);
    return isSpatialGraph(parsed)?parsed:null;
  }catch{
    return null;
  }
}

export function readCurrentSpatialGraph(storage:Storage=localStorage){
  return parseSpatialGraph(storage.getItem(SPATIAL_GRAPH_KEY));
}

export async function readIndexedCurrentSpatialGraph():Promise<SpatialGraphLike|null>{
  try{
    const chunked=await getChunkedGraph(PRIMARY_KEY);
    if(chunked)return chunked;
  }catch{/* A torn chunked read must not end the lookup: fall through to the plain IndexedDB copy. */}
  try{return await idbGet(PRIMARY_KEY)}catch{return null}
}

const recoveryTick=()=>new Promise<void>(resolve=>setTimeout(resolve,25));

export async function readPrimarySpatialGraph(storage:Storage=localStorage):Promise<SpatialGraphLike|null>{
  let indexed=await readIndexedCurrentSpatialGraph();
  // Chunked or IndexedDB current is authoritative: never parse a large
  // compatibility shadow when durable IDB already contains the graph.
  const shadow=indexed?null:readCurrentSpatialGraph(storage);
  // A navigation can begin while IndexedDB is finishing a prior transaction/open.
  // Retry briefly before trusting the compatibility shadow so authority cannot move backward.
  if(!indexed&&shadow){
    await recoveryTick();
    indexed=await readIndexedCurrentSpatialGraph();
    if(!indexed){
      await recoveryTick();
      indexed=await readIndexedCurrentSpatialGraph();
    }
  }
  let fromRecovery=false;
  if(!indexed){
    // Current is unavailable or torn. The protected recovery generations hold
    // complete earlier snapshots (protectSpatialGraph); consult them before
    // the localStorage compatibility shadow, which for large graphs is stale
    // or absent and otherwise resurrects an ancient graph. Read-only: the
    // fallback is never written back over current here; promotion happens
    // only through restoreBestSpatialGraph.
    indexed=await readIndexedRecovery('latest');
    if(!indexed)indexed=await readIndexedRecovery('previous');
    fromRecovery=Boolean(indexed);
  }
  if(indexed&&fromRecovery)return indexed;
  if(indexed){
    // IndexedDB is authoritative. Heal any stale compatibility shadow immediately.
    try{
      if(indexed.entities.length<CHUNKED_GRAPH_THRESHOLD){
        const serialized=JSON.stringify(indexed);
        if(storage.getItem(SPATIAL_GRAPH_KEY)!==serialized)storage.setItem(SPATIAL_GRAPH_KEY,serialized);
      }
    }catch{}
    return indexed;
  }
  return shadow;
}

/**
 * Reject preview-only synthetic fixtures before browser or IndexedDB persistence.
 * Authenticated/server source records must never be created from demo entities.
 */
export function assertNonSyntheticSpatialGraph(graph:SpatialGraphLike):void{
  assertRealWritePayload(graph);
  const isSynthetic=(item:unknown)=>{
    if(!item||typeof item!=='object')return false;
    const record=item as {id?:unknown;name?:unknown;synthetic?:unknown;demo?:unknown;meta?:unknown};
    const meta=record.meta&&typeof record.meta==='object'?record.meta as Record<string,unknown>:{};
    return record.synthetic===true||record.demo===true||meta.synthetic===true||meta.demo===true||
      (typeof record.id==='string'&&record.id.startsWith('DEMO-SYNTHETIC-'))||
      (typeof record.name==='string'&&record.name.startsWith('DEMO / SYNTHETIC'));
  };
  if(graph.synthetic===true||graph.demo===true||
     graph.entities.some(isSynthetic)||graph.sources.some(isSynthetic))
    throw new Error('DEMO / SYNTHETIC graphs are ineligible for persisted Spatial or authoritative source records.');
}

// Primary-graph writes run one at a time so a compare-and-write (writePrimarySpatialGraphIfUnchanged,
// replaceCurrentSpatialGraph with an expected signature) cannot have another write land between
// its check and its write.
let primaryWriteQueue:Promise<unknown>=Promise.resolve();
function serializePrimaryWrite<T>(task:()=>Promise<T>):Promise<T>{
  const run=primaryWriteQueue.then(task,task);
  primaryWriteQueue=run.catch(()=>{});
  return run;
}

export async function writePrimarySpatialGraph(graph:SpatialGraphLike,storage:Storage=localStorage){
  return serializePrimaryWrite(()=>writePrimarySpatialGraphNow(graph,storage));
}

/**
 * Writes graph only if the stored primary graph still has expectedSignature (graphSignature of the
 * graph the caller derived from). Returns false, writing nothing, when another writer got there first.
 */
export function writePrimarySpatialGraphIfUnchanged(graph:SpatialGraphLike,expectedSignature:string,storage:Storage=localStorage){
  return serializePrimaryWrite(async()=>{
    const latest=await readPrimarySpatialGraph(storage);
    if(graphSignature(latest)!==expectedSignature)return false;
    await writePrimarySpatialGraphNow(graph,storage);
    return true;
  });
}

async function writePrimarySpatialGraphNow(graph:SpatialGraphLike,storage:Storage){
  if(!isSpatialGraph(graph))throw new Error('This file is not a valid STRATUM Spatial graph.');
  assertNonSyntheticSpatialGraph(graph);
  if(graph.entities.length>=CHUNKED_GRAPH_THRESHOLD){
    // Failure is fail-closed: never fall back to one giant synchronous
    // structuredClone/localStorage.stringify on the UI thread.
    await putChunkedGraph(PRIMARY_KEY,graph);
    return {indexed:true,shadowed:false};
  }
  let indexed=false;
  try{
    await idbPut(PRIMARY_KEY,graph);
    await setChunkedGraphHead(PRIMARY_KEY,null);
    indexed=true;
  }catch{}
  try{storage.setItem(SPATIAL_GRAPH_KEY,JSON.stringify(graph));}catch{
    if(!indexed)throw new Error('Browser storage is full and IndexedDB is unavailable. Export your model backup before importing more sources.');
  }
  return{indexed,shadowed:Boolean(parseSpatialGraph(storage.getItem(SPATIAL_GRAPH_KEY)))};
}

export function findSameOriginRecoveryCandidates(storage:Storage=localStorage){
  const candidates:{key:string;graph:SpatialGraphLike;serialized:string}[]=[];
  const seen=new Set<string>();
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(!key||key===SPATIAL_GRAPH_KEY||key===SPATIAL_LAST_GOOD_KEY||key===SPATIAL_PREVIOUS_KEY)continue;
    if(!/stratum/i.test(key))continue;
    const raw=storage.getItem(key);
    if(!raw||seen.has(raw))continue;
    const graph=parseSpatialGraph(raw);
    if(!graph)continue;
    seen.add(raw);
    candidates.push({key,graph,serialized:raw});
  }
  for(const key of [SPATIAL_LAST_GOOD_KEY,SPATIAL_PREVIOUS_KEY]){
    const raw=storage.getItem(key);
    if(!raw||seen.has(raw))continue;
    const graph=parseSpatialGraph(raw);
    if(!graph)continue;
    seen.add(raw);
    candidates.push({key,graph,serialized:raw});
  }
  return candidates.sort((a,b)=>{
    const ac=Date.parse(String(a.graph.createdAt||''))||0;
    const bc=Date.parse(String(b.graph.createdAt||''))||0;
    if(ac!==bc)return bc-ac;
    return (b.graph.entities?.length||0)-(a.graph.entities?.length||0);
  });
}

function openRecoveryDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Recovery database unavailable'));
  });
}

async function idbGet(key:string){
  const db=await openRecoveryDb();
  return new Promise<SpatialGraphLike|null>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const request=tx.objectStore(STORE).get(key);
    request.onsuccess=()=>resolve(isSpatialGraph(request.result)?request.result:null);
    request.onerror=()=>reject(request.error||new Error('Recovery database read failed'));
    tx.oncomplete=()=>db.close();
  });
}

async function idbPut(key:string,graph:SpatialGraphLike){
  const db=await openRecoveryDb();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(graph,key);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{db.close();reject(tx.error||new Error('Recovery database write failed'));};
  });
}

export async function readIndexedRecovery(which:'latest'|'previous'){
  try{const value=await getChunkedGraph(which);if(value)return value}catch{return null}
  try{return await idbGet(which)}catch{return null}
}

export async function protectSpatialGraph(graph:SpatialGraphLike,previous:SpatialGraphLike|null,previousChunkHead?:Awaited<ReturnType<typeof getChunkedGraphHead>>){
  assertNonSyntheticSpatialGraph(graph);
  try{
    if(previous){
      if(previousChunkHead)await setChunkedGraphHead('previous',previousChunkHead);
      else if(previous.entities.length>=CHUNKED_GRAPH_THRESHOLD)await putChunkedGraph('previous',previous);
      else {await idbPut('previous',previous);await setChunkedGraphHead('previous',null);}
    }
    if(graph.entities.length>=CHUNKED_GRAPH_THRESHOLD){
      // The same durable chunks are re-used by the last-good recovery pointer.
      if(!await copyChunkedGraphHead(PRIMARY_KEY,'latest'))await putChunkedGraph('latest',graph);
    }else{await idbPut('latest',graph);await setChunkedGraphHead('latest',null)}
    localStorage.removeItem(SPATIAL_LAST_GOOD_KEY);
    if(previous)localStorage.removeItem(SPATIAL_PREVIOUS_KEY);
  }catch{/* Keep legacy recovery copies if IndexedDB is unavailable. */}
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
}

export async function restoreBestSpatialGraph(){
  const indexedCurrent=await readIndexedCurrentSpatialGraph();
  if(indexedCurrent&&indexedCurrent.entities.length>0){
    await writePrimarySpatialGraph(indexedCurrent);
    return{graph:indexedCurrent,source:'current' as const};
  }
  const current=readCurrentSpatialGraph();

  const sameOrigin=findSameOriginRecoveryCandidates();
  const localCandidate=sameOrigin.find(item=>item.graph.entities.length>0)?.graph||sameOrigin[0]?.graph||null;
  const indexed=await readIndexedRecovery('latest');
  const graph=(indexed&&indexed.entities.length>0?indexed:null)||localCandidate||indexed||current;
  if(!graph)return{graph:null,source:null};

  // Initialization may overlap a newer writer. Re-check IndexedDB immediately
  // before promoting any legacy/recovery fallback so authority cannot move backward.
  const concurrentCurrent=await readIndexedCurrentSpatialGraph();
  if(concurrentCurrent){
    await writePrimarySpatialGraph(concurrentCurrent);
    return{graph:concurrentCurrent,source:'current' as const};
  }

  await writePrimarySpatialGraph(graph);
  await protectSpatialGraph(graph,current);
  window.dispatchEvent(new Event('stratum:graph-updated'));
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
  return{graph,source:localCandidate?'same-origin-backup' as const:'indexeddb' as const};
}

export async function createSpatialRecoveryBundle(storage:Storage=localStorage):Promise<SpatialRecoveryBundle>{
  const current=await readPrimarySpatialGraph(storage);
  const lastGood=parseSpatialGraph(storage.getItem(SPATIAL_LAST_GOOD_KEY));
  const previous=parseSpatialGraph(storage.getItem(SPATIAL_PREVIOUS_KEY));
  const sameOriginBackups=findSameOriginRecoveryCandidates(storage).map(item=>({key:item.key,graph:item.graph}));
  const indexedLatest=await readIndexedRecovery('latest');
  const indexedPrevious=await readIndexedRecovery('previous');
  const unique=distinctGraphs([current,lastGood,previous,indexedLatest,indexedPrevious,...sameOriginBackups.map(item=>item.graph)]);
  // Browser recovery bundle is an export path; refuse mixed/demo source in every generation.
  for(const candidate of unique){
    if(candidate.provenance_class==='DEMO')throw Error('Synthetic recovery export prohibited');
    assertRealWritePayload(candidate);
  }
  return{
    format:SPATIAL_RECOVERY_BUNDLE_FORMAT,
    version:SPATIAL_RECOVERY_BUNDLE_VERSION,
    exportedAt:new Date().toISOString(),
    current,lastGood,previous,sameOriginBackups,indexedLatest,indexedPrevious,
    summary:{
      distinctGraphs:unique.length,
      totalSources:unique.reduce((sum,graph)=>sum+graphSummary(graph).sources,0),
      totalEntities:unique.reduce((sum,graph)=>sum+graphSummary(graph).entities,0),
      totalLinks:unique.reduce((sum,graph)=>sum+graphSummary(graph).links,0),
    }
  };
}

export async function restoreSpatialRecoveryBundle(value:unknown,storage:Storage=localStorage){
  if(!isSpatialRecoveryBundle(value))throw new Error('This file is not a valid STRATUM Spatial Recovery bundle.');
  const bundle=value as SpatialRecoveryBundle;
  const primary=bundle.current||bundle.lastGood||bundle.indexedLatest||bundle.sameOriginBackups[0]?.graph||bundle.previous||bundle.indexedPrevious;
  if(!primary)throw new Error('The STRATUM Spatial Recovery bundle does not contain a recoverable graph.');

  const existingCurrent=await readPrimarySpatialGraph(storage);
  const existingLastGood=parseSpatialGraph(storage.getItem(SPATIAL_LAST_GOOD_KEY));
  const existingPrevious=parseSpatialGraph(storage.getItem(SPATIAL_PREVIOUS_KEY));
  const preImport=distinctGraphs([existingCurrent,existingLastGood,existingPrevious]);
  const preImportStamp=Date.now();
  preImport.forEach((graph,index)=>{
    try{storage.setItem(`stratum_spatial_preimport_${preImportStamp}_${index+1}`,JSON.stringify(graph));}catch{}
  });

  await writePrimarySpatialGraph(primary,storage);
  // The imported recovery generations live in IndexedDB; do not triple localStorage usage.
  for(const backup of bundle.sameOriginBackups){
    if(!/^stratum/i.test(backup.key)||backup.key===SPATIAL_GRAPH_KEY)continue;
    if(backup.key!==SPATIAL_LAST_GOOD_KEY&&backup.key!==SPATIAL_PREVIOUS_KEY)try{storage.setItem(backup.key,JSON.stringify(backup.graph));}catch{}
  }
  try{
    if(bundle.indexedPrevious)await idbPut('previous',bundle.indexedPrevious);
    else if(bundle.previous)await idbPut('previous',bundle.previous);
    if(bundle.indexedLatest)await idbPut('latest',bundle.indexedLatest);
    else await idbPut('latest',bundle.lastGood||primary);
    storage.removeItem(SPATIAL_LAST_GOOD_KEY);storage.removeItem(SPATIAL_PREVIOUS_KEY);
  }catch{}
  window.dispatchEvent(new Event('stratum:graph-updated'));
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
  return{graph:primary,summary:bundle.summary};
}

/**
 * With expectedSignature, replaces the graph only if the stored one still matches it and returns
 * false otherwise, so a caller that derived graph from an older read cannot revert newer work.
 */
export async function replaceCurrentSpatialGraph(graph:SpatialGraphLike,expectedSignature?:string):Promise<boolean>{
  if(!isSpatialGraph(graph))throw new Error('This file is not a valid STRATUM Spatial graph.');
  const replaced=await serializePrimaryWrite(async()=>{
    const previousChunkHead=await getChunkedGraphHead(PRIMARY_KEY).catch(()=>null);
    const current=await readPrimarySpatialGraph();
    if(expectedSignature!==undefined&&graphSignature(current)!==expectedSignature)return null;
    await writePrimarySpatialGraphNow(graph,localStorage);
    return {current,previousChunkHead};
  });
  if(!replaced)return false;
  const {current,previousChunkHead}=replaced;
  await protectSpatialGraph(graph,current,previousChunkHead);
  window.dispatchEvent(new Event('stratum:graph-updated'));
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
  return true;
}
