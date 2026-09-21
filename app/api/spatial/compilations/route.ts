import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';
import {canonicalHash} from '@/lib/server/hash';

const Sha=z.string().regex(/^[a-f0-9]{64}$/i).transform(value=>value.toLowerCase());
const Point=z.object({x:z.number().finite(),y:z.number().finite()});
const Source=z.object({
  name:z.string().min(1).max(260),
  ext:z.string().min(1).max(20),
  sha256:Sha,
  discipline:z.string().min(1).max(120),
  floor:z.string().min(1).max(120),
  elevation:z.number().finite(),
  unitName:z.string().max(40).optional(),
  unitToMeters:z.number().finite().positive().optional()
}).passthrough();
const Entity=z.object({
  id:z.string().min(1).max(300),
  source:z.string().min(1).max(300),
  layer:z.enum(['L0','L1','L2','L3','L4']),
  kind:z.string().min(1).max(120),
  name:z.string().min(1).max(500),
  x:z.number().finite(),y:z.number().finite(),z:z.number().finite(),
  x2:z.number().finite().optional(),y2:z.number().finite().optional(),z2:z.number().finite().optional(),
  rotation:z.number().finite().optional(),scale:z.number().finite().optional(),
  floor:z.string().max(120).optional(),zone:z.string().max(300).optional(),
  vertices:z.array(Point).max(5000).optional(),
  confidence:z.number().finite().min(0).max(1),
  meta:z.record(z.string(),z.unknown()).optional()
}).passthrough();
const Link=z.object({
  id:z.string().min(1).max(300),from:z.string().min(1).max(300),to:z.string().min(1).max(300),
  type:z.enum(['SAME_TAG','DERIVED_ASSET','SOURCE_RELATION','SLD_FEEDS']),confidence:z.number().finite().min(0).max(1)
}).passthrough();
const Graph=z.object({
  version:z.string().min(1).max(40),
  createdAt:z.string().min(1).max(80),
  sources:z.array(Source).max(2000),
  entities:z.array(Entity).max(25000),
  links:z.array(Link).max(50000),
  stats:z.record(z.string(),z.number().finite().nonnegative())
}).passthrough();
const SaveBody=z.object({projectId:z.string().uuid(),graph:Graph});
const ReviewBody=z.object({
  compilationId:z.string().uuid(),
  action:z.enum(['ACCEPT_REVIEW_BASELINE','REOPEN_REVIEW']),
  reason:z.string().trim().min(5).max(500)
});

async function schemaReady(){
  const result=await query<{compilations:boolean;reviews:boolean}>(`SELECT
    to_regclass('public.spatial_compilations') IS NOT NULL compilations,
    to_regclass('public.spatial_compilation_reviews') IS NOT NULL reviews`);
  return Boolean(result.rows[0]?.compilations&&result.rows[0]?.reviews);
}

function status(error:unknown,otherwise=400){
  return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise;
}

export async function GET(req:Request){
  try{
    const session=await requireSession();
    const projectId=new URL(req.url).searchParams.get('projectId');
    const projects=await query<{id:string;project_code:string;name:string}>(`SELECT id::text,project_code,name
      FROM projects WHERE organization_id=$1 ORDER BY name,project_code`,[session.organizationId]);
    const ready=await schemaReady();
    if(!ready)return NextResponse.json({schemaReady:false,truthBoundary:'COMPILATION_IS_REVIEW_ARTIFACT_NOT_VERIFIED_STATE',projects:projects.rows,latest:null});
    if(!projectId)return NextResponse.json({schemaReady:true,truthBoundary:'COMPILATION_IS_REVIEW_ARTIFACT_NOT_VERIFIED_STATE',projects:projects.rows,latest:null});
    if(!z.string().uuid().safeParse(projectId).success)return NextResponse.json({error:'projectId must be a UUID'},{status:400});
    const latest=await query<any>(`SELECT sc.id::text,sc.project_id::text,sc.revision,sc.graph_sha256,sc.graph_version,sc.source_count,sc.entity_count,sc.link_count,sc.source_sha256s,sc.graph_json,sc.created_by::text,sc.created_at,
      review.action review_action,review.reason review_reason,review.occurred_at review_occurred_at,review.actor_user_id::text review_actor_user_id
      FROM spatial_compilations sc
      LEFT JOIN LATERAL (
        SELECT r.action,r.reason,r.occurred_at,r.actor_user_id
        FROM spatial_compilation_reviews r
        WHERE r.organization_id=sc.organization_id AND r.compilation_id=sc.id
        ORDER BY r.occurred_at DESC,r.id DESC LIMIT 1
      ) review ON true
      WHERE sc.organization_id=$1 AND sc.project_id::text=$2
      ORDER BY sc.revision DESC LIMIT 1`,[session.organizationId,projectId]);
    return NextResponse.json({schemaReady:true,truthBoundary:'COMPILATION_IS_REVIEW_ARTIFACT_NOT_VERIFIED_STATE',projects:projects.rows,latest:latest.rows[0]||null});
  }catch(error:any){
    return NextResponse.json({error:error.message},{status:status(error,500)});
  }
}

export async function POST(req:Request){
  try{
    const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
    if(!await schemaReady())return NextResponse.json({error:'Spatial compilation persistence schema is not ready'},{status:503});
    const body=SaveBody.parse(await req.json());
    const graph=body.graph;
    const graphSha256=canonicalHash({domain:'STRATUM/SPATIAL/COMPILATION/1',projectId:body.projectId,graph});
    const sourceSha256s=[...new Set(graph.sources.map(source=>source.sha256))].sort();
    const result=await tx(async client=>{
      const project=await client.query<{id:string}>(`SELECT id::text FROM projects
        WHERE id=$1 AND organization_id=$2 FOR SHARE`,[body.projectId,session.organizationId]);
      if(!project.rows[0])throw Object.assign(new Error('Project not found in this organization'),{status:404});
      const duplicate=await client.query<any>(`SELECT id::text,revision,graph_sha256,created_at FROM spatial_compilations
        WHERE organization_id=$1 AND project_id=$2 AND graph_sha256=$3 LIMIT 1`,[session.organizationId,body.projectId,graphSha256]);
      if(duplicate.rows[0])return {...duplicate.rows[0],idempotent:true};
      const prior=await client.query<{id:string;revision:number}>(`SELECT id::text,revision FROM spatial_compilations
        WHERE organization_id=$1 AND project_id=$2 ORDER BY revision DESC LIMIT 1 FOR UPDATE`,[session.organizationId,body.projectId]);
      const revision=(prior.rows[0]?.revision||0)+1;
      const inserted=await client.query<any>(`INSERT INTO spatial_compilations
        (organization_id,project_id,revision,graph_sha256,graph_version,source_count,entity_count,link_count,source_sha256s,graph_json,supersedes_compilation_id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
        RETURNING id::text,revision,graph_sha256,created_at`,[
          session.organizationId,body.projectId,revision,graphSha256,graph.version,graph.sources.length,graph.entities.length,graph.links.length,
          JSON.stringify(sourceSha256s),JSON.stringify(graph),prior.rows[0]?.id||null,session.userId
        ]);
      return {...inserted.rows[0],idempotent:false};
    });
    return NextResponse.json({...result,reviewState:'REVIEW_REQUIRED',truthBoundary:'STORED_COMPILATION_DOES_NOT_CREATE_OR_VERIFY_ASSETS'},{status:201});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid Spatial compilation payload',issues:error.issues},{status:400});
    return NextResponse.json({error:error.message},{status:status(error)});
  }
}

export async function PATCH(req:Request){
  try{
    const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
    if(!await schemaReady())return NextResponse.json({error:'Spatial compilation persistence schema is not ready'},{status:503});
    const body=ReviewBody.parse(await req.json());
    const result=await tx(async client=>{
      const compilation=await client.query<{id:string}>(`SELECT id::text FROM spatial_compilations
        WHERE id=$1 AND organization_id=$2 FOR UPDATE`,[body.compilationId,session.organizationId]);
      if(!compilation.rows[0])throw Object.assign(new Error('Compilation not found in this organization'),{status:404});
      const current=await client.query<any>(`SELECT id::text,action,reason,occurred_at FROM spatial_compilation_reviews
        WHERE organization_id=$1 AND compilation_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1`,[session.organizationId,body.compilationId]);
      const prior=current.rows[0]||null;
      if(prior?.action===body.action)return {...prior,idempotent:true};
      if(body.action==='REOPEN_REVIEW'&&prior?.action!=='ACCEPT_REVIEW_BASELINE')throw Object.assign(new Error('Only an accepted review baseline can be reopened'),{status:409});
      const inserted=await client.query<any>(`INSERT INTO spatial_compilation_reviews
        (organization_id,compilation_id,action,reason,actor_user_id,previous_review_id)
        VALUES($1,$2,$3,$4,$5,$6)
        RETURNING id::text,action,reason,occurred_at`,[session.organizationId,body.compilationId,body.action,body.reason,session.userId,prior?.id||null]);
      return {...inserted.rows[0],idempotent:false};
    });
    return NextResponse.json({...result,truthBoundary:'REVIEW_ACCEPTANCE_IS_NOT_VERIFIED_STATE_OR_POVI_FINALITY'});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid review action',issues:error.issues},{status:400});
    return NextResponse.json({error:error.message},{status:status(error)});
  }
}
