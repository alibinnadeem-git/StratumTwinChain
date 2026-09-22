import SpatialExperience from '@/components/SpatialExperience';
import SpatialProjectionEngine from '@/components/SpatialProjectionEngine';
import SpatialReviewQueue from '@/components/SpatialReviewQueue';
import SpatialWorkspaceStatus from '@/components/SpatialWorkspaceStatus';
import SpatialAutoSync from '@/components/SpatialAutoSync';
import SpatialServerHydrator from '@/components/SpatialServerHydrator';
import PowerIntelligencePanel from '@/components/PowerIntelligencePanel';
import CoordinationFindingsPanel from '@/components/CoordinationFindingsPanel';
import TrustBadge from '@/components/TrustBadge';
import {type RegisteredSpatialAsset} from '@/lib/spatial-asset-link';
import {liveAssets} from '@/lib/server/live-views';
import {readSession} from '@/lib/server/auth';

export const dynamic='force-dynamic';

export default async function SpatialPage(){
 const session=await readSession();
 let assets:RegisteredSpatialAsset[]=[];let backendOnline=true;
 if(session)try{
  const rows=await liveAssets();
  assets=rows.map(a=>({
   id:a.id,project_id:a.project_id,asset_code:a.asset_code,asset_type:a.asset_type,name:a.name,model:a.model,
   serial_number:a.serial_number,location_label:a.location_label,status:a.status,qr_token:a.qr_token,
   project_code:a.project_code,project_name:a.project_name,site_name:a.site_name,system_name:a.system_name,
   manufacturer_name:a.manufacturer_name,latest_event_id:a.latest_event_id,latest_event_type:a.latest_event_type,
   latest_event_status:a.latest_event_status,ledger_network:a.ledger_network,ledger_tx_hash:a.ledger_tx_hash,
   ledger_block_height:a.ledger_block_height,anchored_at:a.anchored_at,
   maintenance_plan_id:a.maintenance_plan_id,maintenance_revision:a.maintenance_revision,maintenance_basis:a.maintenance_basis,
   maintenance_interval_days:a.maintenance_interval_days,maintenance_interval_hours:a.maintenance_interval_hours,
   maintenance_next_due_at:a.maintenance_next_due_at,maintenance_condition_triggers:a.maintenance_condition_triggers,
   maintenance_task_summary:a.maintenance_task_summary,maintenance_source_refs:a.maintenance_source_refs,maintenance_status:a.maintenance_status,
  }));
 }catch(error){
  backendOnline=false;
  console.warn('STRATUM Spatial Verified live asset data unavailable for authenticated Spatial session; rendering source-only workspace.',error);
 }

 return <>
  <SpatialServerHydrator/>
  <SpatialProjectionEngine/>
  {session&&<SpatialAutoSync/>}

  <div className="page-head"><div><div className="eyebrow">Spatial</div><h1 className="title">See the project.</h1><p className="subtitle">The project model is the workspace. Click equipment for identity, field activity and DIR status; open review details only when something needs attention.</p></div><div className="badge">{session?(backendOnline?'MODEL · LIVE ASSETS':'MODEL · BROWSER'):'MODEL · SOURCE-ONLY'}</div></div>

  <SpatialWorkspaceStatus compact authenticated={Boolean(session)}/>

  <SpatialExperience assets={assets}/>
  <PowerIntelligencePanel/>
  <CoordinationFindingsPanel/>

  <details className="secondary-details card">
   <summary>Review & trust details</summary>
   <SpatialReviewQueue/>
   <div className="section-head" style={{marginTop:14}}><div><div className="eyebrow">Trust boundary</div><h3>Keep model, asset state and DIR finality distinct</h3></div><div className="trust-row"><TrustBadge state={session?(backendOnline?'LIVE':'STALE'):'UNVERIFIED'}/><TrustBadge state={assets.some(a=>a.ledger_block_height)?'POVI_VERIFIED':'UNVERIFIED'}/></div></div>
   <p className="muted">Imported geometry can remain usable while live asset data is unavailable. STRATUM never substitutes reference assets for your project and never treats visualization or cryptographic finality as physical truth.</p>
  </details>
 </>;
}
