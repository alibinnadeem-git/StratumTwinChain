import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';
import {canonicalHash} from '@/lib/server/hash';
import {buildZSolution} from '@/lib/z-solution-chain';

const Id=z.string().uuid();
const EntityId=z.string().trim().min(1).max(300);
const ReviewBody=z.object({
  projectId:Id,
  compilationId:Id,
  entityId:EntityId,
  action:z.enum(['ACCEPT_DESIGN_CHAIN','CLEAR_DESIGN_CHAIN']),
  candidateId:z.string().trim().min(1).max(120).optional(),
  reason:z.string().trim().min(5).max(1000),
}).superRefine((value,ctx)=>{
  if(value.action==='ACCEPT_DESIGN_CHAIN'&&!value.candidateId)ctx.addIssue({code:z.ZodIssueCode.custom,path:['candidateId'],message:'candidateId is required when accepting a design chain'});
  if(value.action==='CLEAR_DESIGN_CHAIN'&&value.candidateId)ctx.addIssue({code:z.ZodIssueCode.custom,path:['candidateId'],message:'candidateId must be omitted when clearing a design chain'});
});

type StoredCompilation={
  id:string;
  project_id:string;
  graph_sha256:string;
  revision:number;
  graph_json:any;
};

async function schemaReady(){
  const result=await query<{ready:boolean}>(`SELECT to_regclass('public.spatial_z_review_decisions') IS NOT NULL ready`);
  return Boolean(result.rows[0]?.ready);
}

function status(error:unknown,otherwise=400){
  return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise;
}

function rawPlacementEntity(entity:any){
  const meta={...(entity?.meta||{})};
  for(const key of Object.keys(meta))if(key.startsWith('zReviewDecision'))delete meta[key];
  return{name:String(entity?.name||''),floor:entity?.floor,z:entity?.z,meta};
}

export async function GET(req:Request){
  try{
    const session=await requireSession();
    if(!await schemaReady())return NextResponse.json({schemaReady:false,truthBoundary:'Z_REVIEW_IS_DESIGN_PLACEMENT_REVIEW_NOT_PHYSICAL_TRUTH',decisions:[]});
    const url=new URL(req.url);
    const projectId=url.searchParams.get('projectId')||'';
    const compilationId=url.searchParams.get('compilationId')||'';
    const entityId=url.searchParams.get('entityId')||'';
    if(!Id.safeParse(projectId).success)return NextResponse.json({error:'projectId must be a UUID'},{status:400});
    if(compilationId&&!Id.safeParse(compilationId).success)return NextResponse.json({error:'compilationId must be a UUID'},{status:400});
    if(entityId&&!EntityId.safeParse(entityId).success)return NextResponse.json({error:'entityId is invalid'},{status:400});

    const project=await query<{id:string}>(`SELECT id::text FROM projects WHERE id=$1 AND organization_id=$2`,[projectId,session.organizationId]);
    if(!project.rows[0])return NextResponse.json({error:'Project not found in this organization'},{status:404});

    const values:any[]=[session.organizationId,projectId];
    let filter='';
    if(compilationId){values.push(compilationId);filter+=` AND d.compilation_id=$${values.length}`;}
    if(entityId){values.push(entityId);filter+=` AND d.entity_id=$${values.length}`;}
    const result=await query<any>(`SELECT DISTINCT ON (d.entity_id)
      d.id::text,d.project_id::text,d.compilation_id::text,d.entity_id,d.action,d.candidate_id,d.reason,
      d.graph_sha256,d.decision_sha256,d.candidate_snapshot,d.conflict_snapshot,d.actor_user_id::text,d.previous_decision_id::text,d.occurred_at
      FROM spatial_z_review_decisions d
      WHERE d.organization_id=$1 AND d.project_id=$2 ${filter}
      ORDER BY d.entity_id,d.occurred_at DESC,d.id DESC`,values);
    return NextResponse.json({schemaReady:true,truthBoundary:'Z_REVIEW_IS_DESIGN_PLACEMENT_REVIEW_NOT_PHYSICAL_TRUTH',decisions:result.rows});
  }catch(error:any){
    return NextResponse.json({error:error.message},{status:status(error,500)});
  }
}

export async function POST(req:Request){
  try{
    const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
    if(!await schemaReady())return NextResponse.json({error:'Spatial Z review persistence schema is not ready'},{status:503});
    const body=ReviewBody.parse(await req.json());

    const result=await tx(async client=>{
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,[
        `STRATUM/SPATIAL/PROJECT/${session.organizationId}/${body.projectId}`
      ]);
      const compilation=await client.query<StoredCompilation>(`SELECT id::text,project_id::text,graph_sha256,revision,graph_json
        FROM spatial_compilations
        WHERE id=$1 AND project_id=$2 AND organization_id=$3
        FOR SHARE`,[body.compilationId,body.projectId,session.organizationId]);
      const stored=compilation.rows[0];
      if(!stored)throw Object.assign(new Error('Compilation not found in this organization/project'),{status:404});
      const latestCompilation=await client.query<{id:string}>(`SELECT id::text FROM spatial_compilations
        WHERE organization_id=$1 AND project_id=$2 ORDER BY revision DESC LIMIT 1`,[session.organizationId,body.projectId]);
      if(latestCompilation.rows[0]?.id!==body.compilationId)
        throw Object.assign(new Error('Spatial Z review must target the latest project compilation'),{status:409});

      const entities=Array.isArray(stored.graph_json?.entities)?stored.graph_json.entities:[];
      const entity=entities.find((item:any)=>String(item?.id||'')===body.entityId);
      if(!entity)throw Object.assign(new Error('Entity not found in the stored Spatial compilation'),{status:404});

      const solution=buildZSolution(rawPlacementEntity(entity));
      const conflicts=solution.conflicts;
      if(body.action==='ACCEPT_DESIGN_CHAIN'&&!conflicts.length)
        throw Object.assign(new Error('Stored entity does not currently contain a Z conflict requiring adjudication'),{status:409});
      if(body.action==='ACCEPT_DESIGN_CHAIN'&&solution.candidates.some(item=>item.kind==='REVIEWED_OR_MEASURED'&&item.absolute&&item.baseZ!==null))
        throw Object.assign(new Error('Measured/reviewed Z evidence cannot be overridden by design-chain adjudication'),{status:409});

      const prior=await client.query<any>(`SELECT
        id::text,action,candidate_id,reason,compilation_id::text,graph_sha256,decision_sha256,candidate_snapshot,conflict_snapshot,actor_user_id::text,occurred_at
        FROM spatial_z_review_decisions
        WHERE organization_id=$1 AND project_id=$2 AND entity_id=$3
        ORDER BY occurred_at DESC,id DESC LIMIT 1 FOR UPDATE`,[session.organizationId,body.projectId,body.entityId]);
      const previous=prior.rows[0]||null;
      const requestedCandidateId=body.candidateId||null;
      if(
        previous
        &&previous.compilation_id===body.compilationId
        &&previous.action===body.action
        &&previous.candidate_id===requestedCandidateId
        &&previous.reason===body.reason
        &&previous.actor_user_id===session.userId
      )return{...previous,idempotent:true,reviewState:body.action==='ACCEPT_DESIGN_CHAIN'?'REVIEW_RESOLVED_CANDIDATE':'CONFLICT'};

      let candidate:any=null;
      if(body.action==='ACCEPT_DESIGN_CHAIN'){
        candidate=solution.candidates.find(item=>item.id===body.candidateId&&item.absolute&&item.baseZ!==null)||null;
        if(!candidate)throw Object.assign(new Error('Requested Z chain is not an absolute candidate in the stored conflict'),{status:409});
      }else if(previous?.action!=='ACCEPT_DESIGN_CHAIN'){
        throw Object.assign(new Error('Only an accepted Z design chain can be cleared'),{status:409});
      }

      const candidateSnapshot=candidate?{
        id:candidate.id,kind:candidate.kind,baseZ:candidate.baseZ,topZ:candidate.topZ,confidence:candidate.confidence,
        authority:candidate.authority,absolute:candidate.absolute,steps:candidate.steps,note:candidate.note
      }:null;
      const decisionSha256=canonicalHash({
        domain:'STRATUM/SPATIAL/Z-REVIEW/1',
        organizationId:session.organizationId,
        projectId:body.projectId,
        compilationId:body.compilationId,
        graphSha256:stored.graph_sha256,
        entityId:body.entityId,
        action:body.action,
        candidate:candidateSnapshot,
        conflicts,
        reason:body.reason,
        actorUserId:session.userId,
        previousDecisionId:previous?.id||null,
      });

      const inserted=await client.query<any>(`INSERT INTO spatial_z_review_decisions
        (organization_id,project_id,compilation_id,entity_id,action,candidate_id,reason,graph_sha256,decision_sha256,candidate_snapshot,conflict_snapshot,actor_user_id,previous_decision_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)
        RETURNING id::text,action,candidate_id,reason,graph_sha256,decision_sha256,candidate_snapshot,conflict_snapshot,occurred_at`,[
          session.organizationId,body.projectId,body.compilationId,body.entityId,body.action,candidate?.id||null,body.reason,
          stored.graph_sha256,decisionSha256,JSON.stringify(candidateSnapshot),JSON.stringify(conflicts),session.userId,previous?.id||null
        ]);
      return{...inserted.rows[0],idempotent:false,reviewState:body.action==='ACCEPT_DESIGN_CHAIN'?'REVIEW_RESOLVED_CANDIDATE':'CONFLICT'};
    });

    return NextResponse.json({
      ...result,
      truthBoundary:'AUTHENTICATED_Z_REVIEW_SELECTS_A_DESIGN_PLACEMENT_CHAIN_ONLY_NOT_PHYSICAL_TRUTH_NOT_DIR_NOT_POVI',
    },{status:201});
  }catch(error:any){
    if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid Spatial Z review payload',issues:error.issues},{status:400});
    return NextResponse.json({error:error.message},{status:status(error)});
  }
}
