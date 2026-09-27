import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';
import {sha256} from '@/lib/server/hash';
import {
 SPATIAL_SOURCE_VAULT_CHUNK_BYTES,
 SPATIAL_SOURCE_VAULT_MAX_BYTES,
 SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY,
 spatialSourceVaultChunkCount,
} from '@/lib/spatial-source-vault-contract';

const Sha=z.string().regex(/^[a-f0-9]{64}$/i).transform(value=>value.toLowerCase());
const CreateBody=z.object({
 projectId:z.string().uuid(),
 sha256:Sha,
 fileName:z.string().trim().min(1).max(500),
 extension:z.string().trim().min(1).max(20),
 mimeType:z.string().trim().min(1).max(200),
 byteSize:z.number().int().positive().max(SPATIAL_SOURCE_VAULT_MAX_BYTES),
});
const FinalizeBody=z.object({sourceId:z.string().uuid()});

function status(error:unknown,otherwise=400){
 return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise;
}

async function schemaReady(){
 const result=await query<{sources:boolean;chunks:boolean;verifications:boolean}>(`SELECT
   to_regclass('public.spatial_project_sources') IS NOT NULL sources,
   to_regclass('public.spatial_project_source_chunks') IS NOT NULL chunks,
   to_regclass('public.spatial_project_source_verifications') IS NOT NULL verifications`);
 return Boolean(result.rows[0]?.sources&&result.rows[0]?.chunks&&result.rows[0]?.verifications);
}

async function projectExists(organizationId:string,projectId:string){
 const result=await query<{id:string}>('SELECT id::text FROM projects WHERE id=$1 AND organization_id=$2 LIMIT 1',[projectId,organizationId]);
 return Boolean(result.rows[0]);
}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  if(!await schemaReady())return NextResponse.json({schemaReady:false,sources:[],truthBoundary:SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY});
  const projectId=new URL(req.url).searchParams.get('projectId')||'';
  if(!z.string().uuid().safeParse(projectId).success)return NextResponse.json({error:'projectId must be a UUID'},{status:400});
  if(!await projectExists(session.organizationId,projectId))return NextResponse.json({error:'Project not found in this organization'},{status:404});
  const result=await query<any>(`SELECT
      s.id::text,s.project_id::text,s.sha256,s.file_name,s.extension,s.mime_type,s.byte_size,s.created_by::text,s.created_at,
      COUNT(c.chunk_index)::int uploaded_chunk_count,
      v.id IS NOT NULL complete,
      v.verified_at,
      v.chunk_count verified_chunk_count
    FROM spatial_project_sources s
    LEFT JOIN spatial_project_source_chunks c ON c.source_id=s.id
    LEFT JOIN spatial_project_source_verifications v ON v.source_id=s.id
    WHERE s.organization_id=$1 AND s.project_id=$2
    GROUP BY s.id,v.id,v.verified_at,v.chunk_count
    ORDER BY s.created_at DESC,s.id DESC`,[session.organizationId,projectId]);
  return NextResponse.json({schemaReady:true,projectId,sources:result.rows,truthBoundary:SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY},{headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'private, no-store'}});
 }
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  if(!await schemaReady())return NextResponse.json({error:'Project source vault schema is not ready'},{status:503});
  const body=CreateBody.parse(await req.json());
  const out=await tx(async client=>{
   const project=await client.query<{id:string}>('SELECT id::text FROM projects WHERE id=$1 AND organization_id=$2 FOR SHARE',[body.projectId,session.organizationId]);
   if(!project.rows[0])throw Object.assign(new Error('Project not found in this organization'),{status:404});
   const replayKey=`${session.organizationId}:${body.projectId}:${body.sha256}`;
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[replayKey]);
   const existing=await client.query<any>(`SELECT s.id::text,s.project_id::text,s.sha256,s.file_name,s.extension,s.mime_type,s.byte_size,s.created_at,
     EXISTS(SELECT 1 FROM spatial_project_source_verifications v WHERE v.source_id=s.id) complete,
     (SELECT COUNT(*)::int FROM spatial_project_source_chunks c WHERE c.source_id=s.id) uploaded_chunk_count
     FROM spatial_project_sources s
     WHERE s.organization_id=$1 AND s.project_id=$2 AND s.sha256=$3
     LIMIT 1`,[session.organizationId,body.projectId,body.sha256]);
   if(existing.rows[0])return{...existing.rows[0],idempotent:true};
   const inserted=await client.query<any>(`INSERT INTO spatial_project_sources
     (organization_id,project_id,sha256,file_name,extension,mime_type,byte_size,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id::text,project_id::text,sha256,file_name,extension,mime_type,byte_size,created_at`,
     [session.organizationId,body.projectId,body.sha256,body.fileName,body.extension.toLowerCase(),body.mimeType,body.byteSize,session.userId]);
   return{...inserted.rows[0],complete:false,uploaded_chunk_count:0,idempotent:false};
  });
  return NextResponse.json({...out,expectedChunkCount:spatialSourceVaultChunkCount(Number(out.byte_size)),truthBoundary:SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY},{status:out.idempotent?200:201});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid project source manifest',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error)});
 }
}

export async function PUT(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  if(!await schemaReady())return NextResponse.json({error:'Project source vault schema is not ready'},{status:503});
  const form=await req.formData();
  const sourceId=String(form.get('sourceId')||'');
  const chunkIndex=Number(form.get('chunkIndex'));
  const claimed=String(form.get('chunkSha256')||'').trim().toLowerCase();
  const file=form.get('file');
  if(!z.string().uuid().safeParse(sourceId).success||!Number.isInteger(chunkIndex)||chunkIndex<0||!(file instanceof File))
   return NextResponse.json({error:'sourceId, chunkIndex and file are required'},{status:400});
  if(!/^[a-f0-9]{64}$/.test(claimed))return NextResponse.json({error:'chunkSha256 must be a SHA-256 digest'},{status:400});
  if(file.size<=0||file.size>SPATIAL_SOURCE_VAULT_CHUNK_BYTES)return NextResponse.json({error:'Chunk exceeds the 2 MB project source vault limit'},{status:413});
  const bytes=Buffer.from(await file.arrayBuffer()),digest=sha256(bytes);
  if(digest!==claimed)return NextResponse.json({error:'Client chunk SHA-256 does not match server SHA-256'},{status:422});

  const out=await tx(async client=>{
   const source=await client.query<{id:string;byte_size:string}>(`SELECT id::text,byte_size::text
     FROM spatial_project_sources WHERE id=$1 AND organization_id=$2 FOR SHARE`,[sourceId,session.organizationId]);
   if(!source.rows[0])throw Object.assign(new Error('Project source not found in this organization'),{status:404});
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`spatial-source-vault:${sourceId}`]);
   const verified=await client.query('SELECT 1 FROM spatial_project_source_verifications WHERE source_id=$1 LIMIT 1',[sourceId]);
   if(verified.rows[0])throw Object.assign(new Error('Verified project source bytes are immutable'),{status:409});
   const total=Number(source.rows[0].byte_size),expectedCount=spatialSourceVaultChunkCount(total);
   if(chunkIndex>=expectedCount)throw Object.assign(new Error('Chunk index exceeds the source manifest'),{status:400});
   const expectedSize=chunkIndex===expectedCount-1?total-SPATIAL_SOURCE_VAULT_CHUNK_BYTES*(expectedCount-1):SPATIAL_SOURCE_VAULT_CHUNK_BYTES;
   if(bytes.length!==expectedSize)throw Object.assign(new Error(`Chunk ${chunkIndex} must contain exactly ${expectedSize} bytes`),{status:400});
   const prior=await client.query<{chunk_sha256:string;byte_size:number}>(`SELECT chunk_sha256,byte_size
     FROM spatial_project_source_chunks WHERE source_id=$1 AND chunk_index=$2 LIMIT 1`,[sourceId,chunkIndex]);
   if(prior.rows[0]){
     if(prior.rows[0].chunk_sha256!==digest||prior.rows[0].byte_size!==bytes.length)
       throw Object.assign(new Error('Chunk index is already occupied by different source bytes'),{status:409});
   }else{
     await client.query(`INSERT INTO spatial_project_source_chunks(source_id,chunk_index,chunk_sha256,byte_size,content,uploaded_by)
       VALUES($1,$2,$3,$4,$5,$6)`,
       [sourceId,chunkIndex,digest,bytes.length,bytes,session.userId]);
   }
   const count=await client.query<{count:number}>('SELECT COUNT(*)::int count FROM spatial_project_source_chunks WHERE source_id=$1',[sourceId]);
   return{sourceId,chunkIndex,chunkSha256:digest,uploadedChunkCount:count.rows[0]?.count||0,expectedChunkCount:expectedCount,idempotent:Boolean(prior.rows[0])};
  });
  return NextResponse.json({...out,truthBoundary:SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY});
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:status(error)});
 }
}

export async function PATCH(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  if(!await schemaReady())return NextResponse.json({error:'Project source vault schema is not ready'},{status:503});
  const body=FinalizeBody.parse(await req.json());
  const out=await tx(async client=>{
   const sourceResult=await client.query<any>(`SELECT id::text,project_id::text,sha256,byte_size::text
     FROM spatial_project_sources WHERE id=$1 AND organization_id=$2 FOR SHARE`,[body.sourceId,session.organizationId]);
   const source=sourceResult.rows[0];
   if(!source)throw Object.assign(new Error('Project source not found in this organization'),{status:404});
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`spatial-source-vault:${body.sourceId}`]);
   const existing=await client.query<any>(`SELECT id::text,sha256,byte_size::text,chunk_count,verified_at
     FROM spatial_project_source_verifications WHERE source_id=$1 LIMIT 1`,[body.sourceId]);
   if(existing.rows[0])return{...existing.rows[0],sourceId:body.sourceId,complete:true,idempotent:true};
   const total=Number(source.byte_size),expectedCount=spatialSourceVaultChunkCount(total);
   const storedCount=await client.query<{count:number}>('SELECT COUNT(*)::int count FROM spatial_project_source_chunks WHERE source_id=$1',[body.sourceId]);
   if((storedCount.rows[0]?.count||0)!==expectedCount)throw Object.assign(new Error(`Source upload is incomplete: ${storedCount.rows[0]?.count||0}/${expectedCount} chunks stored`),{status:409});
   const hash=createHash('sha256');let bytesSeen=0;
   for(let index=0;index<expectedCount;index++){
    const chunkResult=await client.query<{chunk_index:number;chunk_sha256:string;byte_size:number;content:Buffer}>(`SELECT chunk_index,chunk_sha256,byte_size,content
      FROM spatial_project_source_chunks WHERE source_id=$1 AND chunk_index=$2 LIMIT 1`,[body.sourceId,index]);
    const chunk=chunkResult.rows[0];
    if(!chunk||chunk.chunk_index!==index)throw Object.assign(new Error(`Source upload is missing chunk ${index}`),{status:409});
    const expectedSize=index===expectedCount-1?total-SPATIAL_SOURCE_VAULT_CHUNK_BYTES*(expectedCount-1):SPATIAL_SOURCE_VAULT_CHUNK_BYTES;
    if(chunk.byte_size!==expectedSize||chunk.content.length!==expectedSize)throw Object.assign(new Error(`Stored chunk ${index} has an invalid byte length`),{status:409});
    if(sha256(chunk.content)!==chunk.chunk_sha256)throw Object.assign(new Error(`Stored chunk ${index} failed integrity verification`),{status:422});
    hash.update(chunk.content);bytesSeen+=chunk.content.length;
   }
   const digest=hash.digest('hex');
   if(bytesSeen!==total||digest!==source.sha256)throw Object.assign(new Error('Assembled source bytes do not match the source manifest SHA-256'),{status:422});
   const verification=await client.query<any>(`INSERT INTO spatial_project_source_verifications
     (organization_id,project_id,source_id,sha256,byte_size,chunk_count,verified_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     RETURNING id::text,sha256,byte_size::text,chunk_count,verified_at`,
     [session.organizationId,source.project_id,body.sourceId,digest,total,expectedCount,session.userId]);
   return{...verification.rows[0],sourceId:body.sourceId,complete:true,idempotent:false};
  });
  return NextResponse.json({...out,truthBoundary:SPATIAL_SOURCE_VAULT_TRUTH_BOUNDARY});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid source finalization request',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error)});
 }
}
