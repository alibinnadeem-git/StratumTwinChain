import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';

const Body=z.object({
 basis:z.enum(['OEM','NFPA_70B','NECA','PROJECT_SPEC','OWNER_STANDARD','CONDITION_BASED','USER_DEFINED']),
 intervalDays:z.number().int().positive().max(36500).nullable().optional(),
 intervalHours:z.number().int().positive().max(1000000).nullable().optional(),
 nextDueAt:z.string().datetime().nullable().optional(),
 conditionTriggers:z.array(z.union([z.string().max(500),z.record(z.string(),z.unknown())])).max(100).optional(),
 taskSummary:z.string().trim().min(3).max(4000),
 sourceRefs:z.array(z.union([z.string().max(2000),z.record(z.string(),z.unknown())])).max(100).optional(),
 status:z.enum(['DRAFT','REVIEWED','ACTIVE'])
}).refine(value=>value.intervalDays||value.intervalHours||value.nextDueAt||value.conditionTriggers?.length,{message:'Provide an interval, next due date, or condition trigger'});

function status(error:unknown,otherwise=400){return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await requireSession();
  const {id}=await params;
  const asset=await query<{id:string}>('SELECT id::text FROM assets WHERE id::text=$1 AND organization_id=$2 LIMIT 1',[id,session.organizationId]);
  if(!asset.rows[0])return NextResponse.json({error:'Asset not found in this organization'},{status:404});
  const plans=await query<any>(
   'SELECT id::text,revision,basis,interval_days,interval_hours,next_due_at,condition_triggers,task_summary,source_refs,status,supersedes_plan_id::text,created_by::text,approved_by::text,created_at FROM asset_maintenance_plans WHERE asset_id=$1 AND organization_id=$2 ORDER BY revision DESC',
   [id,session.organizationId]
  );
  return NextResponse.json({plans:plans.rows,latest:plans.rows[0]||null,truthBoundary:'MAINTENANCE_PLAN_IS_NOT_PROOF_MAINTENANCE_WAS_PERFORMED'},{headers:{'cache-control':'no-store'}});
 }catch(error:any){return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'no-store'}})}
}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  const {id}=await params;
  const body=Body.parse(await req.json());
  const result=await tx(async client=>{
   const asset=await client.query<{id:string}>('SELECT id::text FROM assets WHERE id::text=$1 AND organization_id=$2 FOR SHARE',[id,session.organizationId]);
   if(!asset.rows[0])throw Object.assign(new Error('Asset not found in this organization'),{status:404});
   const prior=await client.query<{id:string;revision:number}>('SELECT id::text,revision FROM asset_maintenance_plans WHERE asset_id=$1 AND organization_id=$2 ORDER BY revision DESC LIMIT 1 FOR UPDATE',[id,session.organizationId]);
   const revision=(prior.rows[0]?.revision||0)+1;
   const inserted=await client.query<any>(
    'INSERT INTO asset_maintenance_plans (organization_id,asset_id,revision,basis,interval_days,interval_hours,next_due_at,condition_triggers,task_summary,source_refs,status,supersedes_plan_id,created_by,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,$9,$10::jsonb,$11,$12,$13,$14) RETURNING id::text,revision,basis,interval_days,interval_hours,next_due_at,condition_triggers,task_summary,source_refs,status,supersedes_plan_id::text,created_at',
    [session.organizationId,id,revision,body.basis,body.intervalDays||null,body.intervalHours||null,body.nextDueAt||null,JSON.stringify(body.conditionTriggers||[]),body.taskSummary,JSON.stringify(body.sourceRefs||[]),body.status,prior.rows[0]?.id||null,session.userId,body.status==='DRAFT'?null:session.userId]
   );
   return inserted.rows[0];
  });
  return NextResponse.json({...result,truthBoundary:'MAINTENANCE_PLAN_IS_NOT_PROOF_MAINTENANCE_WAS_PERFORMED'},{status:201,headers:{'cache-control':'no-store'}});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid maintenance plan',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'no-store'}});
 }
}
