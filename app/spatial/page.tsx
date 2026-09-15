import TwinWorkspace,{TwinAsset} from '@/components/TwinWorkspace';
import CompiledGraphViewer from '@/components/CompiledGraphViewer';
import SpatialProjectionEngine from '@/components/SpatialProjectionEngine';
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
  <div className="page-head"><div><div className="eyebrow">{STRATUM_PRODUCT}</div><h1 className="title">See the infrastructure. Follow the power. Review what is uncertain.</h1><p className="subtitle">Model shows physical placement and Z. Electrical turns SLD hierarchy into a spatial power view. Review exposes source confidence and anything that still needs human confirmation.</p></div><div className="badge">MODEL · ELECTRICAL · REVIEW</div></div>

  <div className="card" style={{marginBottom:16,padding:14}}><div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><div><div className="eyebrow">Current trust state</div><div className="trust-row"><TrustBadge state={backendOnline?'LIVE':'STALE'}/><TrustBadge state={assets.some(a=>a.ledger_block_height)?'POVI_VERIFIED':'UNVERIFIED'}/></div></div><p className="muted" style={{margin:0,maxWidth:620}}>Live state, engineering approval, DIR finality and physical truth remain separate. The viewer never upgrades inferred geometry or SLD layout into Verified state.</p></div></div>

  {!backendOnline&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Viewer available · registered asset data unavailable</div><p className="subtitle" style={{margin:'6px 0 0'}}>You can still inspect imported drawings and the spatial graph. Sign in and connect the production data service to load registered assets.</p></div>}

  <CompiledGraphViewer/>

  <details className="card" style={{marginTop:16}}>
   <summary style={{cursor:'pointer',fontWeight:700}}>Registered asset operations</summary>
   <p className="muted">Open this when you need registered STRATUM Assets, lifecycle state and operational controls. It is intentionally secondary to the spatial viewer.</p>
   <TwinWorkspace assets={assets} referenceModelUrl={process.env.NEXT_PUBLIC_STRATUM_TWIN_REFERENCE_MODEL_URL}/>
  </details>

  <details className="card" style={{marginTop:16}}>
   <summary style={{cursor:'pointer',fontWeight:700}}>Technical layer model L0–L8</summary>
   <p className="muted">For engineering and trust review. Most users should not need this to navigate the model.</p>
   <div className="provenance-map"><div className="prov-step active"><i>L0</i><b>Source</b><span>CAD · PDF · BIM · capture</span></div><em>→</em><div className="prov-step active"><i>L1</i><b>Architectural</b><span>Rooms · walls · floors</span></div><em>→</em><div className="prov-step active"><i>L2</i><b>Electrical Physical</b><span>Equipment placement</span></div><em>→</em><div className="prov-step active"><i>L3</i><b>Electrical Logical</b><span>Feeders · circuits · dependencies</span></div><em>→</em><div className="prov-step active"><i>L4</i><b>STRATUM Assets</b><span>Durable identities</span></div><em>→</em><div className="prov-step active"><i>L5</i><b>Installation</b><span>As-installed state</span></div><em>→</em><div className="prov-step active"><i>L6</i><b>Evidence</b><span>QA · testing</span></div><em>→</em><div className="prov-step active"><i>L7</i><b>Operations</b><span>Maintenance · telemetry</span></div><em>→</em><div className="prov-step active"><i>L8</i><b>Trust</b><span>DIR · PoVI</span></div></div>
  </details>
 </>;
}
