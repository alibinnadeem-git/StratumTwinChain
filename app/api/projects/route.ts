import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';

const Status=z.enum(['ACTIVE','PLANNING','COMMISSIONING','OPERATIONS','ARCHIVED']);
const Create=z.object({
  projectCode:z.string().trim().min(1).max(80),
  name:z.string().trim().min(1).max(200),
  status:z.enum(['ACTIVE','PLANNING','COMMISSIONING','OPERATIONS']).optional().default('ACTIVE'),
});
const Update=z.object({
  projectId:z.string().uuid(),
  name:z.string().trim().min(1).max(200).optional(),
  status:Status.optional(),
}).refine(body=>body.name!==undefined||body.status!==undefined,{message:'At least one project field must be updated'});

function responseStatus(error:unknown,otherwise=400){
  return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise;
}

async function readProjects(organizationId:string){
  const result=await query<any>(
    'SELECT p.id::text,p.project_code,p.name,p.status,p.created_at,'+
    ' COUNT(DISTINCT a.id)::int asset_count,MAX(sc.revision)::int latest_spatial_revision'+
    ' FROM projects p'+
    ' LEFT JOIN assets a ON a.organization_id=p.organization_id AND a.project_id=p.id'+
    ' LEFT JOIN spatial_compilations sc ON sc.organization_id=p.organization_id AND sc.project_id=p.id'+
    ' WHERE p.organization_id=$1'+
    ' GROUP BY p.id'+
    " ORDER BY CASE WHEN p.status='ARCHIVED' THEN 1 ELSE 0 END,p.name,p.project_code",
    [organizationId]
  );
  return result.rows;
}

export async function GET(){
  try{
    const session=await requireSession();
    return NextResponse.json({
      projects:await readProjects(session.organizationId),
      truthBoundary:'PROJECT_STATUS_IS_MANAGEMENT_STATE_NOT_VERIFIED_INFRASTRUCTURE_STATE',
    },{headers:{'cache-control':'private, no-store'}});
  }catch(error:any){
    return NextResponse.json({error:error.message},{status:responseStatus(error,500),headers:{'cache-control':'private, no-store'}});
  }
}

export async function POST(req:Request){
  try{
    const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
    const body=Create.parse(await req.json());
    const project=await tx(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[
        'project-create:'+session.organizationId+':'+body.projectCode.toLowerCase()
      ]);
      const duplicate=await client.query<{id:string}>(
        'SELECT id::text FROM projects WHERE organization_id=$1 AND lower(project_code)=lower($2) LIMIT 1',
        [session.organizationId,body.projectCode]
      );
      if(duplicate.rows[0])throw Object.assign(new Error('Project code already exists in this organization'),{status:409});
      const inserted=await client.query<any>(
        'INSERT INTO projects(organization_id,project_code,name,status) VALUES($1,$2,$3,$4) '+
        'RETURNING id::text,project_code,name,status,created_at',
        [session.organizationId,body.projectCode,body.name,body.status]
      );
      return inserted.rows[0];
    });
    return NextResponse.json({
      project:{...project,asset_count:0,latest_spatial_revision:null},
      truthBoundary:'PROJECT_CREATION_DOES_NOT_CREATE_OR_VERIFY_ASSETS',
    },{status:201});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid project payload',issues:error.issues},{status:400});
    return NextResponse.json({error:error.message},{status:responseStatus(error)});
  }
}

export async function PATCH(req:Request){
  try{
    const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
    const body=Update.parse(await req.json());
    const project=await tx(async client=>{
      const current=await client.query<any>(
        'SELECT id::text,project_code,name,status FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE',
        [body.projectId,session.organizationId]
      );
      if(!current.rows[0])throw Object.assign(new Error('Project not found in this organization'),{status:404});
      const result=await client.query<any>(
        'UPDATE projects SET name=COALESCE($3,name),status=COALESCE($4,status) '+
        'WHERE id=$1 AND organization_id=$2 '+
        'RETURNING id::text,project_code,name,status,created_at',
        [body.projectId,session.organizationId,body.name??null,body.status??null]
      );
      return result.rows[0];
    });
    return NextResponse.json({
      project,
      truthBoundary:'PROJECT_STATUS_IS_MANAGEMENT_STATE_NOT_VERIFIED_INFRASTRUCTURE_STATE',
    });
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid project update',issues:error.issues},{status:400});
    return NextResponse.json({error:error.message},{status:responseStatus(error)});
  }
}
