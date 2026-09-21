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
  try{return await idbGet(which)}catch{return null}
}

export async function protectSpatialGraph(graph:SpatialGraphLike,previous:SpatialGraphLike|null){
  try{
    localStorage.setItem(SPATIAL_LAST_GOOD_KEY,JSON.stringify(graph));
    if(previous)localStorage.setItem(SPATIAL_PREVIOUS_KEY,JSON.stringify(previous));
  }catch{}
  try{
    if(previous)await idbPut('previous',previous);
    await idbPut('latest',graph);
  }catch{}
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
}

export async function restoreBestSpatialGraph(){
  const current=readCurrentSpatialGraph();
  if(current)return{graph:current,source:'current' as const};

  const sameOrigin=findSameOriginRecoveryCandidates();
  const localCandidate=sameOrigin[0]?.graph||null;
  const indexed=await readIndexedRecovery('latest');
  const graph=localCandidate||indexed;
  if(!graph)return{graph:null,source:null};

  localStorage.setItem(SPATIAL_GRAPH_KEY,JSON.stringify(graph));
  localStorage.setItem(SPATIAL_LAST_GOOD_KEY,JSON.stringify(graph));
  window.dispatchEvent(new Event('stratum:graph-updated'));
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
  return{graph,source:localCandidate?'same-origin-backup' as const:'indexeddb' as const};
}

export async function createSpatialRecoveryBundle(storage:Storage=localStorage):Promise<SpatialRecoveryBundle>{
  const current=readCurrentSpatialGraph(storage);
  const lastGood=parseSpatialGraph(storage.getItem(SPATIAL_LAST_GOOD_KEY));
  const previous=parseSpatialGraph(storage.getItem(SPATIAL_PREVIOUS_KEY));
  const sameOriginBackups=findSameOriginRecoveryCandidates(storage).map(item=>({key:item.key,graph:item.graph}));
  const indexedLatest=await readIndexedRecovery('latest');
  const indexedPrevious=await readIndexedRecovery('previous');
  const unique=distinctGraphs([current,lastGood,previous,indexedLatest,indexedPrevious,...sameOriginBackups.map(item=>item.graph)]);
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

  const existingCurrent=readCurrentSpatialGraph(storage);
  const existingLastGood=parseSpatialGraph(storage.getItem(SPATIAL_LAST_GOOD_KEY));
  const existingPrevious=parseSpatialGraph(storage.getItem(SPATIAL_PREVIOUS_KEY));
  const preImport=distinctGraphs([existingCurrent,existingLastGood,existingPrevious]);
  const preImportStamp=Date.now();
  preImport.forEach((graph,index)=>{
    try{storage.setItem(`stratum_spatial_preimport_${preImportStamp}_${index+1}`,JSON.stringify(graph));}catch{}
  });

  storage.setItem(SPATIAL_GRAPH_KEY,JSON.stringify(primary));
  storage.setItem(SPATIAL_LAST_GOOD_KEY,JSON.stringify(bundle.lastGood||primary));
  if(bundle.previous)try{storage.setItem(SPATIAL_PREVIOUS_KEY,JSON.stringify(bundle.previous));}
  catch{}
  else if(existingCurrent)try{storage.setItem(SPATIAL_PREVIOUS_KEY,JSON.stringify(existingCurrent));}catch{}
  for(const backup of bundle.sameOriginBackups){
    if(!/^stratum/i.test(backup.key)||backup.key===SPATIAL_GRAPH_KEY)continue;
    try{storage.setItem(backup.key,JSON.stringify(backup.graph));}catch{}
  }
  try{
    if(bundle.indexedPrevious)await idbPut('previous',bundle.indexedPrevious);
    else if(bundle.previous)await idbPut('previous',bundle.previous);
    if(bundle.indexedLatest)await idbPut('latest',bundle.indexedLatest);
    else await idbPut('latest',bundle.lastGood||primary);
  }catch{}
  window.dispatchEvent(new Event('stratum:graph-updated'));
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
  return{graph:primary,summary:bundle.summary};
}

export function replaceCurrentSpatialGraph(graph:SpatialGraphLike){
  if(!isSpatialGraph(graph))throw new Error('This file is not a valid STRATUM Spatial graph.');
  const current=readCurrentSpatialGraph();
  if(current){
    try{localStorage.setItem(SPATIAL_PREVIOUS_KEY,JSON.stringify(current));}catch{}
  }
  localStorage.setItem(SPATIAL_GRAPH_KEY,JSON.stringify(graph));
  localStorage.setItem(SPATIAL_LAST_GOOD_KEY,JSON.stringify(graph));
  window.dispatchEvent(new Event('stratum:graph-updated'));
  window.dispatchEvent(new Event(SPATIAL_RECOVERY_EVENT));
}
