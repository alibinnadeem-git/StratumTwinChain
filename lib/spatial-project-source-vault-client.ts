import {archiveSourceBytes,type ArchivedSourceRecord} from './source-browser-archive';
import {
 SPATIAL_SOURCE_VAULT_CHUNK_BYTES,
 spatialSourceVaultChunkCount,
} from './spatial-source-vault-contract';

export type ProjectVaultSource={
 id:string;
 project_id:string;
 sha256:string;
 file_name:string;
 extension:string;
 mime_type:string;
 byte_size:number|string;
 uploaded_chunk_count:number;
 complete:boolean;
 verified_at?:string|null;
 verified_chunk_count?:number|null;
 created_at:string;
};

export type ProjectVaultListResponse={
 schemaReady:boolean;
 projectId?:string;
 sources:ProjectVaultSource[];
 truthBoundary?:string;
 error?:string;
};

async function digestBytes(bytes:ArrayBuffer){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function readJson(response:Response){
 return await response.json().catch(()=>({}));
}

export async function listProjectVaultSources(projectId:string):Promise<ProjectVaultListResponse>{
 const response=await fetch('/api/spatial/sources?projectId='+encodeURIComponent(projectId),{cache:'no-store',credentials:'same-origin'});
 const body=await readJson(response);
 if(!response.ok)throw new Error(body?.error||`Project source vault lookup failed (${response.status}).`);
 return body as ProjectVaultListResponse;
}

export async function uploadArchivedSourceToProject(
 projectId:string,
 record:ArchivedSourceRecord,
 onProgress?:(message:string)=>void
){
 onProgress?.(`Preparing ${record.name} for durable project backup…`);
 const manifestResponse=await fetch('/api/spatial/sources',{
  method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
  body:JSON.stringify({
   projectId,sha256:record.sha256,fileName:record.name,extension:record.ext,
   mimeType:record.mimeType||'application/octet-stream',byteSize:record.size,
  })
 });
 const manifest=await readJson(manifestResponse);
 if(!manifestResponse.ok)throw new Error(manifest?.error||`Project source manifest failed (${manifestResponse.status}).`);
 if(manifest.complete)return{sourceId:String(manifest.id),complete:true,idempotent:true};

 const sourceId=String(manifest.id||'');
 if(!sourceId)throw new Error('Project source vault did not return a source identifier.');
 const total=record.bytes.byteLength;
 const count=spatialSourceVaultChunkCount(total);
 for(let index=0;index<count;index++){
  const start=index*SPATIAL_SOURCE_VAULT_CHUNK_BYTES,end=Math.min(total,start+SPATIAL_SOURCE_VAULT_CHUNK_BYTES);
  const chunk=record.bytes.slice(start,end),chunkSha256=await digestBytes(chunk);
  onProgress?.(`Backing up ${record.name} · chunk ${index+1}/${count}`);
  const form=new FormData();
  form.set('sourceId',sourceId);
  form.set('chunkIndex',String(index));
  form.set('chunkSha256',chunkSha256);
  form.set('file',new File([chunk],`chunk-${index}.bin`,{type:'application/octet-stream'}));
  const response=await fetch('/api/spatial/sources',{method:'PUT',body:form,credentials:'same-origin'});
  const body=await readJson(response);
  if(!response.ok)throw new Error(body?.error||`Project source chunk ${index} failed (${response.status}).`);
 }
 onProgress?.(`Verifying ${record.name} on the server…`);
 const finalizeResponse=await fetch('/api/spatial/sources',{
  method:'PATCH',headers:{'content-type':'application/json'},credentials:'same-origin',
  body:JSON.stringify({sourceId})
 });
 const finalized=await readJson(finalizeResponse);
 if(!finalizeResponse.ok)throw new Error(finalized?.error||`Project source verification failed (${finalizeResponse.status}).`);
 if(!finalized.complete)throw new Error('Project source verification did not complete.');
 return{sourceId,complete:true,idempotent:Boolean(finalized.idempotent)};
}

export async function restoreProjectSourceToBrowser(
 source:ProjectVaultSource,
 onProgress?:(message:string)=>void
){
 if(!source.complete)throw new Error('Only verified project sources can be restored.');
 const total=Number(source.byte_size);
 const count=Number(source.verified_chunk_count||spatialSourceVaultChunkCount(total));
 if(!Number.isFinite(total)||total<=0||!Number.isInteger(count)||count<=0)throw new Error('Project source manifest is invalid.');
 const parts:ArrayBuffer[]=[];
 let bytesSeen=0;
 for(let index=0;index<count;index++){
  onProgress?.(`Restoring ${source.file_name} · chunk ${index+1}/${count}`);
  const response=await fetch(`/api/spatial/sources/${encodeURIComponent(source.id)}/chunks/${index}`,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok){
   const body=await readJson(response);
   throw new Error(body?.error||`Project source chunk ${index} could not be restored (${response.status}).`);
  }
  const chunk=await response.arrayBuffer();
  const claimed=response.headers.get('x-stratum-chunk-sha256')||'';
  const digest=await digestBytes(chunk);
  if(!claimed||digest!==claimed)throw new Error(`Restored chunk ${index} failed SHA-256 verification.`);
  parts.push(chunk);bytesSeen+=chunk.byteLength;
 }
 if(bytesSeen!==total)throw new Error(`Restored source byte length mismatch: expected ${total}, received ${bytesSeen}.`);
 const blob=new Blob(parts,{type:source.mime_type||'application/octet-stream'});
 const bytes=await blob.arrayBuffer(),digest=await digestBytes(bytes);
 if(digest!==source.sha256)throw new Error('Restored source SHA-256 does not match the project vault manifest.');
 const archived=await archiveSourceBytes({
  sha256:source.sha256,name:source.file_name,mimeType:source.mime_type,size:total,ext:source.extension,bytes
 });
 if(!archived.archived)throw new Error(archived.reason);
 onProgress?.(`Restored ${source.file_name} to the protected browser source archive.`);
 return archived.metadata;
}
