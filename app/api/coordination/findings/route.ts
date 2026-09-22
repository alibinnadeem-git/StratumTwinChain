import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';

const ProjectId=z.string().uuid();
const Disposition=z.object({
 findingId:z.string().uuid(),
 action:z.enum(['ACKNOWLEDGE','DISMISS','REOPEN','ENGINEERING_REVIEW_REQUIRED']),
 reason:z.string().trim().min(5).max(1000)
});
const ActionRequest=z.object({
 findingId:z.string().uuid(),
 actionType:z.enum(['RFI','NCR','WORK_ORDER','CHANGE','ENGINEERING_REVIEW']),
 title:z.string().trim().min(3).max(500),
 context:z.record(z.string(),z.unknown()).optional()
});
function status(error:unknown,otherwise=400){return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise}
async function schemaReady(){
 const r=await query<{ready:boolean}>("SELECT to_regclass('public.coordination_snapshots') IS NOT NULL AND to_regclass('public.coordination_findings') IS NOT NULL AND to_regclass('public.coordination_finding_dispositions') IS NOT NULL AND to_regclass('public.coordination_action_requests') IS NOT NULL ready");
 return Boolean(r.rows[0]?.ready);
}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  if(!await schemaReady())return NextResponse.json({schemaReady:false,latest:null,findings:[],actionRequests:[],truthBoundary:'COORDINATION_FINDINGS_REQUIRE_HUMAN_REVIEW'});
  const projectId=new URL(req.url).searchParams.get('projectId')||'';
  if(!ProjectId.safeParse(projectId).success)return NextResponse.json({error:'projectId must be a UUID'},{status:400});
  const project=await query<{id:string}>('SELECT id::text FROM projects WHERE id=$1 AND organization_id=$2 LIMIT 1',[projectId,session.organizationId]);
  if(!project.rows[0])return NextResponse.json({error:'Project not found in this organization'},{status:404});
  const snapshot=await query<any>(
   'SELECT cs.id::text,cs.compilation_id::text,cs.version,cs.payload_sha256,cs.finding_count,cs.created_at,sc.revision spatial_revision FROM coordination_snapshots cs JOIN spatial_compilations sc ON sc.id=cs.compilation_id WHERE cs.organization_id=$1 AND cs.project_id=$2 ORDER BY sc.revision DESC,cs.created_at DESC LIMIT 1',
   [session.organizationId,projectId]
  );
  const latest=snapshot.rows[0]||null;
  if(!latest)return NextResponse.json({schemaReady:true,latest:null,findings:[],actionRequests:[],truthBoundary:'COORDINATION_FINDINGS_REQUIRE_HUMAN_REVIEW'});
  const findings=await query<any>(
   "SELECT f.id::text,f.source_finding_id,f.finding_type,f.title,f.detail,f.entity_refs,f.source_refs,f.comparison,f.confidence,f.human_control_level,f.created_at,disp.action disposition_action,disp.reason disposition_reason,disp.occurred_at disposition_occurred_at FROM coordination_findings f LEFT JOIN LATERAL (SELECT d.action,d.reason,d.occurred_at FROM coordination_finding_dispositions d WHERE d.organization_id=f.organization_id AND d.finding_id=f.id ORDER BY d.occurred_at DESC,d.id DESC LIMIT 1) disp ON true WHERE f.organization_id=$1 AND f.snapshot_id=$2 ORDER BY CASE f.human_control_level WHEN 'H3' THEN 1 ELSE 2 END,f.finding_type,f.created_at,f.id",
   [session.organizationId,latest.id]
  );
  const actionRequests=await query<any>(
   'SELECT ar.id::text,ar.finding_id::text,ar.action_type,ar.title,ar.context,ar.status,ar.requested_by::text,ar.created_at FROM coordination_action_requests ar JOIN coordination_findings f ON f.id=ar.finding_id WHERE ar.organization_id=$1 AND f.snapshot_id=$2 ORDER BY ar.created_at DESC',
   [session.organizationId,latest.id]
  );
  return NextResponse.json({schemaReady:true,latest,findings:findings.rows,actionRequests:actionRequests.rows,truthBoundary:'COORDINATION_FINDINGS_DO_NOT_ESTABLISH_PHYSICAL_CLASH_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL'},{headers:{'cache-control':'no-store'}});
 }catch(error:any){return NextResponse.json({error:error.message},{status:status(error,500),headers:{'cache-control':'no-store'}})}
}

export async function PATCH(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  if(!await schemaReady())return NextResponse.json({error:'Coordination persistence schema is not ready'},{status:503});
  const body=Disposition.parse(await req.json());
  const result=await tx(async client=>{
   const finding=await client.query<{id:string}>('SELECT id::text FROM coordination_findings WHERE id=$1 AND organization_id=$2 FOR SHARE',[body.findingId,session.organizationId]);
   if(!finding.rows[0])throw Object.assign(new Error('Coordination finding not found in this organization'),{status:404});
   const current=await client.query<any>('SELECT id::text,action,reason,occurred_at FROM coordination_finding_dispositions WHERE organization_id=$1 AND finding_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1',[session.organizationId,body.findingId]);
   if(current.rows[0]?.action===body.action&&current.rows[0]?.reason===body.reason)return{...current.rows[0],idempotent:true};
   const inserted=await client.query<any>('INSERT INTO coordination_finding_dispositions (organization_id,finding_id,action,reason,actor_user_id) VALUES($1,$2,$3,$4,$5) RETURNING id::text,action,reason,occurred_at',[session.organizationId,body.findingId,body.action,body.reason,session.userId]);
   return{...inserted.rows[0],idempotent:false};
  });
  return NextResponse.json({...result,truthBoundary:'DISPOSITION_DOES_NOT_REWRITE_SOURCE_EVIDENCE_OR_ESTABLISH_ENGINEERING_APPROVAL'},{headers:{'cache-control':'no-store'}});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid coordination disposition',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'no-store'}});
 }
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  if(!await schemaReady())return NextResponse.json({error:'Coordination persistence schema is not ready'},{status:503});
  const body=ActionRequest.parse(await req.json());
  const result=await tx(async client=>{
   const finding=await client.query<{id:string;project_id:string;finding_type:string;title:string;detail:string}>(
    'SELECT f.id::text,cs.project_id::text,f.finding_type,f.title,f.detail FROM coordination_findings f JOIN coordination_snapshots cs ON cs.id=f.snapshot_id WHERE f.id=$1 AND f.organization_id=$2 FOR SHARE',
    [body.findingId,session.organizationId]
   );
   if(!finding.rows[0])throw Object.assign(new Error('Coordination finding not found in this organization'),{status:404});
   const row=finding.rows[0];
   const context={findingType:row.finding_type,findingTitle:row.title,findingDetail:row.detail,...(body.context||{})};
   const inserted=await client.query<any>(
    'INSERT INTO coordination_action_requests (organization_id,project_id,finding_id,action_type,title,context,requested_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id::text,action_type,title,status,created_at',
    [session.organizationId,row.project_id,body.findingId,body.actionType,body.title,JSON.stringify(context),session.userId]
   );
   return inserted.rows[0];
  });
  return NextResponse.json({...result,truthBoundary:'ACTION_REQUEST_IS_NOT_AN_APPROVED_RFI_NCR_WORK_ORDER_CHANGE_OR_ENGINEERING_DECISION'},{status:201,headers:{'cache-control':'no-store'}});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid coordination action request',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:status(error),headers:{'cache-control':'no-store'}});
 }
}
