import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {tx,query} from '@/lib/server/db';
import {sha256} from '@/lib/server/hash';
import {OEM_CAD_CANDIDATES} from '@/lib/oem-cad-candidates';

const MAX=25*1024*1024;
const ALLOWED=new Set(['step','stp','stl','iges','igs','dwg','dxf','rfa','rvt','sat','x_t','x_b','3dm','obj','gltf','glb','zip']);
const SHA=/^[a-f0-9]{64}$/i;

function extension(name:string){
 const match=name.toLowerCase().match(/\.([a-z0-9_]+)$/);
 return match?.[1]||'';
}
function status(error:unknown,otherwise=400){
 return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise;
}

export async function GET(){
 try{
  const session=await requireSession();
  const records=await query<any>(
   `SELECT id::text,candidate_id,source_id,component_key,manufacturer_name,sku,product_name,revision,
      source_file_name,source_mime_type,source_byte_size,source_sha256,source_url,reuse_terms,notes,
      verification_status,truth_boundary,verified_by::text,verified_at
    FROM oem_cad_verifications
    WHERE organization_id=$1
    ORDER BY verified_at DESC,id DESC
    LIMIT 1000`,
   [session.organizationId]
  );
  return NextResponse.json({
   records:records.rows,
   truthBoundary:'FILE_VERIFIED_IS_SOURCE_PROVENANCE_NOT_GLB_APPROVAL_NOT_PROJECT_INSTALLATION_NOT_ENGINEERING_APPROVAL'
  },{headers:{'cache-control':'no-store'}});
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'no-store'}});
 }
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  const form=await req.formData();
  const file=form.get('file');
  const candidateId=String(form.get('candidateId')||'').trim();
  const revision=String(form.get('revision')||'').trim();
  const reuseTerms=String(form.get('reuseTerms')||'').trim();
  const notes=String(form.get('notes')||'').trim();
  const claimed=String(form.get('sha256')||'').trim().toLowerCase();

  if(!(file instanceof File)||!candidateId)return NextResponse.json({error:'file and candidateId are required'},{status:400});
  const candidate=OEM_CAD_CANDIDATES.find(item=>item.id===candidateId);
  if(!candidate)return NextResponse.json({error:'Unknown exact OEM CAD candidate'},{status:404});
  if(file.size<=0)return NextResponse.json({error:'Source CAD file is empty'},{status:400});
  if(file.size>MAX)return NextResponse.json({error:'Source CAD file exceeds the 25 MB verification limit'},{status:413});
  const ext=extension(file.name);
  if(!ALLOWED.has(ext))return NextResponse.json({error:`Unsupported CAD/archive extension .${ext||'unknown'}`},{status:415});
  if(revision.length>200)return NextResponse.json({error:'Revision is too long'},{status:400});
  if(reuseTerms.length<5||reuseTerms.length>4000)return NextResponse.json({error:'Record 5–4000 characters describing the file reuse/redistribution terms'},{status:400});
  if(notes.length>4000)return NextResponse.json({error:'Notes are too long'},{status:400});
  if(claimed&&!SHA.test(claimed))return NextResponse.json({error:'Client SHA-256 must be a 64-character hexadecimal digest'},{status:400});

  const bytes=Buffer.from(await file.arrayBuffer());
  const digest=sha256(bytes);
  if(claimed&&claimed!==digest)return NextResponse.json({error:'Client SHA-256 does not match server SHA-256'},{status:422});

  const result=await tx(async client=>{
   const replayKey=`${session.organizationId}:${candidate.id}:${digest}`;
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[replayKey]);
   const existing=await client.query<any>(
    `SELECT v.id::text,v.candidate_id,v.source_id,v.component_key,v.manufacturer_name,v.sku,v.product_name,v.revision,
       v.source_file_name,v.source_mime_type,v.source_byte_size,v.source_sha256,v.source_url,v.reuse_terms,v.notes,
       v.verification_status,v.truth_boundary,v.verified_by::text,v.verified_at,
       EXISTS(SELECT 1 FROM oem_cad_source_files f WHERE f.verification_id=v.id) file_stored
     FROM oem_cad_verifications v
     WHERE v.organization_id=$1 AND v.candidate_id=$2 AND v.source_sha256=$3
     LIMIT 1`,
    [session.organizationId,candidate.id,digest]
   );
   if(existing.rows[0]){
    if(!existing.rows[0].file_stored)throw new Error('Existing OEM CAD verification metadata is incomplete; source-file storage repair is required');
    return{record:existing.rows[0],idempotent:true};
   }

   const inserted=await client.query<any>(
    `INSERT INTO oem_cad_verifications(
      organization_id,candidate_id,source_id,component_key,manufacturer_name,sku,product_name,revision,
      source_file_name,source_mime_type,source_byte_size,source_sha256,source_url,reuse_terms,notes,verified_by
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id::text,candidate_id,source_id,component_key,manufacturer_name,sku,product_name,revision,
      source_file_name,source_mime_type,source_byte_size,source_sha256,source_url,reuse_terms,notes,
      verification_status,truth_boundary,verified_by::text,verified_at`,
    [
     session.organizationId,candidate.id,candidate.sourceId,candidate.componentKey,candidate.manufacturer,candidate.sku,candidate.product,
     revision||null,file.name,file.type||'application/octet-stream',bytes.length,digest,candidate.cadUrl||candidate.productUrl,
     reuseTerms,notes||null,session.userId
    ]
   );
   await client.query(
    'INSERT INTO oem_cad_source_files(verification_id,content,byte_size) VALUES($1,$2,$3)',
    [inserted.rows[0].id,bytes,bytes.length]
   );
   return{record:{...inserted.rows[0],file_stored:true},idempotent:false};
  });

  return NextResponse.json({
   ...result.record,
   idempotent:result.idempotent,
   truthBoundary:'FILE_VERIFIED_IS_SOURCE_PROVENANCE_ONLY_AND_DOES_NOT_ACTIVATE_VIEWER_GEOMETRY'
  },{status:result.idempotent?200:201});
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'no-store'}});
 }
}
