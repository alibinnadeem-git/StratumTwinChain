import {type TwinAsset} from '@/components/TwinWorkspace';
import SpatialExperience from '@/components/SpatialExperience';
import SpatialProjectionEngine from '@/components/SpatialProjectionEngine';
import SpatialReviewQueue from '@/components/SpatialReviewQueue';
import TrustBadge from '@/components/TrustBadge';
import {liveAssets} from '@/lib/server/live-views';
import {STRATUM_PRODUCT} from '@/lib/redbook/terminology';

export const dynamic='force-dynamic';

export default async function SpatialPage(){
 let assets:TwinAsset[]=[];let backendOnline=true;
 try{
  const rows=await liveAssets();
  assets=rows.map(a=>({id:a.id,project_id:a.project_id,asset_code:a.asset_code,asset_type:a.asset_type,name:a.name,model:a.model,serial_number:a.serial_number,location_label:a.location_label,status:a.status,project_code:a.project_code,project_name:a.project_name,site_name:a.site_name,system_name:a.system_name,manufacturer_name:a.manufacturer_name,latest_event_type:a.latest_event_type,ledger_network:a.ledger_network,ledger_tx_hash:a.ledger_tx_hash,ledger_block_height:a.ledger_block_height}));
 }catch(error){
  backendOnline=false;
  console.error('STRATUM Spatial Verified backend data unavailable; rendering resilient Spatial workspace.',error);
 }

 return <>
  <SpatialProjectionEngine/>
  <div className="page-head"><div><div className="eyebrow">{STRATUM_PRODUCT}</div><h1 className="title">Review the model.</h1><p className="subtitle">Look around, follow the power, then resolve anything marked Needs review. STRATUM keeps uncertainty visible instead of silently guessing.</p></div><div className="badge">MODEL · ELECTRICAL · REVIEW</div></div>

  <SpatialReviewQueue/>

  {!backendOnline&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Registered asset data unavailable</div><p className="subtitle" style={{margin:'6px 0 0'}}>Imported drawings and browser-local compilation remain available. Connect the production data service to load registered asset histories.</p></div>}

  <SpatialExperience assets={assets} referenceModelUrl={process.env.NEXT_PUBLIC_STRATUM_TWIN_REFERENCE_MODEL_URL}/>

  <section className="card" style={{marginTop:16}}>
   <div className="section-head"><div><div className="eyebrow">Trust boundary</div><h2>Project data remains explicit</h2></div><div className="trust-row"><TrustBadge state={backendOnline?'LIVE':'STALE'}/><TrustBadge state={assets.some(a=>a.ledger_block_height)?'POVI_VERIFIED':'UNVERIFIED'}/></div></div>
   <p className="muted">Imported project geometry, demonstration geometry, registered asset state and DIR finality are kept separate. A visualization never upgrades inference into verified physical truth.</p>
  </section>
 </>;
}
