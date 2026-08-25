import TwinWorkspace,{TwinAsset} from '@/components/TwinWorkspace';
import CompiledGraphViewer from '@/components/CompiledGraphViewer';
import {liveAssets} from '@/lib/server/live-views';

export const dynamic='force-dynamic';

export default async function TwinPage(){
 let assets:TwinAsset[]=[];let backendOnline=true;
 try{const rows=await liveAssets();assets=rows.map(a=>({id:a.id,asset_code:a.asset_code,asset_type:a.asset_type,name:a.name,model:a.model,serial_number:a.serial_number,location_label:a.location_label,status:a.status,project_code:a.project_code,project_name:a.project_name,site_name:a.site_name,system_name:a.system_name,manufacturer_name:a.manufacturer_name,latest_event_type:a.latest_event_type,ledger_network:a.ledger_network,ledger_tx_hash:a.ledger_tx_hash,ledger_block_height:a.ledger_block_height}));}
 catch(error){backendOnline=false;console.error('STRATUM Twin backend data unavailable; rendering resilient twin workspace.',error);}
 return <>
  <div className="page-head"><div><div className="eyebrow">STRATUM Twin · Source → Spatial → Systems → Assets → Operations → Trust</div><h1 className="title">The layered, verifiable digital twin of physical infrastructure.</h1><p className="subtitle">The Twin exposes the complete L0–L8 model: original source documents, architecture, electrical physical geometry, logical connectivity, tracked asset identities, installation state, evidence, operations and Digital Immutable Records (DIR) trust records. Private drawings and evidence remain private; only cryptographic proof enters DIR.</p></div><div className="badge">● DIR · immutable records · hashes only</div></div>
  {!backendOnline&&<div className="card" style={{marginBottom:16,borderColor:'#75592e'}}><div className="eyebrow">Twin workspace online · backend reconnecting</div><p className="subtitle" style={{marginTop:6}}>The layered Twin remains usable even if live asset data is temporarily unavailable. STRATUM Verified records will reconnect automatically when the production database is available.</p></div>}
  <CompiledGraphViewer/>
  <TwinWorkspace assets={assets} referenceModelUrl={process.env.NEXT_PUBLIC_STRATUM_TWIN_REFERENCE_MODEL_URL}/>
  <div className="card" style={{marginTop:16}}><div className="eyebrow">Complete layer architecture</div><div className="provenance-map"><div className="prov-step active"><i>L0</i><b>Source</b><span>CAD · PDF · BIM</span></div><em>→</em><div className="prov-step active"><i>L1</i><b>Architectural</b><span>Rooms · walls · floors</span></div><em>→</em><div className="prov-step active"><i>L2</i><b>Electrical Physical</b><span>Panels · transformers · equipment</span></div><em>→</em><div className="prov-step active"><i>L3</i><b>Electrical Logical</b><span>Feeders · circuits · dependencies</span></div><em>→</em><div className="prov-step active"><i>L4</i><b>STRATUM Assets</b><span>Durable identities</span></div><em>→</em><div className="prov-step active"><i>L5</i><b>Installation</b><span>As-installed progress</span></div><em>→</em><div className="prov-step active"><i>L6</i><b>Evidence</b><span>QA · photos · commissioning</span></div><em>→</em><div className="prov-step active"><i>L7</i><b>Operations</b><span>Maintenance · telemetry · health</span></div><em>→</em><div className="prov-step active"><i>L8</i><b>DIR</b><span>Digital Immutable Records</span></div></div></div>
 </>;
}
