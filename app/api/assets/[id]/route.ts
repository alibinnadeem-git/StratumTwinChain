import {NextResponse} from 'next/server';
import {requireSession} from '@/lib/server/auth';
import {query,tx} from '@/lib/server/db';

const ADMIN_ROLES=['SUPER_ADMIN','ORG_ADMIN'] as const;

type ArchiveEvent={
  id:string;
  action:'ARCHIVE'|'RESTORE';
  reason:string;
  occurred_at:Date|string;
  actor_user_id:string;
  previous_event_id:string|null;
};

function httpError(message:string,status:number){
  return Object.assign(new Error(message),{status});
}

async function readReason(req:Request){
  const body=await req.json().catch(()=>({}));
  const reason=typeof body?.reason==='string'?body.reason.trim():'';
  if(reason.length<5||reason.length>500)throw httpError('A reason between 5 and 500 characters is required',400);
  return {body,reason};
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSession();
    const {id}=await params;
    const r=await query<any>(`SELECT a.*,p.name project_name,si.name site_name,sy.name system_name,m.name manufacturer_name
      FROM assets a
      JOIN projects p ON p.id=a.project_id
      JOIN sites si ON si.id=a.site_id
      LEFT JOIN systems sy ON sy.id=a.system_id
      LEFT JOIN manufacturers m ON m.id=a.manufacturer_id
      WHERE a.organization_id=$1
        AND (a.id::text=$2 OR a.asset_code=$2 OR a.serial_number=$2 OR a.qr_token::text=$2)
      LIMIT 1`,[s.organizationId,id]);
    if(!r.rows[0])return NextResponse.json({error:'Not found'},{status:404});

    const ready=await query<{ready:boolean}>(`SELECT to_regclass('public.asset_archive_events') IS NOT NULL ready`);
    let archiveEvent:ArchiveEvent|null=null;
    if(ready.rows[0]?.ready){
      const state=await query<ArchiveEvent>(`SELECT id::text,action,reason,occurred_at,actor_user_id::text,previous_event_id::text
        FROM asset_archive_events
        WHERE organization_id=$1 AND asset_id=$2
        ORDER BY occurred_at DESC,id DESC
        LIMIT 1`,[s.organizationId,r.rows[0].id]);
      archiveEvent=state.rows[0]||null;
    }

    return NextResponse.json({
      ...r.rows[0],
      archiveSchemaReady:Boolean(ready.rows[0]?.ready),
      archived:archiveEvent?.action==='ARCHIVE',
      archiveEvent
    });
  }catch(e:any){
    return NextResponse.json({error:e.message},{status:e.status||500});
  }
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSession([...ADMIN_ROLES]);
    const {id}=await params;
    const {reason}=await readReason(req);

    const result=await tx(async c=>{
      const schema=await c.query<{ready:boolean}>(`SELECT to_regclass('public.asset_archive_events') IS NOT NULL ready`);
      if(!schema.rows[0]?.ready)throw httpError('Asset archive schema is not ready',503);

      const asset=await c.query<{id:string}>(`SELECT id::text
        FROM assets
        WHERE organization_id=$1 AND (id::text=$2 OR asset_code=$2)
        LIMIT 1
        FOR UPDATE`,[s.organizationId,id]);
      if(!asset.rows[0])throw httpError('Asset not found',404);
      const assetId=asset.rows[0].id;

      const current=await c.query<ArchiveEvent>(`SELECT id::text,action,reason,occurred_at,actor_user_id::text,previous_event_id::text
        FROM asset_archive_events
        WHERE organization_id=$1 AND asset_id=$2
        ORDER BY occurred_at DESC,id DESC
        LIMIT 1`,[s.organizationId,assetId]);
      const previous=current.rows[0]||null;
      if(previous?.action==='ARCHIVE')return {assetId,archived:true,idempotent:true,archiveEvent:previous};

      const inserted=await c.query<ArchiveEvent>(`INSERT INTO asset_archive_events
        (organization_id,asset_id,action,reason,actor_user_id,previous_event_id)
        VALUES ($1,$2,'ARCHIVE',$3,$4,$5)
        RETURNING id::text,action,reason,occurred_at,actor_user_id::text,previous_event_id::text`,
        [s.organizationId,assetId,reason,s.userId,previous?.id||null]);
      return {assetId,archived:true,idempotent:false,archiveEvent:inserted.rows[0]};
    });

    return NextResponse.json(result);
  }catch(e:any){
    return NextResponse.json({error:e.message},{status:e.status||500});
  }
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const s=await requireSession([...ADMIN_ROLES]);
    const {id}=await params;
    const {body,reason}=await readReason(req);
    if(body?.action!=='RESTORE')throw httpError('PATCH only supports action RESTORE',400);

    const result=await tx(async c=>{
      const schema=await c.query<{ready:boolean}>(`SELECT to_regclass('public.asset_archive_events') IS NOT NULL ready`);
      if(!schema.rows[0]?.ready)throw httpError('Asset archive schema is not ready',503);

      const asset=await c.query<{id:string}>(`SELECT id::text
        FROM assets
        WHERE organization_id=$1 AND (id::text=$2 OR asset_code=$2)
        LIMIT 1
        FOR UPDATE`,[s.organizationId,id]);
      if(!asset.rows[0])throw httpError('Asset not found',404);
      const assetId=asset.rows[0].id;

      const current=await c.query<ArchiveEvent>(`SELECT id::text,action,reason,occurred_at,actor_user_id::text,previous_event_id::text
        FROM asset_archive_events
        WHERE organization_id=$1 AND asset_id=$2
        ORDER BY occurred_at DESC,id DESC
        LIMIT 1`,[s.organizationId,assetId]);
      const previous=current.rows[0]||null;
      if(!previous||previous.action==='RESTORE')return {assetId,archived:false,idempotent:true,archiveEvent:previous};

      const inserted=await c.query<ArchiveEvent>(`INSERT INTO asset_archive_events
        (organization_id,asset_id,action,reason,actor_user_id,previous_event_id)
        VALUES ($1,$2,'RESTORE',$3,$4,$5)
        RETURNING id::text,action,reason,occurred_at,actor_user_id::text,previous_event_id::text`,
        [s.organizationId,assetId,reason,s.userId,previous.id]);
      return {assetId,archived:false,idempotent:false,archiveEvent:inserted.rows[0]};
    });

    return NextResponse.json(result);
  }catch(e:any){
    return NextResponse.json({error:e.message},{status:e.status||500});
  }
}
