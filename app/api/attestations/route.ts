import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession,type SessionRole} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';
import {sha256} from '@/lib/server/hash';

const AttestationType=z.enum(['WORK_PERFORMED','INSPECTION_OBSERVATION','SUPERVISOR_REVIEW','CLIENT_ACKNOWLEDGEMENT','ENGINEERING_REVIEW','OEM_CONFORMANCE']);
type AttestationTypeValue=z.infer<typeof AttestationType>;
type Capacity='TECHNICIAN'|'INSPECTOR'|'SUPERVISOR'|'CLIENT_REP'|'ENGINEER'|'OEM_REP';

const Body=z.object({
 lifecycleEventId:z.string().uuid(),
 attestationType:AttestationType,
 statement:z.string().trim().min(5).max(2000),
 observedAt:z.string().datetime().optional()
});

const capacityByRole:Partial<Record<SessionRole,Capacity>>={
 TECHNICIAN:'TECHNICIAN',
 INSPECTOR:'INSPECTOR',
 PROJECT_MANAGER:'SUPERVISOR',
 ORG_ADMIN:'SUPERVISOR',
 SUPER_ADMIN:'SUPERVISOR',
 CLIENT:'CLIENT_REP'
};

const typeByCapacity:Record<Capacity,AttestationTypeValue[]>={
 TECHNICIAN:['WORK_PERFORMED'],
 INSPECTOR:['INSPECTION_OBSERVATION'],
 SUPERVISOR:['SUPERVISOR_REVIEW'],
 CLIENT_REP:['CLIENT_ACKNOWLEDGEMENT'],
 ENGINEER:['ENGINEERING_REVIEW'],
 OEM_REP:['OEM_CONFORMANCE']
};

async function schemaReady(){
 const r=await query<{ready:boolean}>(`SELECT to_regclass('public.human_attestations') IS NOT NULL ready`);
 return Boolean(r.rows[0]?.ready);
}

function responseContext(role:SessionRole){
 const capacity=capacityByRole[role]||null;
 return {capacity,allowedAttestationTypes:capacity?typeByCapacity[capacity]:[]};
}

function errorStatus(error:unknown,otherwise=400){
 return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||otherwise:otherwise;
}

export async function GET(req:Request){
 try{
  const session=await requireSession();
  const assetId=z.string().uuid().parse(new URL(req.url).searchParams.get('assetId'));
  const context=responseContext(session.role);
  if(!await schemaReady())return NextResponse.json({schemaReady:false,...context,attestations:[],truthBoundary:'HUMAN_ATTESTATION_IS_EVIDENCE_STATEMENT_NOT_APPROVAL_OR_FINALITY'});
  const result=await query<any>(`SELECT ha.id::text,ha.lifecycle_event_id::text,ha.attestation_type,ha.attestor_capacity,ha.statement,ha.statement_sha256,ha.observed_at,ha.actor_user_id::text,ha.authentication_assurance,ha.cryptographic_signature IS NOT NULL cryptographically_signed,ha.capacity_credential_ref,ha.created_at,u.display_name actor_name,le.event_type::text lifecycle_event_type,le.status::text lifecycle_event_status
    FROM human_attestations ha
    JOIN assets a ON a.id=ha.asset_id AND a.organization_id=ha.organization_id
    JOIN lifecycle_events le ON le.id=ha.lifecycle_event_id AND le.organization_id=ha.organization_id
    LEFT JOIN users u ON u.id=ha.actor_user_id
    WHERE ha.asset_id=$1 AND ha.organization_id=$2
    ORDER BY ha.created_at DESC,ha.id DESC LIMIT 200`,[assetId,session.organizationId]);
  return NextResponse.json({schemaReady:true,...context,attestations:result.rows,truthBoundary:'HUMAN_ATTESTATION_IS_EVIDENCE_STATEMENT_NOT_APPROVAL_OR_FINALITY'});
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:errorStatus(error)});
 }
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','CLIENT','INSPECTOR']);
  if(!await schemaReady())return NextResponse.json({error:'Human attestation schema is not ready'},{status:503});
  const body=Body.parse(await req.json());
  const capacity=capacityByRole[session.role];
  if(!capacity)return NextResponse.json({error:'Current membership role cannot create human attestations'},{status:403});
  if(!typeByCapacity[capacity].includes(body.attestationType))return NextResponse.json({error:`${capacity} may not create ${body.attestationType} attestations`},{status:403});
  const observedAt=body.observedAt||new Date().toISOString();
  const statementHash=sha256(body.statement);

  const result=await tx(async client=>{
   const event=await client.query<any>(`SELECT le.id::text,le.project_id::text,le.asset_id::text
     FROM lifecycle_events le
     JOIN assets a ON a.id=le.asset_id AND a.organization_id=le.organization_id
     JOIN projects p ON p.id=le.project_id AND p.organization_id=le.organization_id
     WHERE le.id=$1 AND le.organization_id=$2 FOR SHARE`,[body.lifecycleEventId,session.organizationId]);
   if(!event.rows[0])throw Object.assign(new Error('Lifecycle event not found in active organization'),{status:404});
   const existing=await client.query<any>(`SELECT id::text,created_at FROM human_attestations
     WHERE organization_id=$1 AND lifecycle_event_id=$2 AND actor_user_id=$3 AND attestation_type=$4 AND statement_sha256=$5 LIMIT 1`,[session.organizationId,body.lifecycleEventId,session.userId,body.attestationType,statementHash]);
   if(existing.rows[0])return {...existing.rows[0],idempotent:true};
   const inserted=await client.query<any>(`INSERT INTO human_attestations
     (organization_id,project_id,asset_id,lifecycle_event_id,attestation_type,attestor_capacity,statement,statement_sha256,observed_at,actor_user_id,authentication_assurance)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'SESSION')
     RETURNING id::text,created_at`,[session.organizationId,event.rows[0].project_id,event.rows[0].asset_id,body.lifecycleEventId,body.attestationType,capacity,body.statement,statementHash,observedAt,session.userId]);
   return {...inserted.rows[0],idempotent:false};
  });

  return NextResponse.json({...result,attestorCapacity:capacity,authenticationAssurance:'SESSION',truthBoundary:'ATTESTATION_DOES_NOT_APPROVE_LIFECYCLE_OR_ESTABLISH_DIR_POVI_OR_PHYSICAL_TRUTH'},{status:result.idempotent?200:201});
 }catch(error:any){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid human attestation',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:errorStatus(error)});
 }
}
