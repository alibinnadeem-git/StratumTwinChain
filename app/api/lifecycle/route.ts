import {randomUUID} from 'crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query} from '@/lib/server/db';
import {canonicalHash} from '@/lib/server/hash';
import {
 canonicalEventForLegacy,
 createLifecycleMicroDirCandidate,
 legacyLifecycleEventTypes,
 type LegacyLifecycleEventType,
} from '@/lib/redbook/adapters/lifecycle';
import {deriveAssetLifecycleState,validateStateTransition} from '@/lib/redbook/registry/state-transitions';

const Body=z.object({
 projectId:z.string().uuid(),
 assetId:z.string().uuid(),
 workOrderId:z.string().uuid().nullable().optional(),
 eventType:z.enum(legacyLifecycleEventTypes),
 occurredAt:z.string().datetime().optional(),
 payload:z.record(z.string(),z.unknown()).default({}),
});

function isLegacyEvent(value:string):value is LegacyLifecycleEventType{
 return (legacyLifecycleEventTypes as readonly string[]).includes(value);
}

export async function POST(req:Request){
 try{
  const s=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','INSPECTOR']);
  const b=Body.parse(await req.json());

  const asset=await query<{id:string}>(
   `SELECT id FROM assets WHERE id=$1 AND project_id=$2 AND organization_id=$3 LIMIT 1`,
   [b.assetId,b.projectId,s.organizationId],
  );
  if(!asset.rows[0])return NextResponse.json({error:'Asset not found in the requested project/organization'},{status:404});

  const history=await query<{event_type:string}>(
   `SELECT event_type FROM lifecycle_events WHERE organization_id=$1 AND project_id=$2 AND asset_id=$3 AND status IN ('VERIFIED','FINALIZED') ORDER BY occurred_at ASC,id ASC`,
   [s.organizationId,b.projectId,b.assetId],
  );
  const canonicalHistory=history.rows
   .map(row=>row.event_type)
   .filter(isLegacyEvent)
   .map(canonicalEventForLegacy);
  const currentState=deriveAssetLifecycleState(canonicalHistory);
  const canonicalEventType=canonicalEventForLegacy(b.eventType);
  const transition=validateStateTransition({eventType:canonicalEventType,currentState,finalizedEvents:canonicalHistory});

  // Existing tenants may predate the canonical registry. Do not fabricate missing historical events.
  // Allow a migration-safe candidate with no proposed state transition and surface the gap explicitly.
  const migrationBootstrap=canonicalHistory.length===0&&b.eventType!=='REGISTER_ASSET';
  if(!transition.ok&&!migrationBootstrap){
   return NextResponse.json({
    error:'Canonical lifecycle transition rejected',
    canonicalEventType,
    currentState,
    transitionErrors:transition.errors,
   },{status:409});
  }

  const eventOccurredAt=b.occurredAt||new Date().toISOString();
  const submittedAt=new Date().toISOString();
  const payloadHash=canonicalHash(b.payload);
  const microDirId=randomUUID();
  const microDirCandidate=createLifecycleMicroDirCandidate({
   microDirId,
   tenantId:s.organizationId,
   organizationId:s.organizationId,
   projectId:b.projectId,
   assetId:b.assetId,
   actorRef:s.userId,
   workOrderId:b.workOrderId||null,
   legacyEventType:b.eventType,
   eventOccurredAt,
   submittedAt,
   payloadHash,
   currentState,
   transitionValidated:transition.ok,
  });
  const hash=canonicalHash(microDirCandidate);

  const r=await query(
   `INSERT INTO lifecycle_events(organization_id,project_id,asset_id,work_order_id,event_type,status,performed_by,occurred_at,canonical_payload,payload_sha256) VALUES($1,$2,$3,$4,$5,'SUBMITTED',$6,$7,$8,$9) RETURNING *`,
   [s.organizationId,b.projectId,b.assetId,b.workOrderId||null,b.eventType,s.userId,eventOccurredAt,JSON.stringify(microDirCandidate),hash],
  );

  return NextResponse.json({
   ...r.rows[0],
   canonicalHash:hash,
   microDirId,
   canonicalEventType,
   schemaVersion:microDirCandidate.schemaVersion,
   trustClass:microDirCandidate.trustClass,
   currentState,
   proposedStateTransition:microDirCandidate.proposedStateTransition,
   migrationWarnings:migrationBootstrap?[
    'Legacy asset has no canonicalized finalized lifecycle history. Candidate accepted without inventing prerequisite events; migrate historical evidence before PoVI finality.',
    ...transition.errors,
   ]:[],
  },{status:201});
 }catch(e:any){
  return NextResponse.json({error:e.message},{status:e.status||400});
 }
}
