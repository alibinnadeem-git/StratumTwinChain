import {requireSession} from './auth';
import {query} from './db';

export type CommandCenterMetrics={
  registered_assets:number;
  dir_linked_assets:number;
  lifecycle_records:number;
  evidence_records:number;
};

export type CommandCenterActivity={
  id:string;
  source:'LIFECYCLE'|'EVIDENCE';
  occurred_at:Date;
  activity_type:string;
  trust_state:string;
  asset_id:string;
  asset_code:string;
  asset_name:string;
  actor_name:string|null;
  ledger_block_height:string|null;
};

export async function commandCenterSnapshot(){
  const session=await requireSession();
  const [metricResult,activityResult]=await Promise.all([
    query<CommandCenterMetrics>(`SELECT
      (SELECT count(*)::int FROM assets a WHERE a.organization_id=$1) registered_assets,
      (SELECT count(DISTINCT le.asset_id)::int FROM lifecycle_events le WHERE le.organization_id=$1 AND le.ledger_block_height IS NOT NULL) dir_linked_assets,
      (SELECT count(*)::int FROM lifecycle_events le WHERE le.organization_id=$1) lifecycle_records,
      (SELECT count(*)::int FROM evidence ev WHERE ev.organization_id=$1) evidence_records`,[session.organizationId]),
    query<CommandCenterActivity>(`SELECT activity.id,activity.source,activity.occurred_at,activity.activity_type,activity.trust_state,activity.asset_id,activity.asset_code,activity.asset_name,activity.actor_name,activity.ledger_block_height
      FROM (
        SELECT le.id::text id,'LIFECYCLE'::text source,le.occurred_at,le.event_type::text activity_type,le.status::text trust_state,a.id::text asset_id,a.asset_code,a.name asset_name,u.display_name actor_name,le.ledger_block_height::text ledger_block_height
        FROM lifecycle_events le
        JOIN assets a ON a.id=le.asset_id AND a.organization_id=$1
        LEFT JOIN users u ON u.id=le.performed_by
        WHERE le.organization_id=$1
        UNION ALL
        SELECT ev.id::text id,'EVIDENCE'::text source,COALESCE(ev.captured_at,ev.created_at) occurred_at,ev.kind::text activity_type,ev.visibility::text trust_state,a.id::text asset_id,a.asset_code,a.name asset_name,u.display_name actor_name,NULL::text ledger_block_height
        FROM evidence ev
        JOIN assets a ON a.id=ev.asset_id AND a.organization_id=$1
        LEFT JOIN users u ON u.id=ev.captured_by
        WHERE ev.organization_id=$1
      ) activity
      ORDER BY activity.occurred_at DESC NULLS LAST,activity.id DESC
      LIMIT 12`,[session.organizationId])
  ]);

  return {
    organizationId:session.organizationId,
    metrics:metricResult.rows[0]||{registered_assets:0,dir_linked_assets:0,lifecycle_records:0,evidence_records:0},
    activities:activityResult.rows
  };
}
