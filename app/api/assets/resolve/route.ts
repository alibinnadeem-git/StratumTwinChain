import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {query} from '@/lib/server/db';
import {assetArchiveSchemaReady} from '@/lib/server/live-views';

export async function GET(req:Request){
 try{
  const session=await requireSession();
  const q=new URL(req.url).searchParams.get('q')?.trim();
  if(!q)return NextResponse.json({error:'q is required'},{status:400});
  if(q.length>512)return NextResponse.json({error:'q is too long'},{status:400});

  const r=await query<any>(`SELECT a.id::text,a.asset_code,a.asset_type,a.name,a.serial_number,a.location_label,a.status,
    p.id::text project_id,p.project_code,p.name project_name,si.name site_name,sy.name system_name
    FROM assets a
    JOIN projects p ON p.id=a.project_id AND p.organization_id=a.organization_id
    JOIN sites si ON si.id=a.site_id AND si.organization_id=a.organization_id
    LEFT JOIN systems sy ON sy.id=a.system_id AND sy.organization_id=a.organization_id
    WHERE a.organization_id=$2
      AND (a.id::text=$1 OR a.asset_code=$1 OR a.serial_number=$1 OR a.qr_token::text=$1)
    LIMIT 1`,[q,session.organizationId]);
  const asset=r.rows[0];
  if(!asset)return NextResponse.json({error:'Asset not found in active organization'},{status:404});

  let administrativeState='ACTIVE',archiveReason:string|null=null,archiveOccurredAt:string|null=null;
  if(await assetArchiveSchemaReady()){
   const state=await query<any>(`SELECT action,reason,occurred_at
     FROM asset_archive_events
     WHERE organization_id=$1 AND asset_id=$2
     ORDER BY occurred_at DESC,id DESC LIMIT 1`,[session.organizationId,asset.id]);
   if(state.rows[0]){
    administrativeState=state.rows[0].action;
    if(administrativeState==='ARCHIVE'){
     archiveReason=state.rows[0].reason;
     archiveOccurredAt=state.rows[0].occurred_at;
    }
   }
  }

  return NextResponse.json({
   source:'live',
   tenantScoped:true,
   truthBoundary:'FIELD_IDENTITY_RESOLUTION_DOES_NOT_ESTABLISH_VERIFIED_STATE',
   asset:{
    ...asset,
    administratively_archived:administrativeState==='ARCHIVE',
    administrative_state:administrativeState,
    archive_reason:archiveReason,
    archive_occurred_at:archiveOccurredAt
   }
  });
 }catch(error:any){
  return NextResponse.json({error:error.message},{status:error.status||500});
 }
}
