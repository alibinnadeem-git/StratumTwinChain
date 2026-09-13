import TwinWorkspace,{TwinAsset} from '@/components/TwinWorkspace';
import CompiledGraphViewer from '@/components/CompiledGraphViewer';
import TrustBadge from '@/components/TrustBadge';
import {liveAssets} from '@/lib/server/live-views';
import {STRATUM_PRODUCT,spatialNavigation} from '@/lib/redbook/terminology';

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
  <div className="page-head"><div><div className="eyebrow">{STRATUM_PRODUCT} · Source → Spatial → Systems → Assets → Operations → Trust</div><h1 className="title">The spatial operating and trust model for physical infrastructure.</h1><p className="subtitle">Navigate physical infrastructure spatially, logically, operationally and historically while preserving source provenance, evidence, approvals and PoVI finality.</p></div><div className="badge">DIRs · {process.env.STRATUM_CHAIN_ID||'stratum-devnet-1'}</div></div>

  <div className="card redbook-strip"><div><div className="eyebrow">Redbook trust vocabulary</div><div className="trust-row"><TrustBadge state={backendOnline?'LIVE':'STALE'}/><TrustBadge state={assets.some(a=>a.ledger_block_height)?'POVI_VERIFIED':'UNVERIFIED'}/><span className="muted">Cryptographic finality, engineering approval, live state and physical truth remain distinct.</span></div></div></div>

  {!backendOnline&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Spatial workspace online · operational data reconnecting</div><p className="subtitle" style={{marginTop:6}}>Spatial navigation and model inspection remain available while live operational projections reconnect. No stale projection is promoted to canonical truth.</p></div>}

  <div className="card spatial-breadcrumb-card"><div className="eyebrow">Spatial-first navigation</div><div className="spatial-breadcrumb">{spatialNavigation.map((step,i)=><span key={step}>{step}{i<spatialNavigation.length-1&&<em>→</em>}</span>)}</div></div>

  <CompiledGraphViewer/>
  <TwinWorkspace assets={assets} referenceModelUrl={process.env.NEXT_PUBLIC_STRATUM_TWIN_REFERENCE_MODEL_URL}/>

  <div className="card" style={{marginTop:16}}><div className="eyebrow">Current Spatial implementation layers</div><p className="muted">These layers describe the present application model. They do not imply that every Redbook capability behind each layer is already production-complete.</p><div className="provenance-map"><div className="prov-step active"><i>L0</i><b>Source</b><span>CAD · PDF · BIM · capture provenance</span></div><em>→</em><div className="prov-step active"><i>L1</i><b>Architectural</b><span>Rooms · walls · floors · zones</span></div><em>→</em><div className="prov-step active"><i>L2</i><b>Electrical Physical</b><span>Panels · transformers · equipment</span></div><em>→</em><div className="prov-step active"><i>L3</i><b>Electrical Logical</b><span>Feeders · circuits · dependencies</span></div><em>→</em><div className="prov-step active"><i>L4</i><b>STRATUM Assets</b><span>Durable identities</span></div><em>→</em><div className="prov-step active"><i>L5</i><b>Installation</b><span>As-installed work state</span></div><em>→</em><div className="prov-step active"><i>L6</i><b>Evidence</b><span>QA · test · commissioning artifacts</span></div><em>→</em><div className="prov-step active"><i>L7</i><b>Operations</b><span>Maintenance · telemetry · health</span></div><em>→</em><div className="prov-step active"><i>L8</i><b>Trust</b><span>NDIR · MDIR · DIR · PoVI state</span></div></div></div>
 </>;
}
