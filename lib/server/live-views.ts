import {query} from './db';
import {requireSession} from './auth';
import {fetchDirExplorer} from './chain';

export type LiveAssetRow={
  id:string;
  project_id:string;
  asset_code:string;
  asset_type:string;
  name:string;
  model:string|null;
  serial_number:string|null;
  location_label:string|null;
  status:string;
  qr_token:string;
  specifications:Record<string,unknown>;
  installed_at:Date|null;
  commissioned_at:Date|null;
  warranty_expires_at:Date|null;
  project_code:string;
  project_name:string;
  site_name:string;
  system_name:string|null;
  manufacturer_name:string|null;
  latest_event_id:string|null;
  latest_event_type:string|null;
  latest_event_status:string|null;
  ledger_network:string|null;
  ledger_tx_hash:string|null;
  ledger_block_height:string|null;
  anchored_at:Date|null;
  archive_action:'ARCHIVE'|'RESTORE'|null;
  archive_reason:string|null;
  archive_occurred_at:Date|null;
  archive_actor_user_id:string|null;
  archived:boolean;
  archive_schema_ready:boolean;
};

export type AssetArchiveHistoryRow={
  id:string;
  action:'ARCHIVE'|'RESTORE';
  reason:string;
  occurred_at:Date;
  actor_user_id:string;
  actor_name:string|null;
  previous_event_id:string|null;
};

const ASSET_COLUMNS=`a.id,a.project_id,a.asset_code,a.asset_type,a.name,a.model,a.serial_number,a.location_label,a.status,a.qr_token::text,a.specifications,a.installed_at,a.commissioned_at,a.warranty_expires_at,p.project_code,p.name project_name,si.name site_name,sy.name system_name,m.name manufacturer_name,le.id::text latest_event_id,le.event_type::text latest_event_type,le.status::text latest_event_status,le.ledger_network,le.ledger_tx_hash,le.ledger_block_height::text,le.anchored_at`;

const ASSET_JOINS=`FROM assets a
  JOIN projects p ON p.id=a.project_id
  JOIN sites si ON si.id=a.site_id
  LEFT JOIN systems sy ON sy.id=a.system_id
  LEFT JOIN manufacturers m ON m.id=a.manufacturer_id
  LEFT JOIN LATERAL (
    SELECT x.* FROM lifecycle_events x
    WHERE x.asset_id=a.id AND x.status='VERIFIED'
    ORDER BY x.anchored_at DESC NULLS LAST,x.occurred_at DESC
    LIMIT 1
  ) le ON true`;

const ARCHIVE_JOIN=`LEFT JOIN LATERAL (
  SELECT x.id,x.action,x.reason,x.occurred_at,x.actor_user_id
  FROM asset_archive_events x
  WHERE x.organization_id=a.organization_id AND x.asset_id=a.id
  ORDER BY x.occurred_at DESC,x.id DESC
  LIMIT 1
) ae ON true`;

function assetSelect(archiveReady:boolean){
  const archiveColumns=archiveReady
    ? `,ae.action archive_action,ae.reason archive_reason,ae.occurred_at archive_occurred_at,ae.actor_user_id::text archive_actor_user_id,(ae.action='ARCHIVE') archived,true archive_schema_ready`
    : `,NULL::text archive_action,NULL::text archive_reason,NULL::timestamptz archive_occurred_at,NULL::text archive_actor_user_id,false archived,false archive_schema_ready`;
  return `SELECT ${ASSET_COLUMNS}${archiveColumns} ${ASSET_JOINS} ${archiveReady?ARCHIVE_JOIN:''}`;
}

export async function assetArchiveSchemaReady(){
  const r=await query<{ready:boolean}>(`SELECT to_regclass('public.asset_archive_events') IS NOT NULL ready`);
  return Boolean(r.rows[0]?.ready);
}

export async function liveAssets(){
  const session=await requireSession();
  const archiveReady=await assetArchiveSchemaReady();
  const r=await query<LiveAssetRow>(`${assetSelect(archiveReady)}
    WHERE a.organization_id=$1
      ${archiveReady?`AND COALESCE(ae.action,'RESTORE') <> 'ARCHIVE'`:''}
    ORDER BY COALESCE(le.anchored_at,a.created_at) DESC
    LIMIT 500`,[session.organizationId]);
  return r.rows;
}

export async function archivedAssets(){
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN']);
  const archiveReady=await assetArchiveSchemaReady();
  if(!archiveReady)throw Object.assign(new Error('Asset archive schema is not ready'),{status:503});
  const r=await query<LiveAssetRow>(`${assetSelect(true)}
    WHERE a.organization_id=$1 AND ae.action='ARCHIVE'
    ORDER BY ae.occurred_at DESC,a.created_at DESC
    LIMIT 500`,[session.organizationId]);
  return r.rows;
}

export async function liveAsset(identifier:string){
  const session=await requireSession();
  const archiveReady=await assetArchiveSchemaReady();
  const r=await query<LiveAssetRow>(`${assetSelect(archiveReady)}
    WHERE (a.id::text=$1 OR a.asset_code=$1) AND a.organization_id=$2
    LIMIT 1`,[identifier,session.organizationId]);
  return r.rows[0]||null;
}

export async function assetArchiveHistory(assetId:string){
  const session=await requireSession();
  const archiveReady=await assetArchiveSchemaReady();
  if(!archiveReady)return [];
  const r=await query<AssetArchiveHistoryRow>(`SELECT ae.id::text,ae.action,ae.reason,ae.occurred_at,ae.actor_user_id::text,u.display_name actor_name,ae.previous_event_id::text
    FROM asset_archive_events ae
    JOIN assets a ON a.id=ae.asset_id
    LEFT JOIN users u ON u.id=ae.actor_user_id
    WHERE ae.asset_id::text=$1 AND ae.organization_id=$2 AND a.organization_id=$2
    ORDER BY ae.occurred_at DESC,ae.id DESC`,[assetId,session.organizationId]);
  return r.rows;
}

export async function assetLifecycle(assetId:string){
  const session=await requireSession();
  const r=await query<any>(`SELECT le.id::text,le.event_type::text,le.status::text,le.occurred_at,le.payload_sha256,le.evidence_package_sha256,le.ledger_network,le.ledger_tx_hash,le.ledger_block_height::text,le.anchored_at,performer.display_name performed_by_name,approver.display_name approved_by_name,(SELECT count(*)::int FROM evidence ev WHERE ev.lifecycle_event_id=le.id) evidence_count FROM lifecycle_events le LEFT JOIN users performer ON performer.id=le.performed_by LEFT JOIN users approver ON approver.id=le.approved_by WHERE le.asset_id=$1 AND le.organization_id=$2 ORDER BY le.occurred_at DESC`,[assetId,session.organizationId]);
  return r.rows;
}

export async function publicEvidence(assetId:string){
  const session=await requireSession();
  const r=await query<any>(`SELECT ev.id::text,ev.kind,ev.sha256,ev.visibility,ev.captured_at FROM evidence ev WHERE ev.asset_id=$1 AND ev.organization_id=$2 AND ev.visibility='PUBLIC' ORDER BY ev.captured_at DESC NULLS LAST,ev.created_at DESC`,[assetId,session.organizationId]);
  return r.rows;
}

export async function recentChain(){
  return fetchDirExplorer(25);
}
