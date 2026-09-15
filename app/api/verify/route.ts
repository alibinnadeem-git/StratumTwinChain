import {NextResponse} from 'next/server';
import {query} from '@/lib/server/db';
import {assetArchiveSchemaReady} from '@/lib/server/live-views';

export async function GET(req:Request){
  try{
    const q=new URL(req.url).searchParams.get('q')?.trim();
    if(!q)return NextResponse.json({error:'q is required'},{status:400});

    const r=await query<any>(`SELECT le.id record_id,le.event_type,le.occurred_at,le.status,le.payload_sha256,le.evidence_package_sha256,le.ledger_network,le.ledger_tx_hash,le.ledger_block_height,a.id::text asset_id,a.asset_code,a.name asset_name,a.serial_number,p.project_code,p.name project_name
      FROM lifecycle_events le
      JOIN assets a ON a.id=le.asset_id
      JOIN projects p ON p.id=le.project_id
      LEFT JOIN evidence ev ON ev.lifecycle_event_id=le.id
      WHERE le.status='VERIFIED'
        AND (le.id::text=$1 OR le.payload_sha256=$1 OR le.evidence_package_sha256=$1 OR le.ledger_tx_hash=$1 OR a.asset_code=$1 OR a.serial_number=$1 OR a.qr_token::text=$1 OR ev.sha256=$1)
      ORDER BY le.occurred_at DESC
      LIMIT 25`,[q]);

    let archiveByAsset=new Map<string,any>();
    if(r.rows.length&&await assetArchiveSchemaReady()){
      const assetIds=[...new Set(r.rows.map((row:any)=>String(row.asset_id)))];
      const states=await query<any>(`SELECT DISTINCT ON (asset_id) asset_id::text,action,reason,occurred_at
        FROM asset_archive_events
        WHERE asset_id::text=ANY($1::text[])
        ORDER BY asset_id,occurred_at DESC,id DESC`,[assetIds]);
      archiveByAsset=new Map(states.rows.map((row:any)=>[String(row.asset_id),row]));
    }

    const records=r.rows.map((row:any)=>{
      const administrative=archiveByAsset.get(String(row.asset_id));
      return {
        ...row,
        administratively_archived:administrative?.action==='ARCHIVE',
        administrative_state:administrative?.action||'ACTIVE',
        archive_reason:administrative?.action==='ARCHIVE'?administrative.reason:null,
        archive_occurred_at:administrative?.action==='ARCHIVE'?administrative.occurred_at:null
      };
    });

    return NextResponse.json({
      verified:records.length>0,
      truthBoundary:'ADMINISTRATIVE_ARCHIVE_NEVER_REWRITES_VERIFIED_HISTORY',
      records
    });
  }catch(e:any){
    return NextResponse.json({error:e.message},{status:500});
  }
}
