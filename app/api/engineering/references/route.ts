import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';
import {ENGINEERING_REFERENCE_REGISTRY} from '@/lib/engineering-reference-registry';

const Sha=z.string().regex(/^[a-f0-9]{64}$/i).transform(value=>value.toLowerCase());
const Applicability=z.object({
 type:z.literal('APPLICABILITY'),projectId:z.string().uuid(),siteId:z.string().uuid().nullable().optional(),
 referenceType:z.enum(['CODE_STANDARD','ZONING','FIRE_LIFE_SAFETY','PROJECT_SPEC','OWNER_STANDARD','OEM_REQUIREMENT']),
 publisher:z.string().trim().min(1).max(200),referenceCode:z.string().trim().min(1).max(200),title:z.string().trim().min(1).max(500),
 edition:z.string().trim().max(120).nullable().optional(),jurisdictionLabel:z.string().trim().max(500).nullable().optional(),
 authorityClass:z.enum(['PUBLISHED_REFERENCE','AHJ_ADOPTED','CONTRACTUAL','OWNER_REQUIREMENT','OEM']),
 applicabilityStatus:z.enum(['REFERENCE','APPLICABLE','SUPERSEDED','REVIEW_REQUIRED']),
 effectiveDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),sourceUrl:z.string().url().max(2000).nullable().optional(),
 sourceSha256:Sha.nullable().optional(),notes:z.string().max(4000).nullable().optional()
});
const Oem=z.object({
 type:z.literal('OEM'),manufacturerName:z.string().trim().min(1).max(200),modelPattern:z.string().trim().max(300).nullable().optional(),
 documentType:z.enum(['DATASHEET','INSTALLATION','OPERATION','MAINTENANCE','SUBMITTAL','WARRANTY','OTHER']),
 title:z.string().trim().min(1).max(500),revision:z.string().trim().max(120).nullable().optional(),
 publishedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),sourceUrl:z.string().url().max(2000).nullable().optional(),
 sourceSha256:Sha.nullable().optional(),authorityClass:z.enum(['OEM_PUBLISHED','PROJECT_SUBMITTAL','HISTORICAL_REFERENCE']),
 metadata:z.record(z.string(),z.unknown()).optional()
});
const Body=z.discriminatedUnion('type',[Applicability,Oem]);
function status(error:unknown,otherwise=400){return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  const projectId=new URL(req.url).searchParams.get('projectId');
  const projects=await query<any>('SELECT p.id::text,p.project_code,p.name,s.id::text site_id,s.name site_name,s.location_label FROM projects p LEFT JOIN sites s ON s.project_id=p.id AND s.organization_id=p.organization_id WHERE p.organization_id=$1 ORDER BY p.name,s.name',[session.organizationId]);
  const applicability=await query<any>(
   'SELECT id::text,project_id::text,site_id::text,reference_type,publisher,reference_code,title,edition,jurisdiction_label,authority_class,applicability_status,effective_date,source_url,source_sha256,notes,created_at FROM engineering_applicability_records WHERE organization_id=$1 AND ($2::uuid IS NULL OR project_id=$2::uuid) ORDER BY created_at DESC LIMIT 500',
   [session.organizationId,projectId||null]
  );
  const oem=await query<any>(
   'SELECT id::text,manufacturer_name,model_pattern,document_type,title,revision,published_at,source_url,source_sha256,authority_class,metadata,created_at FROM oem_reference_documents WHERE organization_id=$1 ORDER BY manufacturer_name,title,created_at DESC LIMIT 1000',
   [session.organizationId]
  );
  return NextResponse.json({publishedReferences:ENGINEERING_REFERENCE_REGISTRY,projects:projects.rows,applicability:applicability.rows,oemReferences:oem.rows,truthBoundary:'PUBLISHED_REFERENCE_IS_NOT_PROJECT_APPLICABILITY_AND_REFERENCE_DOCUMENT_IS_NOT_PHYSICAL_TRUTH'},{headers:{'cache-control':'no-store'}});
 }catch(error:any){return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'no-store'}})}
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  const body=Body.parse(await req.json());
  if(body.type==='APPLICABILITY'){
   const inserted=await tx(async client=>{
    const project=await client.query<{id:string}>('SELECT id::text FROM projects WHERE id=$1 AND organization_id=$2 FOR SHARE',[body.projectId,session.organizationId]);
    if(!project.rows[0])throw Object.assign(new Error('Project not found in this organization'),{status:404});
    if(body.siteId){
     const site=await client.query<{id:string}>('SELECT id::text FROM sites WHERE id=$1 AND project_id=$2 AND organization_id=$3 FOR SHARE',[body.siteId,body.projectId,session.organizationId]);
     if(!site.rows[0])throw Object.assign(new Error('Site not found in this project'),{status:404});
    }
    const row=await client.query<any>(
     'INSERT INTO engineering_applicability_records (organization_id,project_id,site_id,reference_type,publisher,reference_code,title,edition,jurisdiction_label,authority_class,applicability_status,effective_date,source_url,source_sha256,notes,created_by,reviewed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14,$15,$16,$17) RETURNING id::text,created_at',
     [session.organizationId,body.projectId,body.siteId||null,body.referenceType,body.publisher,body.referenceCode,body.title,body.edition||null,body.jurisdictionLabel||null,body.authorityClass,body.applicabilityStatus,body.effectiveDate||null,body.sourceUrl||null,body.sourceSha256||null,body.notes||null,session.userId,body.applicabilityStatus==='APPLICABLE'?session.userId:null]
    );
    return row.rows[0];
   });
   return NextResponse.json({...inserted,truthBoundary:'APPLICABILITY_RECORD_DOES_NOT_REPLACE_AHJ_OR_ENGINEERING_AUTHORITY'},{status:201});
  }
  const inserted=await tx(async client=>{
   const manufacturer=await client.query<{id:string}>('INSERT INTO manufacturers(name) VALUES($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id::text',[body.manufacturerName]);
   const row=await client.query<any>(
    'INSERT INTO oem_reference_documents (organization_id,manufacturer_id,manufacturer_name,model_pattern,document_type,title,revision,published_at,source_url,source_sha256,authority_class,metadata,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12::jsonb,$13) RETURNING id::text,created_at',
    [session.organizationId,manufacturer.rows[0].id,body.manufacturerName,body.modelPattern||null,body.documentType,body.title,body.revision||null,body.publishedAt||null,body.sourceUrl||null,body.sourceSha256||null,body.authorityClass,JSON.stringify(body.metadata||{}),session.userId]
   );
   return row.rows[0];
  });
  return NextResponse.json({...inserted,truthBoundary:'OEM_REFERENCE_AUTHORITY_REMAINS_DISTINCT_FROM_PROJECT_APPROVAL_AND_PHYSICAL_TRUTH'},{status:201});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid engineering reference payload',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'no-store'}});
 }
}
