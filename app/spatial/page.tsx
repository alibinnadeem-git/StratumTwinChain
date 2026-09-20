import SpatialExperience from '@/components/SpatialExperience';
import SpatialProjectionEngine from '@/components/SpatialProjectionEngine';
import SpatialReviewQueue from '@/components/SpatialReviewQueue';
import TrustBadge from '@/components/TrustBadge';
import {type RegisteredSpatialAsset} from '@/lib/spatial-asset-link';
import {liveAssets} from '@/lib/server/live-views';
import {STRATUM_PRODUCT} from '@/lib/redbook/terminology';

export const dynamic='force-dynamic';

export default async function SpatialPage(){
 let assets:RegisteredSpatialAsset[]=[];let backendOnline=true;
 try{
  const rows=await liveAssets();
  assets=rows.map(a=>({
   id:a.id,project_id:a.project_id,asset_code:a.asset_code,asset_type:a.asset_type,name:a.name,model:a.model,
   serial_number:a.serial_number,location_label:a.location_label,status:a.status,qr_token:a.qr_token,
   project_code:a.project_code,project_name:a.project_name,site_name:a.site_name,system_name:a.system_name,
   manufacturer_name:a.manufacturer_name,latest_event_id:a.latest_event_id,latest_event_type:a.latest_event_type,
   latest_event_status:a.latest_event_status,ledger_network:a.ledger_network,ledger_tx_hash:a.ledger_tx_hash,
   ledger_block_height:a.ledger_block_height,anchored_at:a.anchored_at,
  }));
 }catch(error){
  backendOnline=false;
  console.error('STRATUM Spatial Verified backend data unavailable; rendering source-only Spatial workspace.',error);
 }

 return <>
  <SpatialProjectionEngine/>
  <div className="page-head"><div><div className="eyebrow">{STRATUM_PRODUCT}</div><h1 className="title">Review the model.</h1><p className="subtitle">Import project sources first, then inspect rooms, equipment, lifecycle activity and DIR state in one Spatial workspace.</p></div><div className="badge">MODEL · ASSETS · DIR</div></div>

  <SpatialReviewQueue/>

  {!backendOnline&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Registered asset data unavailable</div><p className="subtitle" style={{margin:'6px 0 0'}}>Imported project geometry remains available. Asset activity, QR identity and DIR details stay unavailable until the production data service reconnects; no reference asset data is substituted.</p></div>}

  <SpatialExperience assets={assets}/>

  <section className="card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Trust boundary</div><h2>One project flow, explicit trust</h2></div><div className="trust-row"><TrustBadge state={backendOnline?'LIVE':'STALE'}/><TrustBadge state={assets.some(a=>a.ledger_block_height)?'POVI_VERIFIED':'UNVERIFIED'}/></div></div>
   <p className="muted">Imported project geometry, registered asset state, activity evidence and DIR finality remain distinct. A visualization, QR lookup or cryptographic record never silently upgrades an inferred condition into physical truth.</p>
  </section>
 </>;
}
