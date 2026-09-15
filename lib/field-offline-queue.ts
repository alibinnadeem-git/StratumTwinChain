'use client';

export type OfflineEvidenceMeta={name:string;sha256:string;type:string;size:number};
export type QueuedInspection={
 requestId:string;
 assetId:string;
 projectId:string;
 payload:Record<string,unknown>;
 evidence:OfflineEvidenceMeta[];
 createdAt:string;
 lastError?:string|null;
};

type StoredEvidence=OfflineEvidenceMeta&{key:string;assetId:string;blob:Blob;storedAt:string};

const DB_NAME='stratum-field-queue';
const DB_VERSION=1;
const EVIDENCE_STORE='evidenceBlobs';
const QUEUE_STORE='inspectionQueue';

function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB is unavailable in this browser.'));return;}
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(EVIDENCE_STORE))db.createObjectStore(EVIDENCE_STORE,{keyPath:'key'});
   if(!db.objectStoreNames.contains(QUEUE_STORE))db.createObjectStore(QUEUE_STORE,{keyPath:'requestId'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Field queue database could not be opened.'));
 });
}

function transact<T>(storeName:string,mode:IDBTransactionMode,action:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason?:unknown)=>void)=>void):Promise<T>{
 return openDb().then(db=>new Promise<T>((resolve,reject)=>{
  const tx=db.transaction(storeName,mode);const store=tx.objectStore(storeName);
  action(store,resolve,reject);
  tx.oncomplete=()=>db.close();
  tx.onerror=()=>{db.close();reject(tx.error||new Error('Field queue transaction failed.'))};
  tx.onabort=()=>{db.close();reject(tx.error||new Error('Field queue transaction aborted.'))};
 }));
}

const evidenceKey=(assetId:string,sha256:string)=>`${assetId}:${sha256}`;

export async function persistEvidenceBlob(assetId:string,meta:OfflineEvidenceMeta,file:Blob){
 const row:StoredEvidence={...meta,key:evidenceKey(assetId,meta.sha256),assetId,blob:file,storedAt:new Date().toISOString()};
 await transact<void>(EVIDENCE_STORE,'readwrite',(store,resolve,reject)=>{const request=store.put(row);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
}

export async function removeEvidenceBlob(assetId:string,sha256:string){
 await transact<void>(EVIDENCE_STORE,'readwrite',(store,resolve,reject)=>{const request=store.delete(evidenceKey(assetId,sha256));request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
}

export async function getEvidenceFile(assetId:string,meta:OfflineEvidenceMeta):Promise<File|null>{
 const row=await transact<StoredEvidence|undefined>(EVIDENCE_STORE,'readonly',(store,resolve,reject)=>{const request=store.get(evidenceKey(assetId,meta.sha256));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 if(!row?.blob)return null;
 return new File([row.blob],row.name,{type:row.type||'application/octet-stream'});
}

export async function queueInspection(item:QueuedInspection){
 await transact<void>(QUEUE_STORE,'readwrite',(store,resolve,reject)=>{const request=store.put(item);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
}

export async function listQueuedInspections():Promise<QueuedInspection[]>{
 const rows=await transact<QueuedInspection[]>(QUEUE_STORE,'readonly',(store,resolve,reject)=>{const request=store.getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)});
 return rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export async function updateQueueError(requestId:string,lastError:string){
 const rows=await listQueuedInspections();const current=rows.find(row=>row.requestId===requestId);if(!current)return;
 await queueInspection({...current,lastError});
}

export async function removeQueuedInspection(item:QueuedInspection){
 await transact<void>(QUEUE_STORE,'readwrite',(store,resolve,reject)=>{const request=store.delete(item.requestId);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
 for(const evidence of item.evidence)await removeEvidenceBlob(item.assetId,evidence.sha256);
}

export async function syncQueuedInspection(item:QueuedInspection){
 if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('Device is offline.');
 const files=new Map<string,File>();
 for(const meta of item.evidence){
  const file=await getEvidenceFile(item.assetId,meta);
  if(!file)throw new Error(`Evidence file ${meta.name} is not available in the offline store. Reselect it before sync.`);
  files.set(meta.sha256,file);
 }

 const lifecycle=await fetch('/api/lifecycle',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:item.requestId,projectId:item.projectId,assetId:item.assetId,eventType:'INSPECT',payload:item.payload})});
 const lifecycleBody=await lifecycle.json();
 if(!lifecycle.ok)throw new Error(lifecycleBody.error||'Queued lifecycle submission failed.');
 const recordId=String(lifecycleBody.id||lifecycleBody.record_id||'');
 if(!recordId)throw new Error('Queued lifecycle submission did not return a record identifier.');

 for(const meta of item.evidence){
  const file=files.get(meta.sha256)!;
  const form=new FormData();form.set('file',file);form.set('lifecycleEventId',recordId);form.set('assetId',item.assetId);form.set('kind','Inspection');form.set('visibility','PRIVATE');form.set('sha256',meta.sha256);
  const response=await fetch('/api/evidence/upload',{method:'POST',credentials:'same-origin',body:form});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||`Evidence sync failed for ${meta.name}`);
 }

 await removeQueuedInspection(item);
 return{recordId,canonicalHash:String(lifecycleBody.canonicalHash||''),replayed:Boolean(lifecycleBody.replayed)};
}
