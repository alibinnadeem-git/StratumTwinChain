import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';
import {canonicalHash} from '@/lib/server/hash';
import {createCanonicalEvidence} from '@/lib/redbook/adapters/evidence';

const Body=z.object({
 lifecycleEventId:z.string().uuid(),
 assetId:z.string().uuid(),
 kind:z.string().min(1),
 fileName:z.string().min(1),
 mimeType:z.string().optional(),
 sha256:z.string().regex(/^[a-f0-9]{64}$/i),
 storageUri:z.string().optional(),
 visibility:z.enum(['PRIVATE','CLIENT','PUBLIC']).default('PRIVATE'),
 metadata:z.record(z.string(),z.unknown()).default({}),
});

export async function POST(req:Request){
 try{
  const s=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','INSPECTOR']);
  const b=Body.parse(await req.json());
  const digest=b.sha256.toLowerCase();
  const out=await tx(async c=>{
   const context=await c.query<{project_id:string}>(
    `SELECT le.project_id FROM lifecycle_events le JOIN assets a ON a.id=$3 AND a.organization_id=$1 WHERE le.id=$2 AND le.organization_id=$1 AND le.asset_id=$3 LIMIT 1`,
    [s.organizationId,b.lifecycleEventId,b.assetId],
   );
   if(!context.rows[0])throw new Error('Lifecycle event and asset linkage not found in active organization');
   const r=await c.query<any>(
    `INSERT INTO evidence(organization_id,lifecycle_event_id,asset_id,kind,file_name,mime_type,storage_uri,sha256,visibility,captured_by,captured_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11::jsonb) RETURNING *`,
    [s.organizationId,b.lifecycleEventId,b.assetId,b.kind,b.fileName,b.mimeType||null,b.storageUri||null,digest,b.visibility,s.userId,JSON.stringify(b.metadata)],
   );
   const row=r.rows[0];
   const capturedAt=row.captured_at instanceof Date?row.captured_at.toISOString():new Date(row.captured_at).toISOString();
   const canonicalEvidence=createCanonicalEvidence({
    evidenceId:String(row.id),tenantId:s.organizationId,organizationId:s.organizationId,projectId:context.rows[0].project_id,
    assetId:b.assetId,lifecycleEventId:b.lifecycleEventId,evidenceType:b.kind,contentHash:digest,fileName:b.fileName,
    mimeType:b.mimeType||null,storageRef:b.storageUri||null,capturedBy:s.userId,capturedAt,
    sourceType:'REGISTERED_EVIDENCE_REFERENCE',retentionClass:b.visibility==='PUBLIC'?'R2':'R3',
   });
   const canonicalEvidenceHash=canonicalHash(canonicalEvidence);
   const metadata={...b.metadata,_stratumCanonicalEvidence:canonicalEvidence,_stratumCanonicalEvidenceHash:canonicalEvidenceHash};
   await c.query(`UPDATE evidence SET metadata=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(metadata)]);
   return{...row,metadata,canonicalEvidence,canonicalEvidenceHash};
  });
  return NextResponse.json(out,{status:201});
 }catch(e:any){
  return NextResponse.json({error:e.message},{status:e.status||400});
 }
}
