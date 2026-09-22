import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';

const ProjectId=z.string().uuid();
const PatchBody=z.object({
 findingId:z.string().uuid(),
 action:z.enum(['ACKNOWLEDGE','DISMISS','REOPEN','ENGINEERING_REVIEW_REQUIRED']),
 reason:z.string().trim().min(5).max(1000)
});
function status(error:unknown,otherwise=400){return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise}

async function schemaReady(){
 const r=await query<{ready:boolean}>("SELECT to_regclass('public.power_intelligence_snapshots') IS NOT NULL AND to_regclass('public.expected_power_requirements') IS NOT NULL AND to_regclass('public.power_gap_findings') IS NOT NULL AND to_regclass('public.power_finding_dispositions') IS NOT NULL ready");
 return Boolean(r.rows[0]?.ready);
}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  if(!await schemaReady())return NextResponse.json({schemaReady:false,latest:null,requirements:[],findings:[],truthBoundary:'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW'});
  const projectId=new URL(req.url).searchParams.get('projectId')||'';
  if(!ProjectId.safeParse(projectId).success)return NextResponse.json({error:'projectId must be a UUID'},{status:400});
  const project=await query<{id:string}>('SELECT id::text FROM projects WHERE id=$1 AND organization_id=$2 LIMIT 1',[projectId,session.organizationId]);
  if(!project.rows[0])return NextResponse.json({error:'Project not found in this organization'},{status:404});
  const snapshot=await query<any>(
   'SELECT pis.id::text,pis.compilation_id::text,pis.version,pis.payload_sha256,pis.requirement_count,pis.finding_count,pis.created_at,sc.revision spatial_revision FROM power_intelligence_snapshots pis JOIN spatial_compilations sc ON sc.id=pis.compilation_id WHERE pis.organization_id=$1 AND pis.project_id=$2 ORDER BY sc.revision DESC,pis.created_at DESC LIMIT 1',
   [session.organizationId,projectId]
  );
  const latest=snapshot.rows[0]||null;
  if(!latest)return NextResponse.json({schemaReady:true,latest:null,requirements:[],findings:[],truthBoundary:'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW'});
  const requirements=await query<any>(
   'SELECT id::text,source_entity_id,source_name,source_discipline,equipment_class,asset_tag,status,authority_class,confidence,electrical_data,assumptions,matched_electrical_entity_ids,created_at FROM expected_power_requirements WHERE organization_id=$1 AND snapshot_id=$2 ORDER BY source_discipline,asset_tag NULLS LAST,source_entity_id',
   [session.organizationId,latest.id]
  );
  const findings=await query<any>(
   "SELECT f.id::text,f.source_finding_id,f.finding_type,f.title,f.detail,f.electrical_entity_refs,f.confidence,f.human_control_level,f.created_at,r.source_entity_id,r.asset_tag,r.equipment_class,disp.action disposition_action,disp.reason disposition_reason,disp.occurred_at disposition_occurred_at,disp.actor_user_id::text disposition_actor_user_id FROM power_gap_findings f JOIN expected_power_requirements r ON r.id=f.expected_power_requirement_id LEFT JOIN LATERAL (SELECT d.action,d.reason,d.occurred_at,d.actor_user_id FROM power_finding_dispositions d WHERE d.organization_id=f.organization_id AND d.finding_id=f.id ORDER BY d.occurred_at DESC,d.id DESC LIMIT 1) disp ON true WHERE f.organization_id=$1 AND f.snapshot_id=$2 ORDER BY CASE f.finding_type WHEN 'EMERGENCY_POWER_REVIEW' THEN 1 WHEN 'VOLTAGE_PHASE_MISMATCH' THEN 2 WHEN 'MISSING_FEED' THEN 3 ELSE 4 END,f.created_at,f.id",
   [session.organizationId,latest.id]
  );
  return NextResponse.json({schemaReady:true,latest,requirements:requirements.rows,findings:findings.rows,truthBoundary:'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW'},{headers:{'cache-control':'no-store'}});
 }catch(error:any){return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'no-store'}})}
}

export async function PATCH(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  if(!await schemaReady())return NextResponse.json({error:'Expected Power persistence schema is not ready'},{status:503});
  const body=PatchBody.parse(await req.json());
  const result=await tx(async client=>{
   const finding=await client.query<{id:string}>('SELECT id::text FROM power_gap_findings WHERE id=$1 AND organization_id=$2 FOR SHARE',[body.findingId,session.organizationId]);
   if(!finding.rows[0])throw Object.assign(new Error('Power finding not found in this organization'),{status:404});
   const current=await client.query<any>('SELECT id::text,action,reason,occurred_at FROM power_finding_dispositions WHERE organization_id=$1 AND finding_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1',[session.organizationId,body.findingId]);
   if(current.rows[0]?.action===body.action&&current.rows[0]?.reason===body.reason)return{...current.rows[0],idempotent:true};
   const inserted=await client.query<any>('INSERT INTO power_finding_dispositions (organization_id,finding_id,action,reason,actor_user_id) VALUES($1,$2,$3,$4,$5) RETURNING id::text,action,reason,occurred_at',[session.organizationId,body.findingId,body.action,body.reason,session.userId]);
   return{...inserted.rows[0],idempotent:false};
  });
  return NextResponse.json({...result,truthBoundary:'FINDING_DISPOSITION_DOES_NOT_ESTABLISH_CODE_COMPLIANCE_ENGINEERING_APPROVAL_OR_PHYSICAL_TRUTH'},{headers:{'cache-control':'no-store'}});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid power finding disposition',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'no-store'}});
 }
}
