import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession,type SessionRole} from '@/lib/server/auth';
import {tx} from '@/lib/server/db';
import {sha256} from '@/lib/server/hash';
import {getLedger} from '@/lib/server/chain';
import {verifyApprovalSignature} from '@/lib/server/signature';

const Jwk=z.object({
 kty:z.string(),crv:z.string().optional(),x:z.string().optional(),y:z.string().optional(),
 alg:z.string().optional(),ext:z.boolean().optional(),key_ops:z.array(z.string()).optional()
}).passthrough();

const Body=z.object({
 lifecycleEventId:z.string().uuid(),
 decision:z.enum(['APPROVED','REJECTED']),
 comment:z.string().max(1000).optional(),
 signature:z.string().min(16),
 publicKeyJwk:Jwk
});

type PolicyRow={approvals_required:number;allowed_roles:string[];require_evidence:boolean};

const DEFAULT_POLICY:PolicyRow={
 approvals_required:1,
 allowed_roles:['INSPECTOR','PROJECT_MANAGER','ORG_ADMIN','SUPER_ADMIN'],
 require_evidence:true,
};

function httpError(message:string,status:number){return Object.assign(new Error(message),{status})}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR']);
  const body=Body.parse(await req.json());

  const result=await tx(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[body.lifecycleEventId]);

   const eventResult=await client.query<any>(`
     SELECT *
     FROM lifecycle_events
     WHERE id=$1 AND organization_id=$2
     LIMIT 1
     FOR UPDATE
   `,[body.lifecycleEventId,session.organizationId]);
   const event=eventResult.rows[0];
   if(!event)throw httpError('Lifecycle event not found',404);
   const evidenceResult=await client.query<{sha256:string}>(`
     SELECT sha256 FROM evidence
     WHERE lifecycle_event_id=$1 AND organization_id=$2
     ORDER BY sha256
   `,[body.lifecycleEventId,session.organizationId]);
   event.evidence_hashes=evidenceResult.rows.map(row=>row.sha256);
   event.evidence_count=evidenceResult.rows.length;

   if(event.status==='VERIFIED'||event.status==='FINALIZED'){
    const receipt=await client.query<any>(`SELECT network,tx_hash,block_height::text,anchored_at FROM ledger_records WHERE organization_id=$1 AND lifecycle_event_id=$2 LIMIT 1`,[session.organizationId,body.lifecycleEventId]);
    return{status:'VERIFIED',alreadyFinalized:true,receipt:receipt.rows[0]||null};
   }
   if(event.status==='REJECTED')throw httpError('Rejected lifecycle events cannot be approved; submit a new corrected event.',409);
   if(event.performed_by===session.userId)throw httpError('Separation of duties: performer cannot approve the same lifecycle event.',409);
   if(!verifyApprovalSignature(event.payload_sha256,body.signature,body.publicKeyJwk as JsonWebKey))throw httpError('Approval signature could not be cryptographically verified.',422);

   const policyResult=await client.query<PolicyRow>(`
     SELECT approvals_required,allowed_roles,require_evidence
     FROM approval_policies
     WHERE organization_id=$1 AND project_id=$2 AND is_active=true
     LIMIT 1
   `,[session.organizationId,event.project_id]);
   const policy=policyResult.rows[0]||DEFAULT_POLICY;
   if(!policy.allowed_roles.includes(session.role as SessionRole))throw httpError('Your role is not authorized by this project approval policy.',403);

   const priorDecision=await client.query<{decision:string}>(`
     SELECT decision FROM approvals
     WHERE organization_id=$1 AND lifecycle_event_id=$2 AND approver_user_id=$3
     LIMIT 1
   `,[session.organizationId,body.lifecycleEventId,session.userId]);
   if(priorDecision.rows[0]&&priorDecision.rows[0].decision!==body.decision){
    throw httpError('This approver already recorded a different decision for the lifecycle event.',409);
   }

   if(body.decision==='REJECTED'){
    if(!priorDecision.rows[0]){
     await client.query(`
       INSERT INTO approvals(organization_id,lifecycle_event_id,approver_user_id,decision,comment,signature,public_key_jwk)
       VALUES($1,$2,$3,'REJECTED',$4,$5,$6)
     `,[session.organizationId,body.lifecycleEventId,session.userId,body.comment||null,body.signature,JSON.stringify(body.publicKeyJwk)]);
    }
    await client.query(`UPDATE lifecycle_events SET status='REJECTED',approved_by=$1 WHERE id=$2 AND organization_id=$3`,[session.userId,body.lifecycleEventId,session.organizationId]);
    return{status:'REJECTED'};
   }

   if(policy.require_evidence&&Number(event.evidence_count)<1){
    throw httpError('Project approval policy requires evidence before this lifecycle event can be finalized.',409);
   }

   if(!priorDecision.rows[0]){
    await client.query(`
      INSERT INTO approvals(organization_id,lifecycle_event_id,approver_user_id,decision,comment,signature,public_key_jwk)
      VALUES($1,$2,$3,'APPROVED',$4,$5,$6)
    `,[session.organizationId,body.lifecycleEventId,session.userId,body.comment||null,body.signature,JSON.stringify(body.publicKeyJwk)]);
   }

   const countResult=await client.query<{approved_count:number}>(`
     SELECT count(DISTINCT approver_user_id)::int approved_count
     FROM approvals
     WHERE organization_id=$1 AND lifecycle_event_id=$2 AND decision='APPROVED'
   `,[session.organizationId,body.lifecycleEventId]);
   const approvedCount=Number(countResult.rows[0]?.approved_count||0);
   const approvalsRequired=Math.max(1,Number(policy.approvals_required)||1);
   if(approvedCount<approvalsRequired){
    return{status:'APPROVAL_PENDING',approvedCount,approvalsRequired,evidenceCount:Number(event.evidence_count)};
   }

   const existingReceipt=await client.query<any>(`
     SELECT network,record_id,tx_hash,block_height::text,anchored_at
     FROM ledger_records
     WHERE organization_id=$1 AND lifecycle_event_id=$2
     LIMIT 1
   `,[session.organizationId,body.lifecycleEventId]);
   if(existingReceipt.rows[0]){
    await client.query(`UPDATE lifecycle_events SET status='VERIFIED' WHERE id=$1 AND organization_id=$2`,[body.lifecycleEventId,session.organizationId]);
    return{status:'VERIFIED',alreadyFinalized:true,approvedCount,approvalsRequired,receipt:existingReceipt.rows[0]};
   }

   const evidenceHash=sha256((event.evidence_hashes as string[]).join(''));
   const record={
    organizationId:session.organizationId,
    projectId:event.project_id,
    assetId:event.asset_id,
    recordId:event.id,
    type:event.event_type,
    evidenceHash,
    timestamp:new Date(event.occurred_at).toISOString(),
    signer:process.env.STRATUM_CHAIN_SIGNER_ADDRESS||`user:${session.userId}`,
    payloadHash:event.payload_sha256
   };

   // getLedger fails closed in production when a real DIR RPC is not configured.
   // Keeping the database advisory lock through the anchor prevents concurrent
   // approvers from issuing duplicate finalization requests for the same event.
   const receipt=await getLedger().anchor(record);

   await client.query(`
     UPDATE lifecycle_events
     SET status='VERIFIED',approved_by=$1,evidence_package_sha256=$2,signer_address=$3,
         ledger_network=$4,ledger_tx_hash=$5,ledger_block_height=$6,anchored_at=$7
     WHERE id=$8 AND organization_id=$9
   `,[session.userId,evidenceHash,record.signer,receipt.network,receipt.txHash,receipt.blockHeight,receipt.timestamp,body.lifecycleEventId,session.organizationId]);

   await client.query(`
     INSERT INTO ledger_records(organization_id,lifecycle_event_id,network,record_id,tx_hash,block_height,payload_hash,evidence_hash,signer_address,anchored_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
   `,[session.organizationId,body.lifecycleEventId,receipt.network,event.id,receipt.txHash,receipt.blockHeight,event.payload_sha256,evidenceHash,record.signer,receipt.timestamp]);

   return{
    status:'VERIFIED',
    approvedCount,
    approvalsRequired,
    evidenceCount:Number(event.evidence_count),
    receipt,
    evidenceHash,
    truthBoundary:'DIR_FINALITY_SECURES_THE_RECORD_AND_DOES_NOT_INDEPENDENTLY_ESTABLISH_PHYSICAL_TRUTH'
   };
  });

  return NextResponse.json(result,{status:result.status==='APPROVAL_PENDING'?202:200});
 }catch(error){
  const e=error as Error&{status?:number};
  return NextResponse.json({error:e.message||'Approval failed'},{status:e.status||400});
 }
}
