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
