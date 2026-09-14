import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {tx} from '@/lib/server/db';
import {canonicalHash,sha256} from '@/lib/server/hash';
import {createCanonicalEvidence} from '@/lib/redbook/adapters/evidence';

const MAX=25*1024*1024;
const VISIBILITY=new Set(['PRIVATE','CLIENT','PUBLIC']);

export async function POST(req:Request){
 try{
  const s=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN','INSPECTOR']);
  const form=await req.formData();
  const file=form.get('file');
  const lifecycleEventId=String(form.get('lifecycleEventId')||'');
  const assetId=String(form.get('assetId')||'');
  const kind=String(form.get('kind')||'Evidence');
  const visibility=String(form.get('visibility')||'PRIVATE');
  const claimed=String(form.get('sha256')||'').toLowerCase();
  if(!(file instanceof File)||!lifecycleEventId||!assetId)return NextResponse.json({error:'file, lifecycleEventId and assetId are required'},{status:400});
  if(!VISIBILITY.has(visibility))return NextResponse.json({error:'Invalid evidence visibility'},{status:400});
  if(file.size>MAX)return NextResponse.json({error:'File exceeds 25 MB evidence limit'},{status:413});
  const bytes=Buffer.from(await file.arrayBuffer());
  const digest=sha256(bytes);
  if(claimed&&claimed!==digest)return NextResponse.json({error:'Client SHA-256 does not match server SHA-256'},{status:422});

  const out=await tx(async c=>{
   const context=await c.query<{project_id:string}>(
    `SELECT le.project_id FROM lifecycle_events le JOIN assets a ON a.id=$3 AND a.organization_id=$1 WHERE le.id=$2 AND le.organization_id=$1 AND le.asset_id=$3 LIMIT 1`,
    [s.organizationId,lifecycleEventId,assetId],
   );
   if(!context.rows[0])throw new Error('Lifecycle event and asset linkage not found in active organization');

   const replayKey=`${s.organizationId}:${lifecycleEventId}:${assetId}:${kind}:${digest}`;
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[replayKey]);
   const existing=await c.query<any>(`SELECT ev.*,EXISTS(SELECT 1 FROM evidence_files ef WHERE ef.evidence_id=ev.id) file_stored
     FROM evidence ev
     WHERE ev.organization_id=$1 AND ev.lifecycle_event_id=$2 AND ev.asset_id=$3 AND ev.kind=$4 AND ev.sha256=$5
     ORDER BY ev.created_at ASC,ev.id ASC LIMIT 1`,[s.organizationId,lifecycleEventId,assetId,kind,digest]);
   if(existing.rows[0]){
    if(!existing.rows[0].file_stored)throw new Error('Existing evidence metadata is incomplete; file storage repair is required before retry');
    return{row:existing.rows[0],idempotent:true};
   }

   const e=await c.query<any>(
    `INSERT INTO evidence(organization_id,lifecycle_event_id,asset_id,kind,file_name,mime_type,sha256,visibility,captured_by,captured_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),'{}'::jsonb) RETURNING *`,
    [s.organizationId,lifecycleEventId,assetId,kind,file.name,file.type||'application/octet-stream',digest,visibility,s.userId],
   );
   const row=e.rows[0];
   const capturedAt=row.captured_at instanceof Date?row.captured_at.toISOString():new Date(row.captured_at).toISOString();
   const canonicalEvidence=createCanonicalEvidence({
    evidenceId:String(row.id),tenantId:s.organizationId,organizationId:s.organizationId,projectId:context.rows[0].project_id,
    assetId,lifecycleEventId,evidenceType:kind,contentHash:digest,fileName:file.name,mimeType:file.type||'application/octet-stream',
    storageRef:`db:evidence_files:${row.id}`,capturedBy:s.userId,capturedAt,retentionClass:visibility==='PUBLIC'?'R2':'R3',
   });
   const canonicalEvidenceHash=canonicalHash(canonicalEvidence);
   const metadata={_stratumCanonicalEvidence:canonicalEvidence,_stratumCanonicalEvidenceHash:canonicalEvidenceHash};
   await c.query(`UPDATE evidence SET metadata=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(metadata)]);
   await c.query(`INSERT INTO evidence_files(evidence_id,content,byte_size) VALUES($1,$2,$3)`,[row.id,bytes,bytes.length]);
   return{row:{...row,metadata,canonicalEvidence,canonicalEvidenceHash},idempotent:false};
  });

  return NextResponse.json({...out.row,sha256:digest,fileStored:true,idempotent:out.idempotent},{status:out.idempotent?200:201});
 }catch(e:any){
  return NextResponse.json({error:e.message},{status:e.status||400});
 }
}
