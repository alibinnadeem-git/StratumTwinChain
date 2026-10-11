import type {SpatialGraphLike} from './spatial-browser-recovery';

/** Large-source IndexedDB path. A single 28k-entity structuredClone must never own the UI thread. */
export const CHUNKED_GRAPH_THRESHOLD=10_000;
export const CHUNKED_GRAPH_BATCH=256;
const DB='stratum-spatial-chunked-v1',HEADS='heads',CHUNKS='parts';
type GraphHead={revision:string;entityCount:number;linkCount:number;entityParts:number;linkParts:number;rest:Omit<SpatialGraphLike,'entities'|'links'>};
const yieldUi=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(HEADS))db.createObjectStore(HEADS);
   if(!db.objectStoreNames.contains(CHUNKS))db.createObjectStore(CHUNKS);
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Chunked graph database unavailable'));
 });
}
function getValue<T>(db:IDBDatabase,storeName:string,key:string):Promise<T|undefined>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,'readonly'),request=tx.objectStore(storeName).get(key);
  request.onsuccess=()=>resolve(request.result as T|undefined);
  request.onerror=()=>reject(request.error||new Error('Chunk read failed'));
 });
}
function putValue(db:IDBDatabase,storeName:string,key:string,value:unknown):Promise<void>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,'readwrite');
  tx.objectStore(storeName).put(value,key);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Chunk write failed'));
  tx.onabort=()=>reject(tx.error||new Error('Chunk write aborted'));
 });
}
export async function getChunkedGraphHead(key:string):Promise<GraphHead|null>{
 const db=await openDb();try{return await getValue<GraphHead>(db,HEADS,key)||null}finally{db.close()}
}
export async function setChunkedGraphHead(key:string,head:GraphHead|null):Promise<void>{
 const db=await openDb();
 try{
  if(head)await putValue(db,HEADS,key,head);
  else await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(HEADS,'readwrite');tx.objectStore(HEADS).delete(key);
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
export async function copyChunkedGraphHead(from:string,to:string):Promise<boolean>{
 const head=await getChunkedGraphHead(from);
 if(!head)return false;
 await setChunkedGraphHead(to,head);return true;
}
export async function putChunkedGraph(key:string,graph:SpatialGraphLike,onProgress?:(saved:number,total:number)=>void):Promise<void>{
 if(!Array.isArray(graph.entities)||!Array.isArray(graph.sources))throw new Error('Invalid chunked graph');
 const db=await openDb(),revision=crypto.randomUUID();
 const links=Array.isArray(graph.links)?graph.links:[],total=graph.entities.length+links.length;
 const {entities:_entities,links:_links,...rest}=graph;
 const head:GraphHead={revision,entityCount:graph.entities.length,linkCount:links.length,
  entityParts:Math.ceil(graph.entities.length/CHUNKED_GRAPH_BATCH),linkParts:Math.ceil(links.length/CHUNKED_GRAPH_BATCH),rest};
 try{
  let saved=0;
  for(const [kind,items] of [['entities',graph.entities],['links',links]] as const){
   for(let i=0;i<items.length;i+=CHUNKED_GRAPH_BATCH){
    // Each batch is a separate small transaction. The head is committed LAST.
    await putValue(db,CHUNKS,`${revision}:${kind}:${Math.floor(i/CHUNKED_GRAPH_BATCH)}`,items.slice(i,i+CHUNKED_GRAPH_BATCH));
    saved+=Math.min(CHUNKED_GRAPH_BATCH,items.length-i);
    onProgress?.(saved,total);
    await yieldUi();
   }
  }
  // Atomic publish: until this succeeds, earlier complete revision remains authoritative.
  await putValue(db,HEADS,key,head);
 }finally{db.close()}
}
export async function getChunkedGraph(key:string,onProgress?:(loaded:number,total:number)=>void):Promise<SpatialGraphLike|null>{
 const db=await openDb();
 try{
  const head=await getValue<GraphHead>(db,HEADS,key);
  if(!head)return null;
  if(!Number.isInteger(head.entityCount)||head.entityCount<0||head.entityCount>2_000_000||
     !Number.isInteger(head.linkCount)||head.linkCount<0||head.linkCount>2_000_000)throw new Error('Invalid persisted graph head');
  const entities:unknown[]=[],links:unknown[]=[],total=head.entityCount+head.linkCount;
  for(const [kind,count,dest] of [['entities',head.entityParts,entities],['links',head.linkParts,links]] as const){
   for(let i=0;i<count;i++){
    const part=await getValue<unknown[]>(db,CHUNKS,`${head.revision}:${kind}:${i}`);
    if(!Array.isArray(part))throw new Error('Incomplete chunked graph; previous complete snapshot preserved');
    dest.push(...part);
    onProgress?.(entities.length+links.length,total);
    await yieldUi();
   }
  }
  if(entities.length!==head.entityCount||links.length!==head.linkCount)
   throw new Error('Chunked graph item count mismatch; refusing incomplete revision');
  return {...head.rest,entities,links} as SpatialGraphLike;
 }finally{db.close()}
}
