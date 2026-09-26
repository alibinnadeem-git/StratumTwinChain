export const SOURCE_ARCHIVE_DB='stratum-source-archive-v1';
export const SOURCE_ARCHIVE_STORE='sources';
export const SOURCE_ARCHIVE_EVENT='stratum:source-archive-updated';
export const SOURCE_ARCHIVE_MAX_FILE_BYTES=250*1024*1024;

export type ArchivedSourceRecord={
 sha256:string;
 name:string;
 mimeType:string;
 size:number;
 ext:string;
 archivedAt:string;
 bytes:ArrayBuffer;
};

export type ArchivedSourceMetadata=Omit<ArchivedSourceRecord,'bytes'>;

const SHA256=/^[a-f0-9]{64}$/i;

function openSourceArchive():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(SOURCE_ARCHIVE_DB,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(SOURCE_ARCHIVE_STORE))db.createObjectStore(SOURCE_ARCHIVE_STORE,{keyPath:'sha256'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Local source archive is unavailable.'));
 });
}

async function availableBytes(){
 try{
  const estimate=await navigator.storage?.estimate?.();
  if(!estimate?.quota)return null;
  return Math.max(0,estimate.quota-(estimate.usage||0));
 }catch{return null}
}

export async function archiveSourceBytes(input:{sha256:string;name:string;mimeType?:string;size:number;ext:string;bytes:ArrayBuffer}){
 if(!SHA256.test(input.sha256))return{archived:false as const,reason:'Source fingerprint is not a valid SHA-256 digest.'};
 if(input.size<=0||input.bytes.byteLength<=0)return{archived:false as const,reason:'Source file is empty.'};
 if(input.size>SOURCE_ARCHIVE_MAX_FILE_BYTES)return{archived:false as const,reason:'Source exceeds the 250 MB browser-local archive limit.'};
 const available=await availableBytes();
 if(available!==null&&available<input.bytes.byteLength*1.2)return{archived:false as const,reason:'Browser storage does not have enough estimated free space for a protected local source copy.'};
 const record:ArchivedSourceRecord={
  sha256:input.sha256.toLowerCase(),name:input.name,mimeType:input.mimeType||'application/octet-stream',
  size:input.size,ext:input.ext.toLowerCase(),archivedAt:new Date().toISOString(),bytes:input.bytes.slice(0)
 };
 try{
  const db=await openSourceArchive();
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(SOURCE_ARCHIVE_STORE,'readwrite');
   tx.objectStore(SOURCE_ARCHIVE_STORE).put(record);
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{const error=tx.error;db.close();reject(error||new Error('Local source archive write failed.'))};
   tx.onabort=()=>{const error=tx.error;db.close();reject(error||new Error('Local source archive write was aborted.'))};
  });
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SOURCE_ARCHIVE_EVENT,{detail:{sha256:record.sha256,name:record.name}}));
  return{archived:true as const,metadata:sourceMetadata(record)};
 }catch(error){
  return{archived:false as const,reason:error instanceof Error?error.message:'Local source archive write failed.'};
 }
}

export async function readArchivedSource(sha256:string):Promise<ArchivedSourceRecord|null>{
 if(!SHA256.test(sha256))return null;
 try{
  const db=await openSourceArchive();
  return await new Promise<ArchivedSourceRecord|null>((resolve,reject)=>{
   const tx=db.transaction(SOURCE_ARCHIVE_STORE,'readonly');
   const request=tx.objectStore(SOURCE_ARCHIVE_STORE).get(sha256.toLowerCase());
   request.onsuccess=()=>resolve(isArchivedSource(request.result)?request.result:null);
   request.onerror=()=>reject(request.error||new Error('Local source archive read failed.'));
   tx.oncomplete=()=>db.close();
  });
 }catch{return null}
}

export async function hasArchivedSource(sha256:string){
 return Boolean(await readArchivedSource(sha256));
}

export async function listArchivedSourceMetadata():Promise<ArchivedSourceMetadata[]>{
 try{
  const db=await openSourceArchive();
  const records=await new Promise<ArchivedSourceRecord[]>((resolve,reject)=>{
   const tx=db.transaction(SOURCE_ARCHIVE_STORE,'readonly');
   const request=tx.objectStore(SOURCE_ARCHIVE_STORE).getAll();
   request.onsuccess=()=>resolve(Array.isArray(request.result)?request.result.filter(isArchivedSource):[]);
   request.onerror=()=>reject(request.error||new Error('Local source archive listing failed.'));
   tx.oncomplete=()=>db.close();
  });
  return records.map(sourceMetadata).sort((a,b)=>Date.parse(b.archivedAt)-Date.parse(a.archivedAt));
 }catch{return[]}
}

export function archivedSourceToFile(record:ArchivedSourceRecord){
 return new File([record.bytes],record.name,{type:record.mimeType||'application/octet-stream',lastModified:Date.parse(record.archivedAt)||Date.now()});
}

export function sourceMetadata(record:ArchivedSourceRecord):ArchivedSourceMetadata{
 const {bytes:_bytes,...metadata}=record;
 return metadata;
}

export function isArchivedSource(value:unknown):value is ArchivedSourceRecord{
 if(!value||typeof value!=='object')return false;
 const record=value as Partial<ArchivedSourceRecord>;
 return typeof record.sha256==='string'&&SHA256.test(record.sha256)&&typeof record.name==='string'&&typeof record.ext==='string'&&
  Number.isFinite(Number(record.size))&&record.size!>0&&record.bytes instanceof ArrayBuffer;
}
